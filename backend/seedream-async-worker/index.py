import json
import os
import psycopg2
from typing import Dict, Any, Optional
import base64
import requests
from datetime import datetime

def build_prompt(garments: list, custom_prompt: str) -> str:
    '''Build Russian prompt for SeeDream 4'''
    if len(garments) == 1:
        category = garments[0].get('category', 'одежда')
        if category == 'dresses':
            base_prompt = "Надень на модель с первого изображения всю одежду со второго изображения (референс). "
        elif category == 'upper_body':
            base_prompt = "Надень на модель с первого изображения верхнюю одежду (топ, блузку, рубашку, жакет) со второго изображения (референс). Не меняй низ (брюки, юбку) с фото модели. "
        else:
            base_prompt = "Надень на модель с первого изображения нижнюю одежду (брюки, юбку, шорты) со второго изображения (референс). Не меняй верх (топ, блузку, рубашку) с фото модели. "
    else:
        base_prompt = "Надень на модель с первого изображения верхнюю одежду (топ, блузку, рубашку, жакет) со второго изображения И нижнюю одежду (брюки, юбку, шорты) с третьего изображения. "
        base_prompt += "ВАЖНО: Второе изображение — это ТОЛЬКО верх (upper_body). Третье изображение — это ТОЛЬКО низ (lower_body). Не смешивай элементы одежды между референсами. "
    
    base_prompt += "КРИТИЧНО: Сохрани ВСЁ от модели (первое изображение): лицо, волосы, цвет кожи, телосложение, рост, комплекцию, позу, фон. Меняется ТОЛЬКО одежда! "
    base_prompt += "КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО брать фигуру или позу с референсов одежды (второе/третье изображение). Используй ТОЛЬКО тело модели с первого фото. "
    base_prompt += "Одежда должна естественно сидеть на СУЩЕСТВУЮЩЕМ теле модели, сохраняя все её физические параметры. "
    
    if custom_prompt:
        base_prompt += f"Дополнительно: {custom_prompt}"
    
    return base_prompt

def normalize_image_format(image: str) -> str:
    '''Normalize image to data URI format for fal.ai'''
    if image.startswith('http://') or image.startswith('https://'):
        return image
    
    if not image.startswith('data:'):
        return f'data:image/jpeg;base64,{image}'
    
    return image

def submit_to_fal_queue(person_image: str, garments: list, prompt: str) -> tuple:
    '''Submit task to fal.ai queue and return (request_id, response_url) with proper sorting by category'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    sorted_garments = sorted(garments, key=lambda g: 0 if g.get('category') == 'upper_body' else (1 if g.get('category') == 'lower_body' else 2))
    
    person_data = normalize_image_format(person_image)
    garment_data = [normalize_image_format(g['image']) for g in sorted_garments]
    
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    
    image_urls = [person_data] + garment_data
    
    payload = {
        'image_urls': image_urls,
        'prompt': prompt,
        'num_inference_steps': 30,
        'guidance_scale': 2.5
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

def save_to_s3(image_url: str, task_id: str) -> str:
    '''Save fal.ai image to Yandex S3 and return public URL'''
    save_image_api = 'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8'
    
    response = requests.post(
        save_image_api,
        json={
            'image_url': image_url,
            'folder': 'catalog',
            'user_id': task_id
        },
        timeout=60
    )
    
    if response.status_code == 200:
        data = response.json()
        return data['url']
    
    raise Exception(f'Failed to save to S3: {response.status_code} - {response.text}')

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
            SELECT id, person_image, garments, prompt_hints, fal_request_id, fal_response_url
            FROM seedream_tasks
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        ''')
        
        pending_row = cursor.fetchone()
        
        if pending_row:
            task_id, person_image, garments_json, prompt_hints, fal_request_id, fal_response_url = pending_row
            garments = json.loads(garments_json)
            
            if not fal_request_id:
                try:
                    prompt = build_prompt(garments, prompt_hints or '')
                    
                    request_id, response_url = submit_to_fal_queue(person_image, garments, prompt)
                    
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
            SELECT id, fal_response_url
            FROM seedream_tasks
            WHERE status = 'processing' AND fal_response_url IS NOT NULL
            ORDER BY created_at ASC
            LIMIT 5
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
        for task_id, response_url in processing_rows:
            try:
                status_data = check_fal_status(response_url)
                
                task_status = status_data.get('status', status_data.get('state', 'UNKNOWN'))
                
                if task_status == 'COMPLETED' or 'images' in status_data or 'image' in status_data:
                    if 'images' in status_data and len(status_data['images']) > 0:
                        fal_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            fal_url = status_data['image']['url']
                        else:
                            fal_url = status_data['image']
                    else:
                        raise Exception('No image in response')
                    
                    s3_url = save_to_s3(fal_url, task_id)
                    
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'completed', result_url = %s, updated_at = %s
                        WHERE id = %s
                    ''', (s3_url, datetime.utcnow(), task_id))
                    conn.commit()
                    results.append({'task_id': task_id, 'status': 'completed'})
                    
                elif task_status in ['FAILED', 'EXPIRED']:
                    error_msg = status_data.get('error', 'Generation failed')
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    results.append({'task_id': task_id, 'status': 'failed'})
                else:
                    results.append({'task_id': task_id, 'status': 'still_processing', 'fal_status': task_status})
                    
            except Exception as e:
                results.append({'task_id': task_id, 'error': str(e)})
        
        cursor.close()
        conn.close()
        
        has_still_processing = any(r.get('status') == 'still_processing' for r in results)
        if has_still_processing:
            import time
            time.sleep(5)
            try:
                import urllib.request
                worker_url = 'https://functions.poehali.dev/339123e0-038a-4b96-8197-101145bcd877'
                req = urllib.request.Request(worker_url, method='GET')
                urllib.request.urlopen(req, timeout=2)
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