import json
import os
import base64
import re
import time
import urllib.request
import urllib.error
import ssl
import socket
from typing import Dict, Any
from datetime import datetime
import psycopg2
import boto3

import registry


def _open_openrouter(req, timeout):
    """Открывает запрос к OpenRouter. Если задан OPENROUTER_PROXY_URL —
    идёт через HTTP(S)-прокси, иначе напрямую (как раньше)."""
    proxy_url = (os.environ.get('OPENROUTER_PROXY_URL') or '').strip()
    if proxy_url:
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url})
        )
        return opener.open(req, timeout=timeout)
    return urllib.request.urlopen(req, timeout=timeout)


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
    return origin if origin else 'https://fitting-room.ru'


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


def call_gemini_once(image_url: str, prompt: str, max_tokens: int = 6000) -> Dict[str, Any]:
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
        'max_tokens': max_tokens,
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
    with _open_openrouter(req, timeout=90) as response:
        result = json.loads(response.read().decode('utf-8'))

    content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
    print(f'[COLORGUIDE-WORKER] Gemini raw response length: {len(content)}')

    if not content or not content.strip():
        raise ValueError('Empty response from Gemini')

    return json.loads(content)


def call_gemini(image_url: str, forced_slug: str = None, forced_slug_alt: str = None) -> Dict[str, Any]:
    """Вызывает Gemini с авто-ретраем.
    Иногда модель возвращает оборванный/невалидный JSON (обрыв ответа на середине) —
    в этом случае делаем повторные попытки, прежде чем считать задачу неудачной.
    - forced_slug без forced_slug_alt: цветотип уже определён, Gemini строит гид
      строго под него, не переопределяя.
    - forced_slug и forced_slug_alt: ИИ и формула разошлись — Gemini выбирает один
      из двух кандидатов по фото и строит гид под выбранный."""
    prompt = PROMPT_TEMPLATE
    if forced_slug and forced_slug_alt:
        prompt = (
            f'ВАЖНО: цветотип этого человека — ОДИН ИЗ ДВУХ: "{forced_slug}" ИЛИ "{forced_slug_alt}". '
            f'Внимательно посмотри на фото и выбери, какой из этих двух подходит точнее. '
            f'В поле colortype_slug верни строго один из этих двух вариантов (НЕ другой цветотип). '
            f'Все рекомендации (палитра, макияж, металлы, волосы, капсулы, советы) делай '
            f'именно для выбранного цветотипа, учитывая внешность на фото.\n\n'
            + PROMPT_TEMPLATE
        )
    elif forced_slug:
        prompt = (
            f'ВАЖНО: цветотип этого человека уже точно определён ранее и равен "{forced_slug}". '
            f'НЕ переопределяй цветотип. В поле colortype_slug верни строго "{forced_slug}". '
            f'Все рекомендации (палитра, макияж, металлы, волосы, капсулы, советы) делай '
            f'именно для цветотипа "{forced_slug}", учитывая внешность на фото.\n\n'
            + PROMPT_TEMPLATE
        )

    max_attempts = 3
    last_error = None
    for attempt in range(1, max_attempts + 1):
        # На повторных попытках даём больше токенов — частая причина сбоя обрыв ответа.
        max_tokens = 6000 if attempt == 1 else 8000
        try:
            return call_gemini_once(image_url, prompt, max_tokens)
        except (json.JSONDecodeError, ValueError, urllib.error.URLError, socket.timeout) as e:
            last_error = e
            print(f'[COLORGUIDE-WORKER] Gemini attempt {attempt}/{max_attempts} failed: {e}')
            if attempt < max_attempts:
                time.sleep(2)

    raise last_error if last_error else RuntimeError('Gemini call failed')


def call_gemini_with_schema(image_url: str, prompt: str, schema: dict, schema_name: str) -> Dict[str, Any]:
    """Запрос к Gemini с произвольной JSON-схемой (для картиночных сервисов)."""
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
        'temperature': 0.7,
        'response_format': {
            'type': 'json_schema',
            'json_schema': {'name': schema_name, 'strict': True, 'schema': schema}
        }
    }

    last_error = None
    for attempt in range(3):
        req = urllib.request.Request(
            'https://openrouter.ai/api/v1/chat/completions',
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://fitting-room.ru',
                'X-Title': 'Style Analysis'
            },
            method='POST'
        )
        try:
            with _open_openrouter(req, timeout=90) as response:
                result = json.loads(response.read().decode('utf-8'))
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            if not content or not content.strip():
                raise ValueError('Empty response from Gemini')
            return json.loads(content)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')[:500]
            print(f'[COLORGUIDE-WORKER] Gemini HTTP {e.code} (attempt {attempt + 1}): {err_body}')
            last_error = RuntimeError(f'Gemini error {e.code}: {err_body}')
        except Exception as e:
            print(f'[COLORGUIDE-WORKER] Gemini error (attempt {attempt + 1}): {e}')
            last_error = e
        if attempt < 2:
            time.sleep(3)

    raise last_error if last_error else RuntimeError('Gemini request failed')


def _extract_json_object(text: str) -> Dict[str, Any]:
    """Извлекает первый валидный JSON-объект из текста ответа модели.
    Thinking-модели возвращают reasoning + JSON, иногда в ```json блоке."""
    if not text or not text.strip():
        raise ValueError('Empty response from model')
    s = text.strip()
    # Убираем markdown-обёртку ```json ... ```
    if '```' in s:
        fence = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', s, re.DOTALL)
        if fence:
            s = fence.group(1)
    try:
        return json.loads(s)
    except Exception:
        pass
    # Берём подстроку от первой { до последней } (баланс скобок)
    start = s.find('{')
    end = s.rfind('}')
    if start != -1 and end != -1 and end > start:
        candidate = s[start:end + 1]
        return json.loads(candidate)
    raise ValueError('No JSON object found in model response')


def call_qwen_json(image_url: str, prompt: str, model: str) -> Dict[str, Any]:
    """Запрос к мультимодальному Qwen (thinking) через OpenRouter.
    Без strict json_schema: модель отдаёт reasoning + JSON, парсим объект из ответа.
    3 попытки с retry."""
    api_key = os.environ.get('OPENROUTER_API_KEY_NEW') or os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        raise RuntimeError('OPENROUTER_API_KEY not configured')

    payload = {
        'model': model,
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'image_url', 'image_url': {'url': image_url}},
                    {'type': 'text', 'text': prompt}
                ]
            }
        ],
        'max_tokens': 12000,
        'temperature': 0.6,
    }

    last_error = None
    for attempt in range(3):
        req = urllib.request.Request(
            'https://openrouter.ai/api/v1/chat/completions',
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://fitting-room.ru',
                'X-Title': 'Outfit Selection'
            },
            method='POST'
        )
        try:
            with _open_openrouter(req, timeout=180) as response:
                result = json.loads(response.read().decode('utf-8'))
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            return _extract_json_object(content)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')[:500]
            print(f'[COLORGUIDE-WORKER] Qwen HTTP {e.code} (attempt {attempt + 1}): {err_body}')
            last_error = RuntimeError(f'Qwen error {e.code}: {err_body}')
        except Exception as e:
            print(f'[COLORGUIDE-WORKER] Qwen error (attempt {attempt + 1}): {e}')
            last_error = e
        if attempt < 2:
            time.sleep(3)

    raise last_error if last_error else RuntimeError('Qwen request failed')


def fal_submit(prompt: str, image_urls: list, aspect_ratio: str):
    """Отправить задачу в очередь fal.ai nano-banana-2/edit.
    Возвращает (status_url, response_url)."""
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise RuntimeError('FAL_API_KEY not configured')

    payload = {
        'image_urls': image_urls,
        'prompt': prompt,
        'aspect_ratio': aspect_ratio,
        'num_images': 1,
        'resolution': '1K',
        'output_format': 'png',
    }
    req = urllib.request.Request(
        'https://queue.fal.run/fal-ai/nano-banana-2/edit',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Authorization': f'Key {fal_api_key}', 'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')[:500]
        print(f'[COLORGUIDE-WORKER] fal.ai HTTP {e.code}: {err_body}')
        raise RuntimeError(f'fal.ai error {e.code}: {err_body}')
    response_url = result.get('response_url')
    status_url = result.get('status_url') or (response_url + '/status' if response_url else None)
    if not response_url:
        raise RuntimeError(f'fal.ai submit failed: {result}')
    return status_url, response_url


def _is_transient_network_error(exc: Exception) -> bool:
    """Временные сетевые сбои, на которых имеет смысл повторить запрос
    (обрывы TLS, EOF, таймауты, сбросы соединения)."""
    if isinstance(exc, (ssl.SSLError, socket.timeout, EOFError, ConnectionError)):
        return True
    if isinstance(exc, urllib.error.URLError):
        reason = getattr(exc, 'reason', None)
        if isinstance(reason, (ssl.SSLError, socket.timeout, EOFError, ConnectionError)):
            return True
        return True
    return False


def _is_no_media_error(exc: Exception) -> bool:
    """Отказ генерации картинки fal (HTTP 422 / no_media_generated) —
    единичный сбой модели на конкретном промпте, имеет смысл повторить 1 раз."""
    if isinstance(exc, urllib.error.HTTPError) and getattr(exc, 'code', None) == 422:
        return True
    text = str(exc)
    return 'no_media_generated' in text or 'error 422' in text or 'HTTP 422' in text


def _fal_get(url: str) -> dict:
    """GET к fal.ai; 400 'still in progress' трактуем как 'ещё не готово'.
    На временных сетевых сбоях (обрыв TLS/EOF/таймаут) повторяем запрос."""
    fal_api_key = os.environ.get('FAL_API_KEY')
    headers = {'Authorization': f'Key {fal_api_key}', 'Content-Type': 'application/json'}
    last_error = None
    for attempt in range(4):
        req = urllib.request.Request(url, headers=headers, method='GET')
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code in (202, 400):
                return {'status': 'IN_PROGRESS'}
            raise
        except Exception as e:
            if not _is_transient_network_error(e):
                raise
            last_error = e
            print(f'[COLORGUIDE-WORKER] fal.ai GET network error (attempt {attempt + 1}): {e}')
            time.sleep(3)
    raise last_error if last_error else RuntimeError('fal.ai GET failed')


def fal_poll_result(status_url: str, response_url: str, max_wait_seconds: int = 180) -> str:
    """Опрашивать status_url до COMPLETED, затем забрать картинку с response_url."""
    deadline = time.time() + max_wait_seconds
    while time.time() < deadline:
        time.sleep(5)
        data = _fal_get(status_url)
        status = data.get('status')
        if status == 'COMPLETED':
            result = _fal_get(response_url)
            images = result.get('images') or []
            if images and images[0].get('url'):
                return images[0]['url']
            raise RuntimeError('fal.ai completed without image')
        if status in ('FAILED', 'ERROR'):
            raise RuntimeError(f'fal.ai generation failed: {data}')
    raise RuntimeError('fal.ai generation timeout')


def upload_result_to_s3(image_url: str, task_id: str, user_id: str) -> str:
    """Скачать готовую картинку с fal.ai и загрузить в Яндекс Object Storage.
    На временных сетевых сбоях (обрыв TLS/EOF/таймаут) повторяем скачивание."""
    image_bytes = None
    last_error = None
    for attempt in range(4):
        req = urllib.request.Request(image_url, method='GET')
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                image_bytes = response.read()
            break
        except Exception as e:
            if not _is_transient_network_error(e):
                raise
            last_error = e
            print(f'[COLORGUIDE-WORKER] download result network error (attempt {attempt + 1}): {e}')
            time.sleep(3)
    if image_bytes is None:
        raise last_error if last_error else RuntimeError('failed to download result image')

    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    s3 = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key
    )
    s3_key = f'images/styleanalysis/{user_id}/{task_id}.png'
    s3.put_object(Bucket=s3_bucket, Key=s3_key, Body=image_bytes, ContentType='image/png')
    return f'https://storage.yandexcloud.net/{s3_bucket}/{s3_key}'


def process_image_service(task_id: str, service_type: str, person_image: str, user_id, height, form_params=None):
    """Обработка картиночного сервиса: анализ (Gemini/Qwen) -> nano-banana-2 -> S3."""
    service = registry.get_service(service_type)
    print(f'[COLORGUIDE-WORKER] Image service "{service_type}" for task {task_id}')

    # form_params может прийти как dict (из jsonb) или строка — нормализуем в dict
    if isinstance(form_params, str):
        try:
            form_params = json.loads(form_params)
        except Exception:
            form_params = None
    if not isinstance(form_params, dict):
        form_params = None

    # Сегмент: S3 загрузка фото клиента + анализ + fal.ai (долгая часть, без коннекта к БД)
    try:
        person_url = upload_to_s3(person_image, task_id, str(user_id))
        print(f'[COLORGUIDE-WORKER] Person uploaded to {person_url}')

        print('[COLORGUIDE-WORKER] STEP analysis start')
        gemini_prompt = service.GEMINI_PROMPT
        if height:
            gemini_prompt += (
                f'\n\nРОСТ КЛИЕНТА: примерно {height} см. Обязательно учитывай рост при подборе: '
                'длину вещей и низа, пропорции, высоту посадки, длину юбок/брюк, тип и высоту обуви, '
                'визуальный баланс силуэта. Рекомендации по длине и пропорциям должны подходить именно '
                'этому росту.'
            )
        # Блок параметров формы (для сервиса 'outfit')
        if form_params and hasattr(service, 'build_params_block'):
            params_block = service.build_params_block(form_params)
            if params_block:
                gemini_prompt += '\n\n' + params_block

        required = getattr(service, 'REQUIRED_FIELDS', [])
        has_schema = bool(getattr(service, 'RESPONSE_SCHEMA', None))
        if getattr(service, 'USE_QWEN', False):
            model_used = 'qwen'
            try:
                analysis = call_qwen_json(person_url, gemini_prompt, service.QWEN_MODEL)
                missing = [f for f in required if not analysis.get(f)]
                if missing:
                    raise RuntimeError(f'Qwen вернул неполный JSON, не хватает: {",".join(missing)}')
                print(f'[MODEL-CHECK] service={service_type} model=qwen json=ok keys={list(analysis.keys())}')
            except Exception as qwen_err:
                print(f'[MODEL-CHECK] service={service_type} model=qwen json=bad error={qwen_err}')
                if not has_schema:
                    raise
                print(f'[MODEL-CHECK] service={service_type} fallback -> gemini')
                analysis = call_gemini_with_schema(
                    person_url, gemini_prompt, service.RESPONSE_SCHEMA, f'{service_type}_result'
                )
                model_used = 'gemini-fallback'
                missing = [f for f in required if not analysis.get(f)]
                status_json = 'bad' if missing else 'ok'
                print(f'[MODEL-CHECK] service={service_type} model=gemini-fallback json={status_json} keys={list(analysis.keys())}')
                if missing:
                    raise RuntimeError(f'неполный ответ Gemini: {",".join(missing)}')
        else:
            model_used = 'gemini'
            analysis = call_gemini_with_schema(
                person_url, gemini_prompt, service.RESPONSE_SCHEMA, f'{service_type}_result'
            )
            missing = [f for f in required if not analysis.get(f)]
            status_json = 'bad' if missing else 'ok'
            print(f'[MODEL-CHECK] service={service_type} model=gemini json={status_json} keys={list(analysis.keys())}')
            if missing:
                raise RuntimeError(f'неполный ответ Gemini: {",".join(missing)}')
        print(f'[COLORGUIDE-WORKER] STEP analysis done via {model_used}, keys: {list(analysis.keys())}')

        analysis['source_image'] = person_url

        gender = form_params.get('gender') if form_params else None
        try:
            import inspect
            if 'gender' in inspect.signature(service.build_image_prompt).parameters:
                image_prompt = service.build_image_prompt(analysis, height, gender)
            else:
                image_prompt = service.build_image_prompt(analysis, height)
        except (TypeError, ValueError):
            image_prompt = service.build_image_prompt(analysis, height)
        print(f'[COLORGUIDE-WORKER] STEP fal submit, prompt len={len(image_prompt)}')
        image_inputs = [person_url]
        logo_url = getattr(service, 'LOGO_IMAGE_URL', None)
        if logo_url:
            image_inputs.append(logo_url)

        cdn_url = None
        last_no_media_err = None
        for gen_attempt in range(2):
            try:
                status_url, response_url = fal_submit(
                    image_prompt,
                    image_inputs,
                    service.ASPECT_RATIO
                )
                print(f'[COLORGUIDE-WORKER] STEP fal submitted: {status_url}')
                result_image_url = fal_poll_result(status_url, response_url)
                cdn_url = upload_result_to_s3(result_image_url, task_id, str(user_id))
                print(f'[COLORGUIDE-WORKER] Result image saved: {cdn_url}')
                break
            except Exception as gen_err:
                if _is_no_media_error(gen_err) and gen_attempt == 0:
                    last_no_media_err = gen_err
                    print(f'[COLORGUIDE-WORKER] image gen no_media (attempt 1), retrying once: {gen_err}')
                    continue
                raise
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')[:600] if hasattr(e, 'read') else ''
        print(f'[COLORGUIDE-WORKER] ERROR (image service) HTTP {e.code}: {err_body}')
        mark_failed_and_refund(task_id, 'Ошибка сервиса. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте позже.', 'ошибка генерации')
        return
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] ERROR (image service): {e}')
        mark_failed_and_refund(task_id, 'Ошибка сервиса. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте позже.', 'ошибка генерации')
        return

    # Сегмент: сохраняем результат
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                UPDATE color_guide_tasks
                SET status = 'completed',
                    result_json = %s,
                    cdn_url = %s,
                    person_image = NULL,
                    updated_at = %s
                WHERE id = %s
            ''', (json.dumps(analysis, ensure_ascii=False), cdn_url, datetime.utcnow(), task_id))
            conn.commit()
            print(f'[COLORGUIDE-WORKER] Task {task_id} ({service_type}) completed')
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] ERROR (save image result): {e}')
        mark_failed_and_refund(task_id, 'Ошибка сервиса. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте позже.', 'ошибка обработки')


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
                'SELECT user_id, person_image, status, cost, refunded, service_type, height, form_params, forced_colortype_slug, forced_colortype_slug_alt FROM color_guide_tasks WHERE id = %s',
                (task_id,)
            )
            row = cursor.fetchone()
            if not row:
                print(f'[COLORGUIDE-WORKER] Task {task_id} not found')
                return
            user_id, person_image, status, cost, refunded, service_type, height, form_params, forced_colortype_slug, forced_colortype_slug_alt = row
            if status not in ('pending', 'processing'):
                print(f'[COLORGUIDE-WORKER] Task {task_id} already in status {status}')
                return

            # Единая очередь: если глобально уже обрабатывается задача — ждём
            if status == 'pending':
                from queue_guard import count_global_active, GLOBAL_CONCURRENCY
                active_count = count_global_active(cursor)
                if active_count >= GLOBAL_CONCURRENCY:
                    print(f'[COLORGUIDE-WORKER] Task {task_id}: {active_count} active task(s) globally, staying pending')
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
        mark_failed_and_refund(task_id, 'Ошибка сервиса. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте позже.', 'ошибка обработки')
        return

    # Картиночные сервисы (стиль, причёски и т.д.) идут отдельной веткой
    if registry.is_image_service(service_type or 'colorguide'):
        process_image_service(task_id, service_type, person_image, user_id, height, form_params)
        return

    # Сегмент 2 (без открытого коннекта): S3 + Gemini — долгая часть
    try:
        cdn_url = upload_to_s3(person_image, task_id, str(user_id))
        print(f'[COLORGUIDE-WORKER] Uploaded to {cdn_url}')

        result = call_gemini(cdn_url, forced_colortype_slug, forced_colortype_slug_alt)
        print(f'[COLORGUIDE-WORKER] colortype returned keys: {list(result.keys())}')
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] ERROR (Gemini/S3): {e}')
        mark_failed_and_refund(task_id, 'Ошибка сервиса. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте позже.', 'ошибка обработки')
        return

    # Фиксация цветотипа:
    # - один кандидат -> жёстко фиксируем его (без переопределения);
    # - два кандидата -> Gemini выбрал один из них; принимаем выбор, но валидируем,
    #   что он входит в число кандидатов, иначе берём первый (формулу).
    if forced_colortype_slug and not forced_colortype_slug_alt:
        result['colortype_slug'] = forced_colortype_slug
    elif forced_colortype_slug and forced_colortype_slug_alt:
        candidates = {forced_colortype_slug, forced_colortype_slug_alt}
        chosen = normalize_slug(result.get('colortype_slug', ''), result.get('colortype_name', ''))
        if chosen not in candidates:
            print(f'[COLORGUIDE-WORKER] Gemini chose "{chosen}" not in {candidates}, fallback to {forced_colortype_slug}')
            chosen = forced_colortype_slug
        result['colortype_slug'] = chosen

    # Валидация slug
    raw_slug = result.get('colortype_slug', '')
    slug = normalize_slug(raw_slug, result.get('colortype_name', ''))
    if not slug:
        print(f'[COLORGUIDE-WORKER] WARNING: Invalid slug "{raw_slug}"')
        mark_failed_and_refund(
            task_id,
            'Не удалось определить цветотип по этому фото. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте другое фото.',
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
            'Не удалось сформировать полный отчёт. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте ещё раз.',
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
        mark_failed_and_refund(task_id, 'Ошибка сервиса. Деньги вернутся на баланс автоматически сразу или чуть позже администратором. Попробуйте позже.', 'ошибка обработки')


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

    # Единая очередь: после завершения своей задачи будим следующую pending (FIFO)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                SELECT id FROM color_guide_tasks
                WHERE status = 'pending'
                  AND id != %s
                ORDER BY created_at ASC
                LIMIT 1
            ''', (task_id,))
            next_row = cursor.fetchone()
        finally:
            cursor.close()
            conn.close()
        if next_row:
            next_id = next_row[0]
            print(f'[COLORGUIDE-WORKER] Waking next pending task {next_id}')
            try:
                worker_url = f'https://functions.poehali.dev/12f108e3-fe83-4618-9e8b-48411bb69390?task_id={next_id}'
                req = urllib.request.Request(worker_url, method='GET')
                urllib.request.urlopen(req, timeout=2)
            except Exception as te:
                print(f'[COLORGUIDE-WORKER] Wake-next trigger failed (non-critical): {te}')
    except Exception as e:
        print(f'[COLORGUIDE-WORKER] Wake-next scan error (non-critical): {e}')

    return {
        'statusCode': 200,
        'headers': cors_headers(event),
        'isBase64Encoded': False,
        'body': json.dumps({'ok': True, 'task_id': task_id})
    }