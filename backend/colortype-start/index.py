import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Запуск анализа цветотипа внешности и возврат task_id без ожидания результата
    Args: event - dict с httpMethod, body (person_image)
          context - object с атрибутом request_id
    Returns: HTTP response с task_id
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    import time
    request_timestamp = time.time()
    request_id = f"{context.request_id[:8]}-{int(request_timestamp * 1000)}"
    print(f'[COLORTYPE-START-{request_id}] ========== NEW REQUEST ==========')
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    print(f'[COLORTYPE-START-{request_id}] User ID: {user_id}')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'User ID required'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    person_image = body_data.get('person_image')
    
    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Check user balance
        cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
        balance_row = cursor.fetchone()
        
        if not balance_row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'User not found'})
            }
        
        balance = balance_row[0]
        cost = 30
        
        if balance < cost:
            cursor.close()
            conn.close()
            return {
                'statusCode': 402,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Insufficient balance', 'required': cost, 'current': balance})
            }
        
        # Deduct balance
        cursor.execute('UPDATE users SET balance = balance - %s WHERE id = %s', (cost, user_id))
        print(f'[COLORTYPE-START-{request_id}] Deducted {cost} rubles from user {user_id}')
        
        # Create task
        task_id = str(uuid.uuid4())
        print(f'[COLORTYPE-START-{request_id}] Creating task {task_id}')
        
        cursor.execute('''
            INSERT INTO color_type_history (id, user_id, status, person_image, created_at)
            VALUES (%s, %s, %s, %s, %s)
        ''', (
            task_id,
            user_id,
            'pending',
            person_image,
            datetime.utcnow()
        ))
        
        conn.commit()
        print(f'[COLORTYPE-START-{request_id}] Task {task_id} saved to database')
        cursor.close()
        conn.close()
        
        # Trigger worker
        try:
            import urllib.request
            worker_url = f'https://functions.poehali.dev/{{WORKER_FUNCTION_ID}}?task_id={task_id}'
            req = urllib.request.Request(worker_url, method='GET')
            urllib.request.urlopen(req, timeout=2)
            print(f'[COLORTYPE-START-{request_id}] Worker triggered for task {task_id}')
        except Exception as e:
            print(f'[COLORTYPE-START-{request_id}] Worker trigger failed (non-critical): {e}')
        
        print(f'[COLORTYPE-START-{request_id}] ========== REQUEST COMPLETED ==========')
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'pending',
                'estimated_time_seconds': 60
            })
        }
        
    except Exception as e:
        print(f'[COLORTYPE-START-{request_id}] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }
