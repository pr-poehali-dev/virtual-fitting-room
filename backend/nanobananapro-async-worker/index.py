import json
import os
import psycopg2
from typing import Dict, Any, Optional
import requests
from datetime import datetime
from googletrans import Translator
import boto3
import time
import uuid

def normalize_image_format(image: str) -> str:
    '''Convert image to data URI format if needed'''
    if image.startswith('http://') or image.startswith('https://'):
        return image
    
    if image.startswith('data:'):
        return image
    
    return f'data:image/jpeg;base64,{image}'

def translate_to_english(text: str) -> str:
    '''Translate Russian text to English'''
    if not text or not text.strip():
        return text
    
    try:
        translator = Translator()
        detected = translator.detect(text)
        
        if detected.lang == 'ru':
            print(f'[Translate] Detected Russian, translating: {text}')
            translated = translator.translate(text, src='ru', dest='en')
            result = translated.text
            print(f'[Translate] Translated to: {result}')
            return result
        else:
            print(f'[Translate] Detected {detected.lang}, keeping original')
            return text
    except Exception as e:
        print(f'[Translate] Error: {e}, keeping original text')
        return text

def build_prompt(garments: list, custom_prompt: str) -> str:
    '''Build clear prompt for NanoBanana with category-based specifications'''
    
    base_prompt = "Make only one photo where the model from first uploaded image is wearing the clothes from others uploaded images. "
    
    if len(garments) == 1:
        category = garments[0].get('category', 'dresses')
        if category == 'upper_body':
            base_prompt += "Change top clothing on the model from first uploaded image. Dress on the model from first uploaded image ONLY the top clothes (blouse/shirt/jacket/sweater/t-shirt/sweatshirt/hoodie) from second uploaded image. Do NOT change bottom clothing on the model from first uploaded image. "
        elif category == 'lower_body':
            base_prompt += "Change bottom clothing on the model from first uploaded image. Dress on the model from first uploaded image ONLY the bottom clothes (pants/skirt/shorts/underpants) from second uploaded image. Do NOT change top clothing on the model from first uploaded image. "
        else:
            base_prompt += "Change full clothing on the model from first uploaded image. Dress on the model from first uploaded image the full clothes from second uploaded image. "
    else:
        for i, garment in enumerate(garments):
            img_num = i + 2
            category = garment.get('category', 'dresses')
            if category == 'upper_body':
                base_prompt += f"Change top clothing on the model from first uploaded image. Dress on the model from first uploaded image ONLY the top clothes (blouse/shirt/jacket/sweater/t-shirt/sweatshirt/hoodie) from second uploaded image. "
            elif category == 'lower_body':
                base_prompt += f"Change bottom clothing on the model from first uploaded image. Dress on the model from first uploaded image ONLY the bottom clothes (pants/skirt/shorts/underpants) from third uploaded image. "
            else:
                base_prompt += f"Change full clothing on the model from first uploaded image. Dress on the model from first uploaded image the full clothes from second uploaded image. "
    
    base_prompt += "Keep the EXACT face, body shape, pose from first uploaded image. Change ONLY the clothes. "
    
    if custom_prompt:
        translated_prompt = translate_to_english(custom_prompt)
        base_prompt += f"Additional: {translated_prompt}"
    
    return base_prompt

def submit_to_fal_queue(person_image: str, garments: list, custom_prompt: str) -> tuple:
    '''Submit task to fal.ai nano-banana queue and return (request_id, response_url)'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    # Sort garments: upper_body first, then lower_body, then dresses
    sorted_garments = sorted(garments, key=lambda g: 0 if g.get('category') == 'upper_body' else (1 if g.get('category') == 'lower_body' else 2))
    
    person_data = normalize_image_format(person_image)
    garment_data = [normalize_image_format(g['image']) for g in sorted_garments]
    
    prompt = build_prompt(sorted_garments, custom_prompt)
    print(f'[NanoBanana] Final prompt: {prompt}')
    print(f'[NanoBanana] Image order: 1=Person, 2-{len(garment_data)+1}=Clothes')
    for i, g in enumerate(sorted_garments):
        print(f'[NanoBanana] Garment {i+2}: category={g.get("category")}')
    
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    
    image_urls = [person_data] + garment_data
    
    payload = {
        'image_urls': image_urls,
        'prompt': prompt,
        'aspect_ratio': '3:4',
        'num_images': 1
    }
    
    response = requests.post(
        'https://queue.fal.run/fal-ai/nano-banana-pro/edit',
        headers=headers,
        json=payload,
        timeout=30
    )
    
    if response.status_code == 200:
        result = response.json()
        if 'request_id' in result and 'response_url' in result:
            return (result['request_id'], result['response_url'])
    
    raise Exception(f'Failed to submit to queue: {response.status_code} - {response.text}')

def check_fal_status(response_url: str) -> Optional[dict]:
    '''Check status of fal.ai request using response_url'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        response_url,
        headers=headers,
        timeout=10
    )
    
    if response.status_code == 200:
        return response.json()
    
    raise Exception(f'Failed to check status: {response.status_code} - {response.text}')

