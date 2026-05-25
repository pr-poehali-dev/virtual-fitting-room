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
        response = s3.list_objects_v2(Bucket='files', Prefix=prefix)
        objects = response.get('Contents', [])

        groups = {
            'hair': [],
            'makeup': [],
            'outfit': [],
            'jewelry': [],
            'texture': [],
            'other': []
        }

        for obj in objects:
            key = obj['Key']
            if key.endswith('/'):
                continue
            filename = key.rsplit('/', 1)[-1].lower()
            url = f'https://cdn.poehali.dev/projects/{aws_key}/bucket/{key}'
            if filename.startswith('hair'):
                groups['hair'].append(url)
            elif filename.startswith('makeup'):
                groups['makeup'].append(url)
            elif filename.startswith('outfit'):
                groups['outfit'].append(url)
            elif filename.startswith('jewelry'):
                groups['jewelry'].append(url)
            elif filename.startswith('texture'):
                groups['texture'].append(url)
            else:
                groups['other'].append(url)

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
