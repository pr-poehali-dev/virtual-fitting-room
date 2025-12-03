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

def submit_to_fal_queue(person_image: str, garments: list, prompt: str) -> tuple:
    '''Submit task to fal.ai nano-banana-pro queue and return (request_id, response_url)'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    person_data = normalize_image_format(person_image)
    garment_data = [normalize_image_format(g['image']) for g in garments]
    
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'person_image_url': person_data,
        'garment_image_url': garment_data[0] if len(garment_data) == 1 else garment_data,
        'prompt': prompt if prompt else 'High quality virtual try-on result',
        'num_inference_steps': 50,
        'guidance_scale': 7.5,
        'output_format': 'png'
    }
    
    response = requests.post(
        'https://queue.fal.run/fal-ai/nano-banana-pro',
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
                    
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'processing',
                            fal_request_id = %s,
                            fal_response_url = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (request_id, response_url, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    print(f'[NanoBananaPro] Task {task_id} submitted to fal.ai: request_id={request_id}')
                    
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
                result = check_fal_status(response_url)
                
                if result.get('status') == 'COMPLETED':
                    images = result.get('images', [])
                    if images and len(images) > 0:
                        result_url = images[0].get('url')
                        if result_url:
                            cursor.execute('''
                                UPDATE nanobananapro_tasks
                                SET status = 'completed',
                                    result_url = %s,
                                    updated_at = %s
                                WHERE id = %s
                            ''', (result_url, datetime.utcnow(), task_id))
                            conn.commit()
                            print(f'[NanoBananaPro] Task {task_id} completed: {result_url}')
                        else:
                            raise Exception('No result URL in completed response')
                    else:
                        raise Exception('No images in completed response')
                
                elif result.get('status') == 'FAILED':
                    error = result.get('error', {})
                    error_msg = error.get('message', 'Unknown error')
                    
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'failed',
                            error_message = %s,
                            updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    print(f'[NanoBananaPro] Task {task_id} failed: {error_msg}')
                
                else:
                    print(f'[NanoBananaPro] Task {task_id} still processing, status={result.get("status")}')
            
            except Exception as e:
                print(f'[NanoBananaPro] Error checking task {task_id}: {str(e)}')
        
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
