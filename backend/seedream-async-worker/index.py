import json
import os
import psycopg2
from typing import Dict, Any, Optional
import base64
import requests
from datetime import datetime
import re

def translate_to_english(text: str) -> str:
    '''Translate Russian text to English using Google Translate API'''
    if not text or not text.strip():
        return text
    
    has_cyrillic = bool(re.search('[а-яА-Я]', text))
    if not has_cyrillic:
        return text
    
    try:
        url = 'https://translate.googleapis.com/translate_a/single'
        params = {
            'client': 'gtx',
            'sl': 'ru',
            'tl': 'en',
            'dt': 't',
            'q': text
        }
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            result = response.json()
            translated = ''.join([sentence[0] for sentence in result[0]])
            print(f'[Translate] "{text}" -> "{translated}"')
            return translated
    except Exception as e:
        print(f'[Translate] Failed to translate: {str(e)}')
    
    return text

def build_prompt(garments: list, custom_prompt: str) -> str:
    '''Build clear prompt for SeeDream 4 with category-based specifications'''
    
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

def normalize_image_format(image: str) -> str:
    '''Convert image to data URI format if needed'''
    if image.startswith('http://') or image.startswith('https://'):
        return image
    
    if image.startswith('data:'):
        return image
    
    return f'data:image/jpeg;base64,{image}'

def submit_to_fal_queue(person_image: str, garments: list, prompt: str) -> tuple:
    '''Submit task to fal.ai queue and return (request_id, response_url) with proper sorting by category'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    sorted_garments = sorted(garments, key=lambda g: 0 if g.get('category') == 'upper_body' else (1 if g.get('category') == 'lower_body' else 2))
    
    person_data = normalize_image_format(person_image)
    garment_data = [normalize_image_format(g['image']) for g in sorted_garments]
    
    print(f'[SeeDream] Image order: 1=Person, 2-{len(garment_data)+1}=Clothes')
    print(f'[SeeDream] Person: {person_image[:50]}...')
    for i, g in enumerate(sorted_garments):
        print(f'[SeeDream] Garment {i+2}: category={g.get("category")}, image={g["image"][:50]}...')
    
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    
    image_urls = [person_data] + garment_data
    
    payload = {
        'image_urls': image_urls,
        'prompt': prompt,
        'num_inference_steps': 30,
        'guidance_scale': 2.5,
        'output_format': 'png',
        'crop_input': False,
        'image_size': {
            'width': 768,
            'height': 1024
        }
    }
    
    response = requests.post(
        'https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit',
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
    Business: Process pending SeeDream tasks from database
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
            FROM seedream_tasks
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
                    sorted_garments = sorted(garments, key=lambda g: 0 if g.get('category') == 'upper_body' else (1 if g.get('category') == 'lower_body' else 2))
                    
                    print(f'[SeeDream] Building prompt with sorted garments:')
                    for i, g in enumerate(sorted_garments):
                        print(f'[SeeDream]   Position {i+2}: category={g.get("category")}')
                    
                    prompt = build_prompt(sorted_garments, prompt_hints or '')
                    print(f'[SeeDream] Final prompt: {prompt}')
                    
                    request_id, response_url = submit_to_fal_queue(person_image, sorted_garments, prompt)
                    
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'processing', fal_request_id = %s, fal_response_url = %s, updated_at = %s
                        WHERE id = %s
                    ''', (request_id, response_url, datetime.utcnow(), task_id))
                    conn.commit()
                    cursor.close()
                    conn.close()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({
                            'message': 'Task submitted to queue',
                            'task_id': task_id,
                            'request_id': request_id
                        })
                    }
                except Exception as e:
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (str(e), datetime.utcnow(), task_id))
                    conn.commit()
                    cursor.close()
                    conn.close()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({
                            'message': 'Task submission failed',
                            'task_id': task_id,
                            'error': str(e)
                        })
                    }
        
        cursor.execute('''
            SELECT id, fal_response_url, user_id
            FROM seedream_tasks
            WHERE status = 'processing' AND fal_response_url IS NOT NULL
            ORDER BY created_at ASC
            LIMIT 10
        ''')
        
        processing_rows = cursor.fetchall()
        
        if not processing_rows:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'No tasks to process'})
            }
        
        results = []
        for task_id, response_url, user_id in processing_rows:
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
                    
                    print(f'[Worker] Task {task_id} completed! Saving result URL: {result_url}')
                    
                    # Save to FTP with user_id subfolder and fitting room number (SeeDream = fitting room 2)
                    saved_url = result_url
                    try:
                        save_response = requests.post(
                            'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8',
                            json={
                                'image_url': result_url,
                                'folder': 'lookbooks',
                                'user_id': user_id,
                                'prefix': '2fitting'
                            },
                            timeout=30
                        )
                        if save_response.status_code == 200:
                            save_data = save_response.json()
                            saved_url = save_data.get('url', result_url)
                            print(f'[Worker] Image saved to FTP: {saved_url}')
                    except Exception as e:
                        print(f'[Worker] FTP save error (using original URL): {e}')
                    
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'completed', result_url = %s, updated_at = %s
                        WHERE id = %s
                    ''', (saved_url, datetime.utcnow(), task_id))
                    conn.commit()
                    print(f'[Worker] Task {task_id} saved to DB as completed')
                    
                    # Save to history with model and cost info
                    try:
                        # Get task details for history
                        cursor.execute('''
                            SELECT person_image, garments FROM seedream_tasks WHERE id = %s
                        ''', (task_id,))
                        task_data = cursor.fetchone()
                        
                        if task_data:
                            garments_list = json.loads(task_data[1]) if isinstance(task_data[1], str) else task_data[1]
                            
                            history_response = requests.post(
                                'https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd',
                                headers={'X-User-Id': user_id},
                                json={
                                    'person_image': task_data[0],
                                    'garments': garments_list,
                                    'result_image': saved_url,
                                    'model_used': 'seedream',
                                    'cost': 0
                                },
                                timeout=10
                            )
                            if history_response.status_code == 201:
                                print(f'[Worker] Saved to history: task {task_id}')
                    except Exception as e:
                        print(f'[Worker] Failed to save to history: {e}')
                    
                    results.append({'task_id': task_id, 'status': 'completed'})
                    
                elif task_status in ['FAILED', 'EXPIRED']:
                    error_raw = status_data.get('error', 'Generation failed')
                    
                    if 'validating the input' in str(error_raw).lower():
                        user_message = 'Ошибка на стороне сервиса генерации. Попробуйте обновить страницу и создать образ заново'
                    elif 'timeout' in str(error_raw).lower():
                        user_message = 'Сервис генерации не ответил вовремя. Попробуйте ещё раз'
                    elif 'rate limit' in str(error_raw).lower():
                        user_message = 'Сервис генерации перегружен. Подождите немного и попробуйте снова'
                    else:
                        user_message = f'Ошибка генерации: {str(error_raw)[:100]}. Попробуйте другие фото или обновите страницу'
                    
                    print(f'[Worker] Task {task_id} failed with fal.ai error: {error_raw}')
                    print(f'[Worker] User-friendly message: {user_message}')
                    
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (user_message, datetime.utcnow(), task_id))
                    conn.commit()
                    results.append({'task_id': task_id, 'status': 'failed', 'reason': 'fal_api_error'})
                else:
                    print(f'[Worker] Task {task_id} still processing, fal.ai status: {task_status}')
                    results.append({'task_id': task_id, 'status': 'still_processing', 'fal_status': task_status})
                    
            except Exception as e:
                print(f'[Worker] Exception checking task {task_id}: {str(e)}')
                results.append({'task_id': task_id, 'error': str(e)})
        
        cursor.close()
        conn.close()
        
        has_still_processing = any(r.get('status') == 'still_processing' for r in results)
        if has_still_processing:
            print('[Worker] Still have processing tasks, triggering next check immediately')
            try:
                import urllib.request
                worker_url = 'https://functions.poehali.dev/339123e0-038a-4b96-8197-101145bcd877'
                req = urllib.request.Request(worker_url, method='GET')
                urllib.request.urlopen(req, timeout=1)
            except:
                pass
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'message': 'Polling completed',
                'results': results
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }