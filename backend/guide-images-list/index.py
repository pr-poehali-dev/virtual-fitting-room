import json
import os
import boto3
from typing import Dict, Any

ALLOWED_SLUGS = {
    'bright-spring', 'bright-winter', 'dusty-summer', 'fiery-autumn',
    'gentle-autumn', 'gentle-spring', 'soft-summer', 'soft-winter',
    'vibrant-spring', 'vivid-autumn', 'vivid-summer', 'vivid-winter'
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Возвращает список картинок из папки colortype-schemes/{slug}/guide/ в S3.
    Группирует по префиксу имени файла (hair-*, makeup-*, outfit-*, jewelry-*, texture-*).
    Args: event с queryStringParameters.slug; context с request_id
    Returns: HTTP response с группированным списком URL картинок
    '''
    def get_cors_origin(event):
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed else 'https://fitting-room.ru'

    method = event.get('httpMethod', 'GET')
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

    params = event.get('queryStringParameters') or {}
    slug = (params.get('slug') or '').strip().lower()

    if slug not in ALLOWED_SLUGS:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Invalid slug'})
        }

    try:
        aws_key = os.environ['AWS_ACCESS_KEY_ID']
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=aws_key,
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
        )
        prefix = f'colortype-schemes/{slug}/guide/'

        groups = {
            'hair': [],
            'makeup': [],
            'outfit': [],
            'jewelry': [],
            'texture': [],
            'other': []
        }

        def classify(filename: str, url: str):
            fn = filename.lower()
            if fn.startswith('hair'):
                groups['hair'].append(url)
            elif fn.startswith('makeup'):
                groups['makeup'].append(url)
            elif fn.startswith('outfit'):
                groups['outfit'].append(url)
            elif fn.startswith('jewelry'):
                groups['jewelry'].append(url)
            elif fn.startswith('texture'):
                groups['texture'].append(url)
            else:
                groups['other'].append(url)

        # Попытка 1: листинг S3
        try:
            response = s3.list_objects_v2(Bucket='files', Prefix=prefix)
            objects = response.get('Contents', [])
            for obj in objects:
                key = obj['Key']
                if key.endswith('/'):
                    continue
                filename = key.rsplit('/', 1)[-1]
                url = f'https://cdn.poehali.dev/projects/{aws_key}/bucket/{key}'
                classify(filename, url)
            print(f'[GUIDE-IMAGES] list_objects_v2 found {len(objects)} objects for {slug}')
        except Exception as list_err:
            print(f'[GUIDE-IMAGES] list_objects_v2 failed: {list_err}')

        # Попытка 2: fallback — проверяем заранее известные имена через head_object
        # Это покрывает базовый набор картинок, который я загрузил
        total_found = sum(len(v) for v in groups.values())
        if total_found == 0:
            print(f'[GUIDE-IMAGES] Fallback: probing known filenames for {slug}')
            fallback_files = [
                'jewelry-1.jpg', 'jewelry-2.jpg', 'jewelry-3.jpg',
                'outfit-1.jpg', 'outfit-2.jpg', 'outfit-3.jpg', 'outfit-4.jpg',
                'texture-1.jpg', 'texture-2.jpg',
                'makeup-1.jpg', 'makeup-2.jpg',
                'hair-1.jpg', 'hair-2.jpg', 'hair-3.jpg'
            ]
            for fname in fallback_files:
                key = f'{prefix}{fname}'
                try:
                    s3.head_object(Bucket='files', Key=key)
                    url = f'https://cdn.poehali.dev/projects/{aws_key}/bucket/{key}'
                    classify(fname, url)
                except Exception:
                    pass
            print(f'[GUIDE-IMAGES] Fallback found {sum(len(v) for v in groups.values())} files')

        for k in groups:
            groups[k].sort()

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Cache-Control': 'public, max-age=3600'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'slug': slug, 'images': groups})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'S3 error: {str(e)}'})
        }