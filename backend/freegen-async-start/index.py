import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime
from session_utils import validate_session
from prompts import build_model_prompt

MAX_REFERENCES = 8
ALLOWED_ASPECT_RATIOS = {'auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'}

MODEL_COST = 50
TRYON_COST = 50
SCHEMA = 't_p29007832_virtual_fitting_room'
REQUIRED_MODEL_FIELDS = ('gender', 'age', 'height', 'body_type')


def _json_response(status: int, body: dict, cors_origin: str) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': cors_origin, 'Access-Control-Allow-Credentials': 'true'},
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False),
    }


def handle_model_start(database_url: str, user_id: str, model_params: dict, cors_origin: str) -> Dict[str, Any]:
    '''Ветка генерации модели по описанию: валидация, проверка баланса, списание 50₽, создание задачи.'''
    missing = [f for f in REQUIRED_MODEL_FIELDS if not str(model_params.get(f) or '').strip()]
    if missing:
        return _json_response(400, {'error': 'Заполните обязательные поля', 'missing': missing}, cors_origin)

    prompt = build_model_prompt(model_params)
    task_id = str(uuid.uuid4())

    conn = psycopg2.connect(database_url)
    try:
        cursor = conn.cursor()
        cursor.execute(f'SELECT balance, unlimited_access FROM {SCHEMA}.users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            return _json_response(404, {'error': 'User not found'}, cors_origin)

        balance = float(user_row[0])
        unlimited_access = user_row[1]

        cursor.execute(f'SELECT COUNT(*) FROM {SCHEMA}.user_models WHERE user_id = %s', (user_id,))
        has_models = (cursor.fetchone()[0] or 0) > 0

        cost = 0 if unlimited_access else MODEL_COST
        # Нужно денег и на модель, и на последующую примерку, кроме случая, когда модели уже есть
        required = MODEL_COST + TRYON_COST
        if not unlimited_access and not has_models and balance < required:
            return _json_response(402, {
                'error': 'Insufficient balance',
                'required': required,
                'current': balance,
                'message': f'Нужно {required}₽: {MODEL_COST} на модель + {TRYON_COST} на примерку',
            }, cors_origin)

        if not unlimited_access and balance < cost:
            return _json_response(402, {'error': 'Insufficient balance', 'required': cost, 'current': balance}, cors_origin)

        if cost > 0:
            balance_after = balance - cost
            cursor.execute(f'UPDATE {SCHEMA}.users SET balance = balance - %s WHERE id = %s', (cost, user_id))
            cursor.execute(f'''
                INSERT INTO {SCHEMA}.balance_transactions
                (user_id, type, amount, balance_before, balance_after, description)
                VALUES (%s, 'charge', %s, %s, %s, %s)
            ''', (user_id, -cost, balance, balance_after, 'Генерация модели по описанию'))

        cursor.execute(f'''
            INSERT INTO {SCHEMA}.freegen_tasks
            (id, user_id, status, prompt, "references", aspect_ratio, task_type, model_params, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            task_id,
            user_id,
            'pending',
            prompt,
            '[]',
            '2:3',
            'model',
            json.dumps(model_params, ensure_ascii=False),
            datetime.utcnow(),
        ))
        conn.commit()
        cursor.close()
    finally:
        conn.close()

    try:
        import urllib.request
        worker_url = f'https://functions.poehali.dev/8b34e115-88be-4740-887a-36c388980955?task_id={task_id}'
        req = urllib.request.Request(worker_url, method='GET')
        urllib.request.urlopen(req, timeout=2)
    except Exception as e:
        print(f'[MODEL-START] Worker trigger failed (non-critical): {e}')

    return _json_response(200, {'task_id': task_id, 'status': 'pending', 'estimated_time_seconds': 30}, cors_origin)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Запуск асинхронной задачи генерации NanoBanana 2 (свободная генерация или модель по описанию)
    Args: event - dict с httpMethod, body (task_type, prompt, references[], aspect_ratio, model_params)
          context - объект с request_id
    Returns: HTTP-ответ с task_id
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
    print(f'[FREEGEN-START-{request_id}] ========== NEW REQUEST ==========')

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

    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'User ID required'})
        }

    body_data = json.loads(event.get('body', '{}'))

    task_type = (body_data.get('task_type') or 'freegen').strip()
    if task_type == 'model':
        model_params = body_data.get('model_params') or {}
        if not isinstance(model_params, dict):
            return _json_response(400, {'error': 'model_params must be an object'}, get_cors_origin(event))
        return handle_model_start(database_url, user_id, model_params, get_cors_origin(event))

    prompt = (body_data.get('prompt') or '').strip()
    references = body_data.get('references') or []
    aspect_ratio = body_data.get('aspect_ratio') or '1:1'

    if not prompt:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'prompt is required'})
        }

    if not isinstance(references, list):
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'references must be an array'})
        }

    if len(references) > MAX_REFERENCES:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Максимум {MAX_REFERENCES} референсов'})
        }

    if aspect_ratio not in ALLOWED_ASPECT_RATIOS:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Недопустимое соотношение сторон'})
        }

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        prompt_prefix = prompt[:100] if len(prompt) > 100 else prompt
        refs_str = json.dumps(references)
        refs_prefix = refs_str[:200] if len(refs_str) > 200 else refs_str

        cursor.execute('''
            SELECT id, created_at FROM freegen_tasks
            WHERE user_id = %s
              AND status IN ('pending', 'processing')
              AND LEFT(prompt, 100) = %s
              AND LEFT("references"::text, 200) = %s
              AND created_at > NOW() - INTERVAL '0.01 seconds'
            ORDER BY created_at DESC
            LIMIT 1
        ''', (user_id, prompt_prefix, refs_prefix))

        existing = cursor.fetchone()

        if existing:
            existing_task_id, existing_created = existing
            print(f'[FREEGEN-START-{request_id}] DEDUPLICATED: existing task {existing_task_id}')
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({
                    'task_id': existing_task_id,
                    'status': 'pending',
                    'estimated_time_seconds': 30,
                    'deduplicated': True
                })
            }

        task_id = str(uuid.uuid4())
        print(f'[FREEGEN-START-{request_id}] New task {task_id} for user {user_id} (refs: {len(references)}, ar: {aspect_ratio})')

        cursor.execute('''
            INSERT INTO freegen_tasks (id, user_id, status, prompt, "references", aspect_ratio, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            task_id,
            user_id,
            'pending',
            prompt,
            json.dumps(references),
            aspect_ratio,
            datetime.utcnow()
        ))

        conn.commit()
        cursor.close()
        conn.close()

        try:
            import urllib.request
            worker_url = f'https://functions.poehali.dev/8b34e115-88be-4740-887a-36c388980955?task_id={task_id}'
            req = urllib.request.Request(worker_url, method='GET')
            urllib.request.urlopen(req, timeout=2)
            print(f'[FREEGEN-START-{request_id}] Worker triggered')
        except Exception as e:
            print(f'[FREEGEN-START-{request_id}] Worker trigger failed (non-critical): {e}')

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'pending',
                'estimated_time_seconds': 30
            })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Error: {str(e)}'})
        }