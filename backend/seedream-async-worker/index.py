import json
import os
import psycopg2
from typing import Dict, Any, Optional
import base64
import requests
from datetime import datetime

def build_prompt(garments: list, custom_prompt: str) -> str:
    '''Build clear prompt for SeeDream 4 with category specification'''
    if len(garments) == 1:
        category = garments[0].get('category', 'одежда')
        if category == 'dresses':
            base_prompt = "Image 1 = person model. Image 2 = dress reference. Put ONLY the dress from image 2 onto the person from image 1. "
        elif category == 'upper_body':
            base_prompt = "Image 1 = person model. Image 2 = top clothing reference (shirt/blouse/jacket). Put ONLY the top from image 2 onto the person from image 1. Keep original bottom (pants/skirt) from image 1. "
        else:
            base_prompt = "Image 1 = person model. Image 2 = bottom clothing reference (pants/skirt/shorts). Put ONLY the bottom from image 2 onto the person from image 1. Keep original top (shirt/blouse) from image 1. "
    else:
        base_prompt = "Image 1 = person model. Image 2 = top clothing (shirt/blouse). Image 3 = bottom clothing (pants/skirt). Put top from image 2 AND bottom from image 3 onto person from image 1. "
    
    base_prompt += "CRITICAL: From image 1 (person) keep EVERYTHING - exact face, hairstyle, skin color, body shape, height, body proportions, shoulders width, waist size, hips size, leg length, pose, background, lighting. Change ONLY clothing! "
    base_prompt += "STRICT RULE: DO NOT take body/face/pose from images 2 or 3. Those images are ONLY clothing reference, NOT body reference. The clothing must adapt to the body from image 1, not vice versa. "
    
    if custom_prompt:
        base_prompt += f"Additional: {custom_prompt}"
    
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
        'crop_input': False
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
                        result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            result_url = status_data['image']['url']
                        else:
                            result_url = status_data['image']
                    else:
                        raise Exception('No image in response')
                    
                    cursor.execute('''
                        UPDATE seedream_tasks
                        SET status = 'completed', result_url = %s, updated_at = %s
                        WHERE id = %s
                    ''', (result_url, datetime.utcnow(), task_id))
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