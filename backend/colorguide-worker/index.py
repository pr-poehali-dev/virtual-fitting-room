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


PROMPT_TEMPLATE = '''Ты профессиональный имидж-стилист и эксперт по 12-сезонной системе цветотипов.
Проанализируй внешность человека на фото и составь полный персональный гид по цвету.

ВАЖНО: верни СТРОГО валидный JSON в следующем формате (без markdown, без комментариев, только JSON):

{
  "colortype_slug": "<один из 12 разрешённых slug, СКОПИРУЙ БУКВА В БУКВУ>",
  "colortype_name": "<название цветотипа на русском, например: Мягкое лето>",
  "short_description": "<2-3 предложения характеристики внешности: подтон, светлота, контраст>",
  "appearance": {
    "undertone": "<холодный/тёплый/нейтральный>",
    "contrast": "<низкий/средний/высокий>",
    "characteristics": ["<3-5 коротких характеристик: например, мягкие черты, холодный подтон, средний контраст>"]
  },
  "main_palette": [
    {"name": "<название цвета на русском>", "hex": "#XXXXXX"}
  ],
  "avoid_palette": [
    {"name": "<название цвета на русском>", "hex": "#XXXXXX"}
  ],
  "makeup": {
    "lipstick": [{"name": "<название>", "hex": "#XXXXXX"}],
    "blush": [{"name": "<название>", "hex": "#XXXXXX"}],
    "eyeshadow": [{"name": "<название>", "hex": "#XXXXXX"}]
  },
  "metals": {
    "recommended": ["<золото/серебро/розовое золото — что подходит>"],
    "avoid": ["<что не подходит>"]
  },
  "hair_colors": [
    {"name": "<название оттенка волос>", "hex": "#XXXXXX", "description": "<короткое описание>"}
  ],
  "capsules": [
    {"name": "<название образа, например: Повседневный>", "colors": ["#XXXXXX", "#XXXXXX", "#XXXXXX", "#XXXXXX"]}
  ],
  "tips": {
    "wear": ["<5-7 коротких советов: что носить, какие фасоны, ткани, принты>"],
    "avoid": ["<3-5 коротких советов: чего избегать>"]
  }
}

12 РАЗРЕШЁННЫХ значений для colortype_slug (копируй БУКВА В БУКВУ, не переводи, не меняй регистр, не добавляй пробелы):
- bright-spring — яркая весна (высокий контраст, тёплый подтон, чистые яркие цвета)
- bright-winter — яркая зима (высокий контраст, холодный подтон, чистые яркие цвета)
- dusty-summer — пыльное лето (низкий контраст, холодный подтон, приглушённые цвета)
- fiery-autumn — огненная осень (средний контраст, тёплый подтон, насыщенные тёплые цвета)
- gentle-autumn — мягкая осень (низкий контраст, тёплый подтон, мягкие приглушённые тёплые цвета)
- gentle-spring — мягкая весна (низкий контраст, тёплый подтон, нежные пастельные тёплые цвета)
- soft-summer — мягкое лето (низкий-средний контраст, холодный подтон, мягкие приглушённые холодные цвета)
- soft-winter — мягкая зима (средний контраст, холодный подтон, приглушённые холодные цвета)
- vibrant-spring — живая весна (средний-высокий контраст, тёплый подтон, тёплые яркие цвета)
- vivid-autumn — яркая осень (высокий контраст, тёплый подтон, насыщенные глубокие тёплые цвета)
- vivid-summer — яркое лето (средний контраст, холодный подтон, чистые холодные цвета)
- vivid-winter — живая зима (высокий контраст, холодный подтон, глубокие холодные цвета)

ТРЕБОВАНИЯ К ОТВЕТУ:
- main_palette: ровно 12 цветов
- avoid_palette: ровно 6 цветов
- makeup.lipstick, makeup.blush, makeup.eyeshadow: по 3 цвета в каждом
- hair_colors: 3-4 оттенка волос
- capsules: 4-6 капсульных сочетаний по 3-4 цвета в каждом
- Все hex-цвета в формате #RRGGBB
- Тексты на русском языке
- ЗАПРЕЩЕНО: переводить slug, склонять, менять регистр, добавлять пробелы. ТОЛЬКО один из 12 значений выше.
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
    """Загружает base64 фото в S3, возвращает CDN URL"""
    match = re.match(r'data:image/(\w+);base64,(.+)', image_data_url)
    if not match:
        raise ValueError('Invalid image data URL')
    ext = match.group(1)
    if ext == 'jpeg':
        ext = 'jpg'
    image_bytes = base64.b64decode(match.group(2))

    aws_key = os.environ['AWS_ACCESS_KEY_ID']
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=aws_key,
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    key = f'colorguide/{user_id}/{task_id}.{ext}'
    content_type = f'image/{ext if ext != "jpg" else "jpeg"}'
    s3.put_object(Bucket='files', Key=key, Body=image_bytes, ContentType=content_type)
    return f'https://cdn.poehali.dev/projects/{aws_key}/bucket/{key}'


def call_gemini(image_url: str) -> Dict[str, Any]:
    """Вызывает Gemini 2.5 Flash через OpenRouter, возвращает распарсенный JSON"""
    api_key = os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        raise RuntimeError('OPENROUTER_API_KEY not configured')

    payload = {
        'model': 'google/gemini-2.5-flash',
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'image_url', 'image_url': {'url': image_url}},
                    {'type': 'text', 'text': PROMPT_TEMPLATE}
                ]
            }
        ],
        'max_tokens': 4000,
        'temperature': 0.3,
        'response_format': {'type': 'json_object'}
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

    # Strip markdown wrapper if present
    content = content.strip()
    if content.startswith('```'):
        content = re.sub(r'^```(?:json)?\s*', '', content)
        content = re.sub(r'\s*```$', '', content)

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f'[COLORGUIDE-WORKER] JSON parse error: {e}')
        # Try to extract JSON block
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            data = json.loads(match.group(0))
        else:
            raise

    return data


def process_task(task_id: str):
    """Главная логика обработки задачи"""
    print(f'[COLORGUIDE-WORKER] Processing task {task_id}')
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT user_id, person_image, status FROM color_guide_tasks WHERE id = %s',
            (task_id,)
        )
        row = cursor.fetchone()
        if not row:
            print(f'[COLORGUIDE-WORKER] Task {task_id} not found')
            return
        user_id, person_image, status = row
        if status not in ('pending', 'processing'):
            print(f'[COLORGUIDE-WORKER] Task {task_id} already in status {status}')
            return

        cursor.execute(
            "UPDATE color_guide_tasks SET status = 'processing', updated_at = %s WHERE id = %s",
            (datetime.utcnow(), task_id)
        )
        conn.commit()

        # 1. Upload to S3
        cdn_url = upload_to_s3(person_image, task_id, str(user_id))
        print(f'[COLORGUIDE-WORKER] Uploaded to {cdn_url}')

        # 2. Call Gemini
        result = call_gemini(cdn_url)
        print(f'[COLORGUIDE-WORKER] Gemini returned keys: {list(result.keys())}')

        # 3. Validate slug
        raw_slug = result.get('colortype_slug', '')
        slug = normalize_slug(raw_slug, result.get('colortype_name', ''))
        if not slug:
            print(f'[COLORGUIDE-WORKER] WARNING: Invalid slug "{raw_slug}", fallback to soft-summer')
            slug = 'soft-summer'
        result['colortype_slug'] = slug
        print(f'[COLORGUIDE-WORKER] Final slug: {slug}')

        # 4. Save result
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

    except Exception as e:
        print(f'[COLORGUIDE-WORKER] ERROR: {e}')
        try:
            cursor.execute(
                "UPDATE color_guide_tasks SET status = 'failed', error_message = %s, updated_at = %s WHERE id = %s",
                (str(e)[:500], datetime.utcnow(), task_id)
            )
            conn.commit()
        except Exception as e2:
            print(f'[COLORGUIDE-WORKER] Failed to save error: {e2}')
    finally:
        cursor.close()
        conn.close()


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