def upload_to_s3(image_url: str, user_id: str) -> str:
    '''Download image from fal.ai and upload to Yandex Object Storage, return CDN URL'''
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    
    if not s3_access_key or not s3_secret_key:
        raise Exception('S3 credentials not configured (S3_ACCESS_KEY, S3_SECRET_KEY)')
    
    # Download image from fal.ai
    print(f'[S3] Downloading image from fal.ai: {image_url[:50]}...')
    img_response = requests.get(image_url, timeout=30)
    if img_response.status_code != 200:
        raise Exception(f'Failed to download image: {img_response.status_code}')
    
    image_data = img_response.content
    print(f'[S3] Downloaded {len(image_data)} bytes')
    
    # Generate filename
    timestamp = time.strftime('%Y%m%d_%H%M%S')
    milliseconds = int(time.time() * 1000) % 1000000
    random_suffix = uuid.uuid4().hex[:8]
    filename = f'fitting_{timestamp}_{milliseconds}_{user_id}_{random_suffix}.jpg'
    s3_key = f'images/lookbooks/{user_id}/{filename}'
    
    print(f'[S3] Uploading to S3: {s3_key}')
    
    # Upload to Yandex Object Storage
    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key
    )
    
    s3.put_object(
        Bucket=s3_bucket,
        Key=s3_key,
        Body=image_data,
        ContentType='image/jpeg'
    )
    
    # Build Yandex Cloud Storage URL
    cdn_url = f'https://storage.yandexcloud.net/{s3_bucket}/{s3_key}'
    print(f'[S3] Upload complete! Yandex Cloud URL: {cdn_url}')
    
    return cdn_url

