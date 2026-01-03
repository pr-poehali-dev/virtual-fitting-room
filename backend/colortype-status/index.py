import json
import os
import psycopg2
import requests
from typing import Dict, Any
from datetime import datetime

def check_replicate_status(prediction_id: str) -> dict:
    '''Check status directly on Replicate API'''
    replicate_api_key = os.environ.get('REPLICATE_API_TOKEN')
    if not replicate_api_key:
        raise Exception('REPLICATE_API_TOKEN not configured')
    
    headers = {
        'Authorization': f'Bearer {replicate_api_key}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        f'https://api.replicate.com/v1/predictions/{prediction_id}',
        headers=headers,
        timeout=10
    )
    
    if response.status_code == 200:
        return response.json()
    
    raise Exception(f'Failed to check status: {response.status_code}')

def extract_color_type(result_text: str) -> str:
    '''Extract color type name from result text'''
    color_types = [
        'SOFT WINTER', 'BRIGHT WINTER', 'VIVID WINTER',
        'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER',
        'GENTLE AUTUMN', 'FIERY AUTUMN', 'VIVID AUTUMN',
        'GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING'
    ]
    
    result_upper = result_text.upper()
    for color_type in color_types:
        if color_type in result_upper:
            return color_type
    
    return None

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Проверка статуса анализа цветотипа с опциональной принудительной проверкой
    Args: event - dict с httpMethod, queryStringParameters (task_id, force_check)
          context - object с атрибутом request_id
    Returns: HTTP response со статусом задачи и результатом если готово
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
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    params = event.get('queryStringParameters', {}) or {}
    print(f'[ColorType-Status] Query params: {params}')
    task_id = params.get('task_id')
    force_check = params.get('force_check') == 'true'
    print(f'[ColorType-Status] task_id={task_id}, force_check={force_check}')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id is required'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT status, result_text, color_type, replicate_prediction_id
            FROM color_type_history
            WHERE id = %s
        ''', (task_id,))
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        status, result_text, color_type, replicate_prediction_id = row
        
        # Trigger worker on force_check to process task
        if force_check and status in ['pending', 'processing']:
            print(f'[ColorType-Status] Triggering worker for task {task_id}')
            try:
                import urllib.request
                worker_url = f'https://functions.poehali.dev/c13ce63e-ae23-419d-84f1-b6958e4ea586?task_id={task_id}'
                req = urllib.request.Request(worker_url, method='GET')
                urllib.request.urlopen(req, timeout=2)
                print(f'[ColorType-Status] Worker triggered')
            except Exception as e:
                print(f'[ColorType-Status] Worker trigger failed (non-critical): {e}')
        
        if force_check and status == 'processing' and replicate_prediction_id:
            print(f'[ColorType-Status] Force checking task {task_id} on Replicate')
            try:
                replicate_data = check_replicate_status(replicate_prediction_id)
                replicate_status = replicate_data.get('status', 'unknown')
                
                print(f'[ColorType-Status] Replicate status: {replicate_status}')
                
                if replicate_status == 'succeeded':
                    output = replicate_data.get('output', '')
                    
                    # Extract text from output (Replicate BAGEL returns dict or list)
                    if isinstance(output, dict):
                        result_text_value = output.get('text', str(output))
                    elif isinstance(output, list) and len(output) > 0:
                        result_text_value = output[0] if isinstance(output[0], str) else str(output[0])
                    elif isinstance(output, str):
                        result_text_value = output
                    else:
                        result_text_value = str(output)
                    
                    if result_text_value:
                        # Extract color type from text
                        extracted_color_type = extract_color_type(result_text_value)
                        print(f'[ColorType-Status] Task completed! Color type: {extracted_color_type}')
                        print(f'[ColorType-Status] Result preview: {result_text_value[:100]}...')
                        
                        cursor.execute('''
                            UPDATE color_type_history
                            SET status = 'completed', result_text = %s, color_type = %s, updated_at = %s
                            WHERE id = %s
                        ''', (result_text_value, extracted_color_type, datetime.utcnow(), task_id))
                        conn.commit()
                        
                        status = 'completed'
                        result_text = result_text_value
                        color_type = extracted_color_type
                        print(f'[ColorType-Status] DB updated successfully')
                    
                elif replicate_status == 'failed':
                    error_msg = replicate_data.get('error', 'Analysis failed')
                    print(f'[ColorType-Status] Task failed: {error_msg}')
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'failed', result_text = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    status = 'failed'
                    result_text = error_msg
                
            except Exception as e:
                print(f'[ColorType-Status] Force check error: {str(e)}')
        
        cursor.close()
        conn.close()
        
        response_data = {
            'task_id': task_id,
            'status': status,
            'result_text': result_text,
            'color_type': color_type
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        print(f'[ColorType-Status] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }