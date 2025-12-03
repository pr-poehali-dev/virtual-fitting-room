import json
import os
import psycopg2
from typing import Dict, Any, Optional
import requests
from datetime import datetime
from googletrans import Translator

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
    '''Build clear prompt for NanoBanana with category-based specifications (same as SeeDream)'''
    
    base_prompt = "Image 1 = person model. "
    
    if len(garments) == 1:
        category = garments[0].get('category', 'dresses')
        if category == 'upper_body':
            base_prompt += "Image 2 has upper_body clothing. Take ONLY the top (blouse/shirt/jacket/sweater) from image 2. Do NOT change bottom clothing on person. "
        elif category == 'lower_body':
            base_prompt += "Image 2 has lower_body clothing. Take ONLY the bottom (pants/skirt/shorts) from image 2. Do NOT change top clothing on person. "
        else:
            base_prompt += "Image 2 has full outfit/dress. Take the complete outfit from image 2. "
    else:
        for i, garment in enumerate(garments):
            img_num = i + 2
            category = garment.get('category', 'dresses')
            if category == 'upper_body':
                base_prompt += f"Image {img_num} has upper_body clothing - take ONLY the top (blouse/shirt/jacket/sweater) from image {img_num}. "
            elif category == 'lower_body':
                base_prompt += f"Image {img_num} has lower_body clothing - take ONLY the bottom (pants/skirt/shorts) from image {img_num}. "
            else:
                base_prompt += f"Image {img_num} has full outfit - take complete outfit from image {img_num}. "
    
    base_prompt += "CRITICAL: On image 1 (person) keep EVERYTHING - EXACT SAME FACE, exact hairstyle, exact skin color, exact body shape, height, body proportions, shoulders width, waist size, hips size, leg length, exact pose, exact background, exact lighting. Change ONLY clothing items! "
    base_prompt += "STRICT RULE: NEVER EVER take face/body/pose/background from clothing images (2 or 3). Those images show ONLY clothing items on mannequins or models - ignore their faces and bodies completely! Use ONLY clothing items from those images. The person's face and body from image 1 must remain 100% identical. "
    
    if custom_prompt:
        translated_prompt = translate_to_english(custom_prompt)
        base_prompt += f"Additional: {translated_prompt}"
    
    return base_prompt

def submit_to_fal_queue(person_image: str, garments: list, custom_prompt: str) -> tuple:
    '''Submit task to fal.ai nano-banana queue and return (request_id, response_url)'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    person_data = normalize_image_format(person_image)
    garment_data = [normalize_image_format(g['image']) for g in garments]
    
    prompt = build_prompt(garments, custom_prompt)
    print(f'[NanoBanana] Final prompt: {prompt}')
    
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
        'https://queue.fal.run/fal-ai/nano-banana/edit',
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


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Process pending NanoBanana tasks from database
    Args: event - dict with httpMethod
          context - object with request_id attribute
    Returns: HTTP response with processing status
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
                try:
                    request_id, response_url = submit_to_fal_queue(person_image, garments, prompt_hints or '')
                    print(f'[NanoBanana] Task {task_id} submitted to fal.ai: request_id={request_id}')
                    
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'processing',
                            fal_request_id = %s,
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
        
        cursor.execute('''
            SELECT id, fal_response_url, first_result_at, user_id, saved_to_history
            FROM nanobananapro_tasks
            WHERE status = 'processing' AND fal_response_url IS NOT NULL
            ORDER BY created_at ASC
            LIMIT 5
        ''')
        
        processing_rows = cursor.fetchall()
        
        results = []
        for task_id, response_url, first_result_at, user_id, saved_to_history in processing_rows:
            try:
                status_data = check_fal_status(response_url)
                
                task_status = status_data.get('status', status_data.get('state', 'UNKNOWN'))
                
                if task_status == 'COMPLETED' or 'images' in status_data or 'image' in status_data:
                    if 'images' in status_data and len(status_data['images']) > 0:
                        result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            result_url = status_data['image']['url']
                        else:
                            result_url = status_data['image']
                    else:
                        raise Exception('No image in response')
                    
                    print(f'[NanoBanana] Task {task_id} completed! Result URL: {result_url}')
                    
                    # Keep original FAL URL (no S3 save here)
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'completed',
                            result_url = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (result_url, datetime.utcnow(), task_id))
                    conn.commit()
                    print(f'[NanoBanana] Task {task_id} saved to DB as completed')
                    
                    # Save to history ONLY if not already saved
                    if not saved_to_history:
                        print(f'[NanoBanana] Attempting to save task {task_id} to history for user {user_id}')
                        try:
                            # Get task details for history
                            cursor.execute('''
                                SELECT person_image, garments FROM nanobananapro_tasks WHERE id = %s
                            ''', (task_id,))
                            task_data = cursor.fetchone()
                            print(f'[NanoBanana] Retrieved task data: {bool(task_data)}')
                            
                            if task_data:
                                garments_list = json.loads(task_data[1]) if isinstance(task_data[1], str) else task_data[1]
                                print(f'[NanoBanana] Calling history API with user_id={user_id}, result_url={result_url[:50]}...')
                                
                                history_response = requests.post(
                                    'https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd',
                                    headers={'X-User-Id': user_id},
                                    json={
                                        'person_image': task_data[0],
                                        'garments': garments_list,
                                        'result_image': result_url,
                                        'model_used': 'nanobananapro',
                                        'cost': 0
                                    },
                                    timeout=10
                                )
                                print(f'[NanoBanana] History API response: status={history_response.status_code}, body={history_response.text[:200]}')
                                if history_response.status_code == 201:
                                    # Mark as saved to prevent duplicate saves
                                    cursor.execute('''
                                        UPDATE nanobananapro_tasks
                                        SET saved_to_history = TRUE
                                        WHERE id = %s
                                    ''', (task_id,))
                                    conn.commit()
                                    print(f'[NanoBanana] ✓ Successfully saved to history: task {task_id}')
                                else:
                                    print(f'[NanoBanana] ✗ History API returned non-201: {history_response.status_code}')
                            else:
                                print(f'[NanoBanana] ✗ No task data found for task {task_id}')
                        except Exception as e:
                            print(f'[NanoBanana] ✗ Failed to save to history: {type(e).__name__}: {str(e)}')
                    else:
                        print(f'[NanoBanana] ⊘ Task {task_id} already saved to history, skipping')
                    
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
        
        # Check if we have unfinished tasks before closing
        cursor.execute('''
            SELECT COUNT(*) FROM nanobananapro_tasks 
            WHERE status = 'processing' AND fal_response_url IS NOT NULL
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'status': 'worker_completed', 'processing_tasks': processing_count})
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }