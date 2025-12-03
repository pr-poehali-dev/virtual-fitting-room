import json
import os
import psycopg2
from typing import Dict, Any, Optional
import requests
from datetime import datetime

def normalize_image_format(image: str) -> str:
    '''Convert image to data URI format if needed'''
    if image.startswith('http://') or image.startswith('https://'):
        return image
    
    if image.startswith('data:'):
        return image
    
    return f'data:image/jpeg;base64,{image}'

def build_prompt(garments: list, custom_prompt: str) -> str:
    '''Build detailed prompt for NanoBananaPro with category instructions'''
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
                base_prompt += f"Image {img_num} has upper_body clothing - take ONLY the top from image {img_num}. "
            elif category == 'lower_body':
                base_prompt += f"Image {img_num} has lower_body clothing - take ONLY the bottom from image {img_num}. "
            else:
                base_prompt += f"Image {img_num} has full outfit from image {img_num}. "
    
    base_prompt += "CRITICAL: Keep EXACT SAME FACE, hairstyle, skin color, body shape, pose, background from image 1. Change ONLY clothing items! "
    
    if custom_prompt:
        base_prompt += f"Additional: {custom_prompt}"
    
    return base_prompt

def submit_to_fal_queue(person_image: str, garments: list, custom_prompt: str) -> tuple:
    '''Submit task to fal.ai nano-banana-pro queue and return (request_id, response_url)'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    person_data = normalize_image_format(person_image)
    garment_data = [normalize_image_format(g['image']) for g in garments]
    
    prompt = build_prompt(garments, custom_prompt)
    print(f'[NanoBananaPro] Final prompt: {prompt}')
    
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    
    image_urls = [person_data] + garment_data
    
    payload = {
        'image_urls': image_urls,
        'prompt': prompt,
        'num_inference_steps': 50,
        'guidance_scale': 7.5,
        'output_format': 'png'
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


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Process pending NanoBananaPro tasks from database
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
            FROM nanobananapro_tasks
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
                    request_id, response_url = submit_to_fal_queue(person_image, garments, prompt_hints or '')
                    print(f'[NanoBananaPro] Task {task_id} submitted to fal.ai: request_id={request_id}')
                    
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
                    print(f'[NanoBananaPro] Failed to submit task {task_id}: {error_msg}')
                    
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'failed',
                            error_message = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
        
        cursor.execute('''
            SELECT id, fal_response_url
            FROM nanobananapro_tasks
            WHERE status = 'processing' AND fal_response_url IS NOT NULL
            ORDER BY created_at ASC
            LIMIT 5
        ''')
        
        processing_rows = cursor.fetchall()
        
        for task_id, response_url in processing_rows:
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
                    
                    print(f'[NanoBananaPro] Task {task_id} completed! Result URL: {result_url}')
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'completed',
                            result_url = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (result_url, datetime.utcnow(), task_id))
                    conn.commit()
                    print(f'[NanoBananaPro] Task {task_id} saved to DB as completed')
                
                elif task_status in ['FAILED', 'EXPIRED']:
                    error_raw = status_data.get('error', 'Generation failed')
                    error_msg = f'Ошибка генерации: {str(error_raw)[:100]}'
                    
                    print(f'[NanoBananaPro] Task {task_id} failed: {error_raw}')
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'failed',
                            error_message = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                
                else:
                    print(f'[NanoBananaPro] Task {task_id} still processing, status={task_status}')
            
            except Exception as e:
                error_str = str(e)
                if 'still in progress' in error_str.lower():
                    print(f'[NanoBananaPro] Task {task_id} still processing (in progress)')
                else:
                    print(f'[NanoBananaPro] Error checking task {task_id}: {error_str}')
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'status': 'worker_completed'})
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }