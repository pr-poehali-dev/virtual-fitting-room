import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime
from session_utils import validate_session

COLORGUIDE_COST = 50

ALLOWED_SLUGS = [
    'bright-spring', 'bright-winter', 'dusty-summer', 'fiery-autumn',
    'gentle-autumn', 'gentle-spring', 'soft-summer', 'soft-winter',
    'vibrant-spring', 'vivid-autumn', 'vivid-summer', 'vivid-winter'
]

ALLOWED_SERVICE_TYPES = ['colorguide', 'style', 'outfit']
SERVICE_LABELS = {
    'colorguide': 'Гид по цвету',
    'style': 'Стилевой анализ внешности',
    'outfit': 'Подбор образа',
}
# Стоимость по типу сервиса. 'outfit' — премиальный, легко поднять цену здесь.
SERVICE_COSTS = {
    'colorguide': 50,
    'style': 50,
    'outfit': 100,
}

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
    service_type = body_data.get('service_type', 'colorguide')
    if service_type not in ALLOWED_SERVICE_TYPES:
        service_type = 'colorguide'
    height = body_data.get('height')
    try:
        height = int(height) if height not in (None, '') else None
        if height is not None and (height < 100 or height > 250):
            height = None
    except (ValueError, TypeError):
        height = None
    service_label = SERVICE_LABELS.get(service_type, 'Гид по цвету')

    # Параметры формы (для сервиса 'outfit'): необязательный JSON-объект.
    form_params = body_data.get('form_params')
    if not isinstance(form_params, dict):
        form_params = None
    form_params_json = json.dumps(form_params, ensure_ascii=False) if form_params else None

    # Объединённый поток: если цветотип уже определён на шаге /colortype,
    # передаём готовый slug — worker не определяет его заново.
    def _norm_slug(value):
        if not value:
            return None
        s = str(value).strip().lower().replace('_', '-').replace(' ', '-')
        return s if s in ALLOWED_SLUGS else None

    forced_slug = _norm_slug(body_data.get('colortype_slug'))
    # Второй кандидат (при расхождении ИИ и формулы). Если задан и отличается от
    # первого — worker даст Gemini выбрать один из двух по фото.
    forced_slug_alt = _norm_slug(body_data.get('colortype_slug_alt'))
    if forced_slug_alt == forced_slug:
        forced_slug_alt = None
    # skip_charge — не списывать повторно (оплата уже была на шаге определения цветотипа).
    # Доверять фронту нельзя: ниже проверяем реальную оплаченную задачу цветотипа.
    skip_charge_requested = bool(body_data.get('skip_charge')) and forced_slug is not None

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

        # Проверяем право на бесплатный гид-«довесок» к уже оплаченному цветотипу.
        # Защита от обхода оплаты: фронту не доверяем — проверяем реальную свежую
        # оплаченную (cost > 0 ИЛИ unlimited) и успешную задачу цветотипа с тем же slug.
        free_followup = False
        if skip_charge_requested and service_type == 'colorguide':
            # Кандидаты должны соответствовать слугам свежей записи цветотипа
            # (формула color_type ИЛИ ИИ color_type_ai).
            cand_slugs = [s for s in (forced_slug, forced_slug_alt) if s]
            cursor.execute('''
                SELECT 1 FROM color_type_history
                WHERE user_id = %s
                  AND status = 'completed'
                  AND created_at > NOW() - INTERVAL '30 minutes'
                  AND (
                        lower(replace(color_type, ' ', '-')) = ANY(%s)
                     OR lower(replace(color_type_ai, ' ', '-')) = ANY(%s)
                  )
                LIMIT 1
            ''', (str(user_id), cand_slugs, cand_slugs))
            if cursor.fetchone():
                free_followup = True
                print(f'[COLORGUIDE-START-{request_id}] Free follow-up guide for slugs {cand_slugs}')
            else:
                print(f'[COLORGUIDE-START-{request_id}] skip_charge requested but no paid colortype found — charging normally')

        cost = 0 if (unlimited_access or free_followup) else SERVICE_COSTS.get(service_type, COLORGUIDE_COST)

        if not unlimited_access and not free_followup:
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
            INSERT INTO color_guide_tasks (id, user_id, status, person_image, cost, created_at, service_type, height, form_params, forced_colortype_slug, forced_colortype_slug_alt)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (task_id, user_id, 'pending', person_image, cost, datetime.utcnow(), service_type, height, form_params_json, forced_slug, forced_slug_alt))

        if cost > 0:
            balance_after = balance - cost
            cursor.execute('''
                INSERT INTO balance_transactions
                (user_id, type, amount, balance_before, balance_after, description)
                VALUES (%s, 'charge', %s, %s, %s, %s)
            ''', (user_id, -cost, balance, balance_after, service_label))
            print(f'[COLORGUIDE-START-{request_id}] Recorded balance transaction: -{cost} rubles')
        elif unlimited_access:
            cursor.execute('''
                INSERT INTO balance_transactions
                (user_id, type, amount, balance_before, balance_after, description)
                VALUES (%s, 'charge', 0, %s, %s, %s)
            ''', (user_id, balance, balance, f'{service_label} (безлимитный доступ)'))
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
                'service_type': service_type,
                'estimated_time_seconds': 120 if service_type != 'colorguide' else 45
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