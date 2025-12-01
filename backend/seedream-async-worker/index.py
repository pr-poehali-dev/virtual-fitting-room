import json
import os
import psycopg2
from typing import Dict, Any, Optional
import base64
import requests
from datetime import datetime

def build_prompt(garments: list, custom_prompt: str) -> str:
    '''Build Russian prompt for SeeDream 4'''
    garment_descriptions = []
    for g in garments:
        category = g.get('category', 'одежда')
        category_map = {
            'upper_body': 'верхнюю одежду',
            'lower_body': 'нижнюю одежду',
            'dresses': 'платье'
        }
        garment_descriptions.append(category_map.get(category, 'одежду'))
    
    base_prompt = f"Перенеси {', '.join(garment_descriptions)} с референсных изображений одежды на человека с фото модели. "
    base_prompt += "ВАЖНО: Сохрани лицо, причёску, телосложение и позу человека с фото модели. Возьми ТОЛЬКО одежду с референсных изображений. "
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

def call_seedream_api_sync(person_image: str, garment_images: list, prompt: str) -> Optional[str]:
    '''Call SeeDream 4 API via fal.ai - direct sync call'''
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
        'https://fal.run/fal-ai/bytedance/seedream/v4/edit',
        headers=headers,
        json=payload,
        timeout=180
    )
    
    if response.status_code == 200:
        result = response.json()
        if 'images' in result and len(result['images']) > 0 and 'url' in result['images'][0]:
            return result['images'][0]['url']
        if 'image' in result and 'url' in result['image']:
            return result['image']['url']
    
    raise Exception(f'SeeDream API error: {response.status_code} - {response.text}')

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
            SELECT id, person_image, garments, prompt_hints
            FROM seedream_tasks
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        ''')
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'No pending tasks'})
            }
        
        task_id, person_image, garments_json, prompt_hints = row
        garments = json.loads(garments_json)
        
        cursor.execute('''
            UPDATE seedream_tasks
            SET status = 'processing', updated_at = %s
            WHERE id = %s
        ''', (datetime.utcnow(), task_id))
        conn.commit()
        
        try:
            garment_images = [g['image'] for g in garments]
            prompt = build_prompt(garments, prompt_hints or '')
            
            result_url = call_seedream_api_sync(person_image, garment_images, prompt)
            
            cursor.execute('''
                UPDATE seedream_tasks
                SET status = 'completed', result_url = %s, updated_at = %s
                WHERE id = %s
            ''', (result_url, datetime.utcnow(), task_id))
            conn.commit()
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({
                    'message': 'Task completed',
                    'task_id': task_id,
                    'result_url': result_url
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
                    'message': 'Task failed',
                    'task_id': task_id,
                    'error': str(e)
                })
            }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }