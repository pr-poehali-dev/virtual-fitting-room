import json
import os
import base64
import re
import urllib.request
import urllib.error
from typing import Dict, Any
from datetime import datetime
import psycopg2
import boto3


ALLOWED_SLUGS = [
    'bright-spring', 'bright-winter', 'dusty-summer', 'fiery-autumn',
    'gentle-autumn', 'gentle-spring', 'soft-summer', 'soft-winter',
    'vibrant-spring', 'vivid-autumn', 'vivid-summer', 'vivid-winter'
]

SLUG_SYNONYMS = {
    'bright spring': 'bright-spring',
    'bright_spring': 'bright-spring',
    'яркая весна': 'vibrant-spring',
    'живая весна': 'vibrant-spring',
    'vibrant spring': 'vibrant-spring',
    'vibrant_spring': 'vibrant-spring',
    'bright winter': 'bright-winter',
    'bright_winter': 'bright-winter',
    'яркая зима': 'bright-winter',
    'живая зима': 'vivid-winter',
    'vivid winter': 'vivid-winter',
    'vivid_winter': 'vivid-winter',
    'dusty summer': 'dusty-summer',
    'dusty_summer': 'dusty-summer',
    'пыльное лето': 'dusty-summer',
    'мягкое лето': 'soft-summer',
    'soft summer': 'soft-summer',
    'soft_summer': 'soft-summer',
    'яркое лето': 'vivid-summer',
    'vivid summer': 'vivid-summer',
    'vivid_summer': 'vivid-summer',
    'gentle spring': 'gentle-spring',
    'gentle_spring': 'gentle-spring',
    'мягкая весна': 'gentle-spring',
    'gentle autumn': 'gentle-autumn',
    'gentle_autumn': 'gentle-autumn',
    'мягкая осень': 'gentle-autumn',
    'soft winter': 'soft-winter',
    'soft_winter': 'soft-winter',
    'мягкая зима': 'soft-winter',
    'fiery autumn': 'fiery-autumn',
    'fiery_autumn': 'fiery-autumn',
    'огненная осень': 'fiery-autumn',
    'vivid autumn': 'vivid-autumn',
    'vivid_autumn': 'vivid-autumn',
    'яркая осень': 'vivid-autumn',
}


def normalize_slug(raw_slug: str, fallback_name: str = '') -> str:
    if not raw_slug:
        raw_slug = ''
    s = raw_slug.strip().lower().replace('_', '-').replace(' ', '-')
    if s in ALLOWED_SLUGS:
        return s
    s_spaces = raw_slug.strip().lower().replace('_', ' ').replace('-', ' ')
    if s_spaces in SLUG_SYNONYMS:
        return SLUG_SYNONYMS[s_spaces]
    if fallback_name:
        fn = fallback_name.strip().lower()
        if fn in SLUG_SYNONYMS:
            return SLUG_SYNONYMS[fn]
    return ''


