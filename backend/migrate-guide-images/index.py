import json
import os
import urllib.request
import boto3
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Одноразовая утилита: скачивает картинки по URL и кладёт в нужные ключи S3 бакета files.
    Body: {"items": [{"url": "...", "target_key": "colortype-schemes/soft-summer/guide/jewelry-1.jpg"}, ...]}
    '''
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    headers = event.get('headers', {})
    admin_token = headers.get('x-admin-token') or headers.get('X-Admin-Token', '')
    expected = os.environ.get('ADMIN_PASSWORD', '')
    if not admin_token or admin_token != expected:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Unauthorized'})
        }

    body = json.loads(event.get('body', '{}'))
    items = body.get('items', [])
    if not items:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'items required'})
        }

    aws_key = os.environ['AWS_ACCESS_KEY_ID']
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=aws_key,
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )

    results = []
    for item in items:
        url = item.get('url')
        target_key = item.get('target_key')
        if not url or not target_key:
            results.append({'target_key': target_key, 'ok': False, 'error': 'missing url or target_key'})
            continue
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                content_type = resp.headers.get('Content-Type', 'image/png')
            s3.put_object(Bucket='files', Key=target_key, Body=data, ContentType=content_type)
            cdn_url = f'https://cdn.poehali.dev/projects/{aws_key}/bucket/{target_key}'
            results.append({'target_key': target_key, 'ok': True, 'cdn_url': cdn_url, 'size': len(data)})
        except Exception as e:
            results.append({'target_key': target_key, 'ok': False, 'error': str(e)})

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'isBase64Encoded': False,
        'body': json.dumps({'results': results}, ensure_ascii=False)
    }
