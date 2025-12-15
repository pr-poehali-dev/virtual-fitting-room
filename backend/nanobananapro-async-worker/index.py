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
    '''Download image from fal.ai and upload to S3, return CDN URL'''
    aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
    
    if not aws_access_key or not aws_secret_key:
        raise Exception('AWS credentials not configured')
    
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
    s3_key = f'lookbooks/{user_id}/{filename}'
    
    print(f'[S3] Uploading to S3: {s3_key}')
    
    # Upload to S3
    s3 = boto3.client('s3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key
    )
    
    s3.put_object(
        Bucket='files',
        Key=s3_key,
        Body=image_data,
        ContentType='image/jpeg'
    )
    
    # Build CDN URL
    cdn_url = f'https://cdn.poehali.dev/projects/{aws_access_key}/bucket/{s3_key}'
    print(f'[S3] Upload complete! CDN URL: {cdn_url}')
    
    return cdn_url


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Process pending NanoBanana tasks from database
    Args: event - dict with httpMethod
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
        
        cursor.execute('''
            SELECT id, person_image, garments, prompt_hints, fal_request_id, fal_response_url, user_id
            FROM nanobananapro_tasks
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        ''')
        
        pending_row = cursor.fetchone()
        
        if pending_row:
            task_id, person_image, garments_json, prompt_hints, fal_request_id, fal_response_url, user_id = pending_row
            garments = json.loads(garments_json)
            
            if not fal_request_id:
                # ATOMIC: Mark as processing FIRST to prevent race condition
                print(f'[NanoBanana] Task {task_id}: ATOMIC UPDATE to prevent duplicate submission')
                cursor.execute('''
                    UPDATE nanobananapro_tasks
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
                        UPDATE nanobananapro_tasks
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
        
        # Check both 'processing' and 'completed' tasks that need S3 upload
        # (completed tasks with fal.ai URLs need to be uploaded to S3)
        cursor.execute('''
            SELECT id, fal_response_url, first_result_at, user_id, saved_to_history, status, result_url
            FROM nanobananapro_tasks
            WHERE (
                (status = 'processing' AND fal_response_url IS NOT NULL)
                OR (status = 'completed' AND result_url LIKE '%fal.%')
            )
            ORDER BY created_at ASC
            LIMIT 5
        ''')
        
        processing_rows = cursor.fetchall()
        
        results = []
        for task_id, response_url, first_result_at, user_id, saved_to_history, current_status, result_url in processing_rows:
            try:
                # If already completed with fal.ai URL, just upload to S3
                if current_status == 'completed' and result_url and ('fal.media' in result_url or 'fal.ai' in result_url):
                    print(f'[NanoBanana] Task {task_id} already completed with fal.ai URL, uploading to S3...')
                    
                    try:
                        cdn_url = upload_to_s3(result_url, user_id)
                        print(f'[NanoBanana] Task {task_id} uploaded to S3: {cdn_url}')
                        
                        # Update DB with CDN URL
                        cursor.execute('''
                            UPDATE nanobananapro_tasks
                            SET result_url = %s, updated_at = %s
                            WHERE id = %s
                        ''', (cdn_url, datetime.utcnow(), task_id))
                        conn.commit()
                        print(f'[NanoBanana] Task {task_id} DB updated with CDN URL')
                        
                        results.append({'task_id': task_id, 'status': 's3_uploaded'})
                    except Exception as s3_error:
                        print(f'[NanoBanana] S3 upload failed for task {task_id}: {s3_error}')
                    
                    continue
                
                # For processing tasks, check fal.ai status
                status_data = check_fal_status(response_url)
                
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
                    
                    # Upload to S3 and get CDN URL
                    try:
                        cdn_url = upload_to_s3(fal_result_url, user_id)
                        print(f'[NanoBanana] Task {task_id} uploaded to S3: {cdn_url}')
                    except Exception as s3_error:
                        print(f'[NanoBanana] S3 upload failed for task {task_id}: {s3_error}')
                        # Fallback to FAL URL if S3 fails
                        cdn_url = fal_result_url
                    
                    # Save CDN URL to DB
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'completed',
                            result_url = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (cdn_url, datetime.utcnow(), task_id))
                    conn.commit()
                    print(f'[NanoBanana] Task {task_id} saved to DB as completed with CDN URL')
                    print(f'[NanoBanana] History saving is now handled by frontend, skipping worker save')
                    
                    results.append({'task_id': task_id, 'status': 'completed'})
                
                elif task_status in ['FAILED', 'EXPIRED']:
                    error_raw = status_data.get('error', 'Generation failed')
                    error_msg = f'Ошибка генерации: {str(error_raw)[:100]}'
                    
                    print(f'[NanoBanana] Task {task_id} failed: {error_raw}')
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'failed',
                            error_message = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    results.append({'task_id': task_id, 'status': 'failed', 'reason': 'fal_api_error'})
                
                else:
                    print(f'[NanoBanana] Task {task_id} still processing, status={task_status}')
                    results.append({'task_id': task_id, 'status': 'still_processing', 'fal_status': task_status})
            
            except Exception as e:
                error_str = str(e)
                if 'still in progress' in error_str.lower():
                    print(f'[NanoBanana] Task {task_id} still processing (in progress)')
                else:
                    print(f'[NanoBanana] Error checking task {task_id}: {error_str}')
        
        # Also check for completed tasks that weren't saved to history yet
        cursor.execute('''
            SELECT id, user_id, person_image, garments, result_url
            FROM nanobananapro_tasks
            WHERE status = 'completed' AND (saved_to_history IS NULL OR saved_to_history = FALSE) AND result_url IS NOT NULL
            ORDER BY created_at ASC
            LIMIT 5
        ''')
        
        completed_unsaved = cursor.fetchall()
        print(f'[NanoBanana] Found {len(completed_unsaved)} completed tasks not saved to history')
        
        for task_id, user_id, person_image, garments_json, result_url in completed_unsaved:
            # ATOMIC: Mark as "being saved" FIRST to prevent race condition
            cursor.execute('''
                UPDATE nanobananapro_tasks
                SET saved_to_history = TRUE
                WHERE id = %s AND (saved_to_history IS NULL OR saved_to_history = FALSE)
                RETURNING id
            ''', (task_id,))
            updated_row = cursor.fetchone()
            conn.commit()
            
            # Only save to history if we successfully set the flag (no other worker did it)
            if updated_row:
                print(f'[NanoBanana] Attempting to save completed task {task_id} to history for user {user_id}')
                try:
                    garments_list = json.loads(garments_json) if isinstance(garments_json, str) else garments_json
                    print(f'[NanoBanana] Calling history API with user_id={user_id}, result_url={result_url[:50]}...')
                    
                    history_response = requests.post(
                        'https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd',
                        headers={'X-User-Id': user_id},
                        json={
                            'person_image': person_image,
                            'garments': garments_list,
                            'result_image': result_url,
                            'model_used': 'nanobananapro',
                            'cost': 0
                        },
                        timeout=10
                    )
                    print(f'[NanoBanana] History API response: status={history_response.status_code}, body={history_response.text[:200]}')
                    if history_response.status_code == 201:
                        print(f'[NanoBanana] ✓ Successfully saved completed task to history: {task_id}')
                    else:
                        print(f'[NanoBanana] ✗ History API returned non-201: {history_response.status_code}')
                except Exception as e:
                    print(f'[NanoBanana] ✗ Failed to save completed task to history: {type(e).__name__}: {str(e)}')
            else:
                print(f'[NanoBanana] ⊘ Completed task {task_id} already being saved by another worker, skipping')
        
        # Check if we have unfinished tasks before closing
        cursor.execute('''
            SELECT COUNT(*) FROM nanobananapro_tasks 
            WHERE (
                (status = 'processing' AND fal_response_url IS NOT NULL)
                OR (status = 'completed' AND result_url LIKE '%fal.%')
            )
        ''')
        processing_count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        if processing_count > 0:
            print(f'[NanoBanana] Still have {processing_count} processing tasks, triggering next check')
            try:
                import urllib.request
                worker_url = 'https://functions.poehali.dev/1f4c772e-0425-4fe4-98a6-baa3979ba94d'
                req = urllib.request.Request(worker_url, method='GET')
                urllib.request.urlopen(req, timeout=1)
            except:
                pass
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
            'isBase64Encoded': False,
            'body': json.dumps({'status': 'worker_completed', 'processing_tasks': processing_count})
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fitting-room.ru'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }