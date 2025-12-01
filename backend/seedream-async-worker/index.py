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
        base_prompt = "Надень на модель с первого изображения верхнюю одежду со второго изображения (референс верха) И нижнюю одежду с третьего изображения (референс низа). "
        base_prompt += "ВАЖНО: Верх бери ТОЛЬКО со второго фото, низ бери ТОЛЬКО с третьего фото. Не смешивай элементы одежды между референсами. "
    
    base_prompt += "КРИТИЧНО: Сохрани лицо, причёску, телосложение и позу человека ТОЛЬКО с первого изображения (модель). НЕЛЬЗЯ менять лицо модели! "
    base_prompt += "Сохрани естественную посадку одежды на теле, правильные пропорции и реалистичное освещение. "
    
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

def submit_to_fal_queue(person_image: str, garment_images: list, prompt: str) -> str:
    '''Submit task to fal.ai queue and return request_id'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    person_data = normalize_image_format(person_image)
    garment_data = [normalize_image_format(img) for img in garment_images]
    
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
        if 'request_id' in result:
            return result['request_id']
    
    raise Exception(f'Failed to submit to queue: {response.status_code} - {response.text}')

def check_fal_status(request_id: str) -> Optional[dict]:
    '''Check status of fal.ai request'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    headers = {
        'Authorization': f'Key {fal_api_key}'
    }
    
    response = requests.get(
        f'https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit/requests/{request_id}/status',
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
            SELECT id, person_image, garments, prompt_hints, fal_request_id
            FROM seedream_tasks
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        ''')
        
        pending_row = cursor.fetchone()
        
        if pending_row:
            task_id, person_image, garments_json, prompt_hints, fal_request_id = pending_row
            garments = json.loads(garments_json)
            
            if not fal_request_id:
                try:
                    garment_images = [g['image'] for g in garments]
                    prompt = build_prompt(garments, prompt_hints or '')
                    
                    request_id = submit_to_fal_queue(person_image, garment_images, prompt)
                    
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'processing', fal_request_id = %s, updated_at = %s
                        WHERE id = %s
                    ''', (request_id, datetime.utcnow(), task_id))
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
            SELECT id, fal_request_id
            FROM seedream_tasks
            WHERE status = 'processing' AND fal_request_id IS NOT NULL
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
        for task_id, request_id in processing_rows:
            try:
                status_data = check_fal_status(request_id)
                
                if status_data['status'] == 'COMPLETED':
                    if 'images' in status_data and len(status_data['images']) > 0:
                        result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        result_url = status_data['image']['url']
                    else:
                        raise Exception('No image in response')
                    
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'completed', result_url = %s, updated_at = %s
                        WHERE id = %s
                    ''', (result_url, datetime.utcnow(), task_id))
                    conn.commit()
                    results.append({'task_id': task_id, 'status': 'completed'})
                    
                elif status_data['status'] in ['FAILED', 'EXPIRED']:
                    error_msg = status_data.get('error', 'Generation failed')
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    results.append({'task_id': task_id, 'status': 'failed'})
                else:
                    results.append({'task_id': task_id, 'status': 'still_processing'})
                    
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