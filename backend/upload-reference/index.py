import json
import os
import base64
import uuid
import time
import boto3
from typing import Dict, Any
from session_utils import validate_session

S3_BUCKET = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB после декода


def get_cors_origin(event: Dict[str, Any]) -> str:
    origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
    allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
    return origin if origin in allowed_origins else 'https://fitting-room.ru'


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Загрузка одного референса (base64) в S3 для свободной генерации. Возвращает CDN-URL.
    Args: event - dict с body {image: base64}, headers с X-Session-Token
          context - объект с request_id
    Returns: HTTP-ответ {url: string, key: string}
    '''
    method = event.get('httpMethod', 'POST')

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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid or not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }

    try:
        body_data = json.loads(event.get('body', '{}'))
    except Exception:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Invalid JSON body'})
        }

    image = body_data.get('image', '') or ''
    if not image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'image is required (base64 or data URI)'})
        }

    content_type = 'image/jpeg'
    ext = 'jpg'
    if image.startswith('data:'):
        try:
            header, b64 = image.split(',', 1)
        except ValueError:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Invalid data URI'})
            }
        if 'image/png' in header:
            content_type = 'image/png'
            ext = 'png'
        elif 'image/webp' in header:
            content_type = 'image/webp'
            ext = 'webp'
        elif 'image/jpeg' in header or 'image/jpg' in header:
            content_type = 'image/jpeg'
            ext = 'jpg'
    else:
        b64 = image

    try:
        image_bytes = base64.b64decode(b64)
    except Exception:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Invalid base64'})
        }

    if len(image_bytes) > MAX_FILE_SIZE:
        return {
            'statusCode': 413,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'File too large (max {MAX_FILE_SIZE // 1024 // 1024} MB)'})
        }

    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    if not s3_access_key or not s3_secret_key:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'S3 credentials not configured'})
        }

    s3 = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
    )

    timestamp = int(time.time() * 1000)
    uid = uuid.uuid4().hex[:12]
    key = f'images/freegeneration/refs/{user_id}/{timestamp}_{uid}.{ext}'

    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
        )
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'S3 upload failed: {str(e)}'})
        }

    url = f'https://storage.yandexcloud.net/{S3_BUCKET}/{key}'

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': get_cors_origin(event),
            'Access-Control-Allow-Credentials': 'true',
        },
        'isBase64Encoded': False,
        'body': json.dumps({'url': url, 'key': key})
    }