PROMPT_TEMPLATE = '''Ты профессиональный имидж-стилист.
Проанализируй внешность человека на фото и определи цветотип по расширенной 12-сезонной системе. Выбери СТРОГО ОДИН из 12 типов ниже и используй РОВНО тот slug, который указан.

В скобках после нашего названия приведено общепринятое название из системы Sci\\ART / David Kibbe — ориентируйся на критерии этих типов из своих знаний. ВАЖНО: возвращай НАШ slug, а не Sci\\ART название.

ВЕСНА (тёплый подтон):
- Gentle Spring (gentle-spring) = Light Spring в Sci\\ART — светлый, едва тёплый, низкий контраст, мягкая ясность
- Vibrant Spring (vibrant-spring) = Bright Spring в Sci\\ART — яркий, чистый, насыщенный, высокий контраст, тёплый оттенок
- Bright Spring (bright-spring) = True Spring / Warm Spring в Sci\\ART — отчётливо тёплый, золотистый, средняя яркость, средний контраст

ЛЕТО (холодный / нейтрально-холодный подтон):
- Soft Summer (soft-summer) = Light Summer в Sci\\ART — холодный, светлый, мягкий, низкий контраст
- Vivid Summer (vivid-summer) = True Summer / Cool Summer в Sci\\ART — отчётливо холодный, средне-светлый, приглушённый
- Dusty Summer (dusty-summer) = Soft Summer в Sci\\ART — нейтрально-холодный, дымчатый, очень приглушённый, низкий контраст

ОСЕНЬ (тёплый подтон):
- Gentle Autumn (gentle-autumn) = Soft Autumn в Sci\\ART — нейтрально-тёплый, приглушённый, низкий контраст
- Fiery Autumn (fiery-autumn) = True Autumn / Warm Autumn в Sci\\ART — отчётливо тёплый, насыщенный, золотисто-рыжий, средний контраст
- Vivid Autumn (vivid-autumn) = Dark Autumn / Deep Autumn в Sci\\ART — глубокий, тёмный, тёплый, высокий контраст

ЗИМА (холодный подтон):
- Vivid Winter (vivid-winter) = Dark Winter / Deep Winter в Sci\\ART — глубокий, тёмный, нейтрально-холодный, высокий контраст
- Soft Winter (soft-winter) = True Winter / Cool Winter в Sci\\ART — отчётливо холодный, ясный, очень высокий контраст
- Bright Winter (bright-winter) = Bright Winter в Sci\\ART — яркий, чистый, нейтрально-холодный, очень высокий контраст

Опирайся ТОЛЬКО на свои знания и фото — не выдумывай того, чего не видно. Анализируй: подтон кожи (тёплый/холодный/нейтральный), насыщенность пигмента (яркий/приглушённый), глубину (светлый/тёмный), контраст между кожей, волосами и глазами.

Составь полный персональный гид по цвету. Все тексты — на русском языке.

ВАЖНО для hair_colors (цвета волос):
Волосы бывают только в естественной гамме: блонд, русый, шатен, каштан, чёрный, рыжий, седой. НЕ используй зелёные, синие, фиолетовые или серо-зелёные оттенки в hex для волос — это противоречит реальности.

Подсказки:
- appearance.undertone: "холодный", "тёплый" или "нейтральный"
- appearance.contrast: "низкий", "средний" или "высокий"
- main_palette: 12 цветов одежды, идущих цветотипу
- avoid_palette: 6 цветов одежды, которых избегать
- makeup: по 3 оттенка помады, румян, теней
- metals.recommended/avoid: золото / серебро / розовое золото / медь
- capsules: 4-6 готовых образов (например, "Повседневный", "Деловой", "Вечерний"), в каждом 3-4 цвета
- tips.wear: 5-7 советов что носить (фасоны, ткани, принты), tips.avoid: 3-5 чего избегать
'''


def get_cors_origin(event):
    origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
    allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
    return origin if origin in allowed_origins else 'https://fitting-room.ru'


def cors_headers(event):
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': get_cors_origin(event),
        'Access-Control-Allow-Credentials': 'true'
    }


def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)


def upload_to_s3(image_data_url: str, task_id: str, user_id: str) -> str:
    """Загружает base64 фото в Яндекс Object Storage, возвращает CDN URL"""
    match = re.match(r'data:image/(\w+);base64,(.+)', image_data_url)
    if not match:
        raise ValueError('Invalid image data URL')
    ext = match.group(1)
    if ext == 'jpeg':
        ext = 'jpg'
    image_bytes = base64.b64decode(match.group(2))

    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')

    s3 = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key
    )
    s3_key = f'images/colorguide/{user_id}/{task_id}.{ext}'
    content_type = f'image/{ext if ext != "jpg" else "jpeg"}'
    s3.put_object(Bucket=s3_bucket, Key=s3_key, Body=image_bytes, ContentType=content_type)
    return f'https://storage.yandexcloud.net/{s3_bucket}/{s3_key}'


HEX_PATTERN = '^#[0-9A-Fa-f]{6}$'

COLOR_ITEM_SCHEMA = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'hex': {'type': 'string', 'pattern': HEX_PATTERN}
    },
    'required': ['name', 'hex'],
    'additionalProperties': False
}

RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'colortype_slug': {'type': 'string', 'enum': ALLOWED_SLUGS},
        'colortype_name': {'type': 'string'},
        'short_description': {'type': 'string'},
        'appearance': {
            'type': 'object',
            'properties': {
                'undertone': {'type': 'string'},
                'contrast': {'type': 'string'},
                'characteristics': {
                    'type': 'array',
                    'items': {'type': 'string'},
                    'minItems': 3,
                    'maxItems': 5
                }
            },
            'required': ['undertone', 'contrast', 'characteristics'],
            'additionalProperties': False
        },
        'main_palette': {
            'type': 'array',
            'items': COLOR_ITEM_SCHEMA,
            'minItems': 12,
            'maxItems': 12
        },
        'avoid_palette': {
            'type': 'array',
            'items': COLOR_ITEM_SCHEMA,
            'minItems': 6,
            'maxItems': 6
        },
        'makeup': {
            'type': 'object',
            'properties': {
                'lipstick': {'type': 'array', 'items': COLOR_ITEM_SCHEMA, 'minItems': 3, 'maxItems': 3},
                'blush': {'type': 'array', 'items': COLOR_ITEM_SCHEMA, 'minItems': 3, 'maxItems': 3},
                'eyeshadow': {'type': 'array', 'items': COLOR_ITEM_SCHEMA, 'minItems': 3, 'maxItems': 3}
            },
            'required': ['lipstick', 'blush', 'eyeshadow'],
            'additionalProperties': False
        },
        'metals': {
            'type': 'object',
            'properties': {
                'recommended': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 1},
                'avoid': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 1}
            },
            'required': ['recommended', 'avoid'],
            'additionalProperties': False
        },
        'hair_colors': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                    'hex': {'type': 'string', 'pattern': HEX_PATTERN},
                    'description': {'type': 'string'}
                },
                'required': ['name', 'hex', 'description'],
                'additionalProperties': False
            },
            'minItems': 3,
            'maxItems': 4
        },
        'capsules': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                    'colors': {
                        'type': 'array',
                        'items': {'type': 'string', 'pattern': HEX_PATTERN},
                        'minItems': 3,
                        'maxItems': 4
                    }
                },
                'required': ['name', 'colors'],
                'additionalProperties': False
            },
            'minItems': 4,
            'maxItems': 6
        },
        'tips': {
            'type': 'object',
            'properties': {
                'wear': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 7},
                'avoid': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 5}
            },
            'required': ['wear', 'avoid'],
            'additionalProperties': False
        }
    },
    'required': [
        'colortype_slug', 'colortype_name', 'short_description', 'appearance',
        'main_palette', 'avoid_palette', 'makeup', 'metals', 'hair_colors', 'capsules', 'tips'
    ],
    'additionalProperties': False
}


def call_gemini_once(image_url: str, prompt: str) -> Dict[str, Any]:
    """Один запрос к Gemini через OpenRouter с строгой JSON-схемой"""
    api_key = os.environ.get('OPENROUTER_API_KEY_NEW') or os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        raise RuntimeError('OPENROUTER_API_KEY not configured')

    payload = {
        'model': 'google/gemini-2.5-flash',
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'image_url', 'image_url': {'url': image_url}},
                    {'type': 'text', 'text': prompt}
                ]
            }
        ],
        'max_tokens': 6000,
        'temperature': 0.3,
        'response_format': {
            'type': 'json_schema',
            'json_schema': {
                'name': 'color_guide_result',
                'strict': True,
                'schema': RESPONSE_SCHEMA
            }
        }
    }

    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://fitting-room.ru',
            'X-Title': 'Color Guide'
        },
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        result = json.loads(response.read().decode('utf-8'))

    content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
    print(f'[COLORGUIDE-WORKER] Gemini raw response length: {len(content)}')

    if not content or not content.strip():
        raise ValueError('Empty response from Gemini')

    return json.loads(content)


def call_gemini(image_url: str) -> Dict[str, Any]:
    """Вызывает Gemini. Strict json_schema гарантирует валидный JSON, retry не нужен."""
    return call_gemini_once(image_url, PROMPT_TEMPLATE)


def refund_user(cursor, task_id: str, user_id, cost: int, reason: str):
    """Возвращает деньги пользователю и помечает задачу refunded=TRUE"""
    if not cost or cost <= 0:
        return False
    try:
        cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
        row = cursor.fetchone()
        if not row:
            return False
        balance_before = float(row[0])
        balance_after = balance_before + cost

        cursor.execute('UPDATE users SET balance = balance + %s WHERE id = %s', (cost, user_id))
        cursor.execute('''
            INSERT INTO balance_transactions
            (user_id, type, amount, balance_before, balance_after, description)
            VALUES (%s, 'refund', %s, %s, %s, %s)
        ''', (user_id, cost, balance_before, balance_after, f'Возврат: Гид по цвету ({reason})'))
        cursor.execute(
            'UPDATE color_guide_tasks SET refunded = TRUE WHERE id = %s',
            (task_id,)
        )
        print(f'[COLORGUIDE-WORKER] Refunded {cost} to user {user_id} for task {task_id}')
        return True
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] Refund failed: {e}')
        return False


def mark_failed_and_refund(task_id: str, error_message: str, refund_reason: str):
    """Открывает свежее соединение, помечает задачу failed и при необходимости возвращает деньги."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                'SELECT user_id, cost, refunded FROM color_guide_tasks WHERE id = %s',
                (task_id,)
            )
            r = cursor.fetchone()
            if r:
                u_id, t_cost, t_refunded = r
                if not t_refunded and t_cost and t_cost > 0:
                    refund_user(cursor, task_id, u_id, t_cost, refund_reason)
            cursor.execute(
                "UPDATE color_guide_tasks SET status = 'failed', error_message = %s, updated_at = %s WHERE id = %s",
                (error_message[:500], datetime.utcnow(), task_id)
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] Failed to save error state: {e}')


def process_task(task_id: str):
    """Главная логика обработки задачи. Соединение с БД открывается короткими сегментами,
    чтобы не держать idle-коннект во время долгого вызова Gemini."""
    print(f'[COLORGUIDE-WORKER] Processing task {task_id}')

    # Сегмент 1: читаем задачу и помечаем processing
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                'SELECT user_id, person_image, status, cost, refunded FROM color_guide_tasks WHERE id = %s',
                (task_id,)
            )
            row = cursor.fetchone()
            if not row:
                print(f'[COLORGUIDE-WORKER] Task {task_id} not found')
                return
            user_id, person_image, status, cost, refunded = row
            if status not in ('pending', 'processing'):
                print(f'[COLORGUIDE-WORKER] Task {task_id} already in status {status}')
                return

            cursor.execute(
                "UPDATE color_guide_tasks SET status = 'processing', updated_at = %s WHERE id = %s",
                (datetime.utcnow(), task_id)
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] ERROR (read task): {e}')
        mark_failed_and_refund(task_id, f'Ошибка чтения задачи: {e}', 'ошибка обработки')
        return

    # Сегмент 2 (без открытого коннекта): S3 + Gemini — долгая часть
    try:
        cdn_url = upload_to_s3(person_image, task_id, str(user_id))
        print(f'[COLORGUIDE-WORKER] Uploaded to {cdn_url}')

        result = call_gemini(cdn_url)
        print(f'[COLORGUIDE-WORKER] Gemini returned keys: {list(result.keys())}')
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] ERROR (Gemini/S3): {e}')
        mark_failed_and_refund(task_id, str(e), 'ошибка обработки')
        return

    # Валидация slug
    raw_slug = result.get('colortype_slug', '')
    slug = normalize_slug(raw_slug, result.get('colortype_name', ''))
    if not slug:
        print(f'[COLORGUIDE-WORKER] WARNING: Invalid slug "{raw_slug}"')
        mark_failed_and_refund(
            task_id,
            'Не удалось определить цветотип по этому фото. Попробуйте другое фото.',
            'не удалось определить цветотип'
        )
        return
    result['colortype_slug'] = slug
    print(f'[COLORGUIDE-WORKER] Final slug: {slug}')

    # Валидация обязательных полей
    required_fields = ['main_palette', 'avoid_palette', 'makeup', 'metals', 'hair_colors', 'capsules', 'tips']
    missing = [f for f in required_fields if f not in result or not result.get(f)]
    if missing:
        print(f'[COLORGUIDE-WORKER] WARNING: Missing fields in result: {missing}')
        mark_failed_and_refund(
            task_id,
            'Не удалось сформировать полный отчёт. Попробуйте ещё раз.',
            f'неполный ответ Gemini: {",".join(missing)}'
        )
        return

    # Сегмент 3: сохраняем результат свежим коннектом
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                UPDATE color_guide_tasks
                SET status = 'completed',
                    colortype_slug = %s,
                    result_json = %s,
                    cdn_url = %s,
                    person_image = NULL,
                    updated_at = %s
                WHERE id = %s
            ''', (slug, json.dumps(result, ensure_ascii=False), cdn_url, datetime.utcnow(), task_id))
            conn.commit()
            print(f'[COLORGUIDE-WORKER] Task {task_id} completed successfully')
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] ERROR (save result): {e}')
        mark_failed_and_refund(task_id, f'Ошибка сохранения результата: {e}', 'ошибка обработки')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Воркер обработки задачи Гида по цвету: вызов Gemini и сохранение результата
    Args: event с queryStringParameters.task_id; context с request_id
    Returns: HTTP response со статусом обработки
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    params = event.get('queryStringParameters') or {}
    task_id = params.get('task_id')
    if not task_id:
        return {
            'statusCode': 400,
            'headers': cors_headers(event),
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id required'})
        }

    process_task(task_id)
    return {
        'statusCode': 200,
        'headers': cors_headers(event),
        'isBase64Encoded': False,
        'body': json.dumps({'ok': True, 'task_id': task_id})
    }