def save_to_history(conn, user_id: str, cdn_url: str, person_image: str, garments: list, prompt: str) -> None:
    '''Save result to try_on_history table'''
    try:
        cursor = conn.cursor()
        
        # Build garments JSON (matching table structure)
        garments_json = json.dumps(garments)
        
        # Fixed cost: 30 rubles per generation (regardless of garments count)
        cost = 30
        
        # Extract first garment image for garment_image column
        garment_image = garments[0]['image'] if garments and len(garments) > 0 else ''
        
        cursor.execute('''
            INSERT INTO t_p29007832_virtual_fitting_room.try_on_history 
            (user_id, person_image, garment_image, result_image, garments, model_used, cost, created_at, saved_to_lookbook)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            user_id,
            person_image,
            garment_image,
            cdn_url,
            garments_json,
            'nanobananapro',
            cost,
            datetime.utcnow(),
            False
        ))
        
        conn.commit()
        cursor.close()
        print(f'[History] Saved to try_on_history for user {user_id}')
    
    except Exception as e:
        print(f'[History] Failed to save: {str(e)}')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Process specific NanoBanana task by task_id
    Args: event - dict with httpMethod, queryStringParameters (task_id)
          context - object with request_id attribute
    Returns: HTTP response with processing status
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Get task_id from query parameters
    query_params = event.get('queryStringParameters') or {}
    task_id = query_params.get('task_id')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id parameter is required'})
        }
    
    print(f'[NanoBanana] Worker triggered for specific task: {task_id}')
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Get specific task by task_id
        cursor.execute('''
            SELECT id, person_image, garments, prompt_hints, fal_request_id, fal_response_url, user_id, status, saved_to_history
            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
            WHERE id = %s
        ''', (task_id,))
        
        pending_row = cursor.fetchone()
        
        if not pending_row:
            print(f'[NanoBanana] Task {task_id} not found')
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        task_id, person_image, garments_json, prompt_hints, fal_request_id, fal_response_url, user_id, task_status, saved_to_history = pending_row
        garments = json.loads(garments_json)
        
        # Check if already processed
        if saved_to_history:
            print(f'[NanoBanana] Task {task_id} already saved to history, skipping')
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
                'isBase64Encoded': False,
                'body': json.dumps({'status': 'already_processed'})
            }
        
        # Process pending task
        if task_status == 'pending':
            if not fal_request_id:
                # ATOMIC: Mark as processing FIRST to prevent race condition
                print(f'[NanoBanana] Task {task_id}: ATOMIC UPDATE to prevent duplicate submission')
                cursor.execute('''
                    UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                    SET status = 'processing', updated_at = %s
                    WHERE id = %s AND status = 'pending'
                    RETURNING id
                ''', (datetime.utcnow(), task_id))
                updated_row = cursor.fetchone()
                conn.commit()
                
                if not updated_row:
                    print(f'[NanoBanana] Task {task_id} already being processed by another worker, skipping')
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'task_already_processing'})
                    }
                
                try:
                    request_id, response_url = submit_to_fal_queue(person_image, garments, prompt_hints or '')
                    print(f'[NanoBanana] Task {task_id} submitted to fal.ai: request_id={request_id}')
                    
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                        SET fal_request_id = %s,
                            fal_response_url = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (request_id, response_url, datetime.utcnow(), task_id))
                    conn.commit()
                    
                except Exception as e:
                    error_msg = str(e)
                    print(f'[NanoBanana] Failed to submit task {task_id}: {error_msg}')
                    
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'failed',
                            error_message = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
        
        # Check if task is now processing
        if task_status == 'processing' and fal_response_url:
            try:
                # Check fal.ai status
                status_data = check_fal_status(fal_response_url)
                
                task_status = status_data.get('status', status_data.get('state', 'UNKNOWN'))
                
                if task_status == 'COMPLETED' or 'images' in status_data or 'image' in status_data:
                    if 'images' in status_data and len(status_data['images']) > 0:
                        fal_result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            fal_result_url = status_data['image']['url']
                        else:
                            fal_result_url = status_data['image']
                    else:
                        raise Exception('No image in response')
                    
                    print(f'[NanoBanana] Task {task_id} completed! FAL URL: {fal_result_url}')
                    
                    # Worker now does FULL save: download from FAL → upload to S3 → save to history
                    try:
                        # Upload to Yandex.Cloud S3
                        cdn_url = upload_to_s3(fal_result_url, user_id)
                        print(f'[NanoBanana] Task {task_id} uploaded to S3: {cdn_url}')
                        
                        # Get task details for history
                        cursor.execute('''
                            SELECT person_image, garments, prompt_hints
                            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            WHERE id = %s
                        ''', (task_id,))
                        task_details = cursor.fetchone()
                        if task_details:
                            person_img, garments_json, prompt = task_details
                            garments = json.loads(garments_json)
                            
                            # Save to history
                            save_to_history(conn, user_id, cdn_url, person_img, garments, prompt or '')
                        
                        # Update task with CDN URL
                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed',
                                result_url = %s,
                                saved_to_history = true,
                                updated_at = %s
                            WHERE id = %s
                        ''', (cdn_url, datetime.utcnow(), task_id))
                        conn.commit()
                        print(f'[NanoBanana] Task {task_id} FULLY saved: S3 + history + DB')
                        
                    except Exception as save_error:
                        # If S3/history save fails, still save FAL URL so user doesn't lose result
                        print(f'[NanoBanana] Failed to upload to S3: {str(save_error)}')
                        print(f'[NanoBanana] Saving FAL URL as fallback')
                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed',
                                result_url = %s,
                                updated_at = %s,
                                error_message = %s
                            WHERE id = %s
                        ''', (fal_result_url, datetime.utcnow(), f'S3 upload failed: {str(save_error)}', task_id))
                        conn.commit()
                
                elif fal_status in ['FAILED', 'EXPIRED']:
                    error_raw = status_data.get('error', 'Generation failed')
                    error_msg = f'Ошибка генерации: {str(error_raw)[:100]}'
                    
                    print(f'[NanoBanana] Task {task_id} failed: {error_raw}')
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                        SET status = 'failed',
                            error_message = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                
                else:
                    print(f'[NanoBanana] Task {task_id} still processing, status={fal_status}')
            
            except Exception as e:
                error_str = str(e)
                if 'still in progress' in error_str.lower():
                    print(f'[NanoBanana] Task {task_id} still processing (in progress)')
                else:
                    print(f'[NanoBanana] Error checking task {task_id}: {error_str}')
        
        print(f'[NanoBanana] Worker completed processing task {task_id}')
        
        # Check for stuck tasks (older than 3 minutes in 'processing' status)
        print(f'[NanoBanana] Checking for stuck tasks older than 3 minutes...')
        cursor.execute('''
            SELECT id, fal_response_url, user_id, created_at
            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
            WHERE status = 'processing' 
              AND fal_response_url IS NOT NULL
              AND created_at < NOW() - INTERVAL '3 minutes'
              AND id != %s
            ORDER BY created_at ASC
            LIMIT 5
        ''', (task_id,))
        
        stuck_tasks = cursor.fetchall()
        print(f'[NanoBanana] Found {len(stuck_tasks)} stuck tasks')
        
        for stuck_task in stuck_tasks:
            stuck_id, stuck_response_url, stuck_user_id, stuck_created = stuck_task
            print(f'[NanoBanana] Processing stuck task {stuck_id} (created {stuck_created})')
            
            try:
                status_data = check_fal_status(stuck_response_url)
                fal_status = status_data.get('status', status_data.get('state', 'UNKNOWN'))
                
                if fal_status == 'COMPLETED' or 'images' in status_data or 'image' in status_data:
                    if 'images' in status_data and len(status_data['images']) > 0:
                        fal_result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            fal_result_url = status_data['image']['url']
                        else:
                            fal_result_url = status_data['image']
                    else:
                        continue
                    
                    print(f'[NanoBanana] Stuck task {stuck_id} completed! Uploading to S3...')
                    
                    try:
                        cdn_url = upload_to_s3(fal_result_url, stuck_user_id)
                        
                        # Get task details for history
                        cursor.execute('''
                            SELECT person_image, garments, prompt_hints
                            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            WHERE id = %s
                        ''', (stuck_id,))
                        task_details = cursor.fetchone()
                        if task_details:
                            person_img, garments_json, prompt = task_details
                            garments = json.loads(garments_json)
                            save_to_history(conn, stuck_user_id, cdn_url, person_img, garments, prompt or '')
                        
                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed',
                                result_url = %s,
                                saved_to_history = true,
                                updated_at = %s
                            WHERE id = %s
                        ''', (cdn_url, datetime.utcnow(), stuck_id))
                        conn.commit()
                        print(f'[NanoBanana] Stuck task {stuck_id} SAVED!')
                        
                    except Exception as save_error:
                        print(f'[NanoBanana] Failed to save stuck task {stuck_id}: {str(save_error)}')
                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed',
                                result_url = %s,
                                updated_at = %s
                            WHERE id = %s
                        ''', (fal_result_url, datetime.utcnow(), stuck_id))
                        conn.commit()
                
                elif fal_status in ['FAILED', 'EXPIRED']:
                    error_msg = f'Ошибка генерации: {str(status_data.get("error", "Generation failed"))[:100]}'
                    print(f'[NanoBanana] Stuck task {stuck_id} failed')
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                        SET status = 'failed',
                            error_message = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), stuck_id))
                    conn.commit()
                
            except Exception as e:
                print(f'[NanoBanana] Error processing stuck task {stuck_id}: {str(e)}')
        
        cursor.close()
        conn.close()
        
        print(f'[NanoBanana] Worker finished: main task + {len(stuck_tasks)} stuck tasks processed')
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'status': 'task_processed', 
                'task_id': task_id,
                'stuck_tasks_processed': len(stuck_tasks)
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }