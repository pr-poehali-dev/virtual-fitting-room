import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime
from session_utils import validate_session

COLORGUIDE_COST = 50

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Запуск создания персонального Гида по цвету: анализ внешности и подробные рекомендации
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
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }

    import time
    request_timestamp = time.time()
    request_id = f"{context.request_id[:8]}-{int(request_timestamp * 1000)}"
    print(f'[COLORGUIDE-START-{request_id}] ========== NEW REQUEST ==========')

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }

    print(f'[COLORGUIDE-START-{request_id}] User ID: {user_id}')

    body_data = json.loads(event.get('body', '{}'))
    person_image = body_data.get('person_image')

    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }

    if len(person_image) > 8_000_000:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Фото слишком большое. Попробуйте уменьшить размер изображения.'})
        }

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        cursor.execute('SELECT balance, unlimited_access FROM users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()

        if not user_row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'User not found'})
            }

        balance = float(user_row[0])
        unlimited_access = user_row[1]
        cost = 0 if unlimited_access else COLORGUIDE_COST

        if not unlimited_access:
            if balance < cost:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 402,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Insufficient balance', 'required': cost, 'current': balance})
                }

            cursor.execute('UPDATE users SET balance = balance - %s WHERE id = %s', (cost, user_id))
            print(f'[COLORGUIDE-START-{request_id}] Deducted {cost} rubles from user {user_id}')

        task_id = str(uuid.uuid4())
        print(f'[COLORGUIDE-START-{request_id}] Creating task {task_id}')

        cursor.execute('''
            INSERT INTO color_guide_tasks (id, user_id, status, person_image, cost, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (task_id, user_id, 'pending', person_image, cost, datetime.utcnow()))

        if cost > 0:
            balance_after = balance - cost
            cursor.execute('''
                INSERT INTO balance_transactions
                (user_id, type, amount, balance_before, balance_after, description)
                VALUES (%s, 'charge', %s, %s, %s, 'Гид по цвету')
            ''', (user_id, -cost, balance, balance_after))
            print(f'[COLORGUIDE-START-{request_id}] Recorded balance transaction: -{cost} rubles')
        elif unlimited_access:
            cursor.execute('''
                INSERT INTO balance_transactions
                (user_id, type, amount, balance_before, balance_after, description)
                VALUES (%s, 'charge', 0, %s, %s, 'Гид по цвету (безлимитный доступ)')
            ''', (user_id, balance, balance))
            print(f'[COLORGUIDE-START-{request_id}] Recorded balance transaction: 0 rubles (unlimited)')

        conn.commit()
        cursor.close()
        conn.close()

        # Trigger worker asynchronously (fire-and-forget)
        worker_url = 'https://functions.poehali.dev/12f108e3-fe83-4618-9e8b-48411bb69390'
        try:
            import urllib.request
            req = urllib.request.Request(f'{worker_url}?task_id={task_id}', method='GET')
            urllib.request.urlopen(req, timeout=1)
        except Exception as e:
            # Expected: short timeout because worker runs longer than 1s
            print(f'[COLORGUIDE-START-{request_id}] Worker trigger info: {e}')

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'pending',
                'estimated_time_seconds': 45
            })
        }

    except Exception as e:
        print(f'[COLORGUIDE-START-{request_id}] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }