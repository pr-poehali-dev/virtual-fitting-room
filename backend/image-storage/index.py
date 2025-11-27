'''
Business: Upload and store images permanently to Cloudflare R2
Args: event with image_url (URL or base64) or raw binary image data
Returns: Permanent public URL to stored image
'''

import json
import boto3
import base64
import uuid
import os
import requests
from typing import Dict, Any
from io import BytesIO


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Store images permanently in Cloudflare R2
    Args: event - dict with httpMethod, body containing image_url or binary data
          context - object with request_id attribute
    Returns: HTTP response with permanent image URL
    '''
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        account_id = os.environ.get('CLOUDFLARE_R2_ACCOUNT_ID')
        access_key = os.environ.get('CLOUDFLARE_R2_ACCESS_KEY_ID')
        secret_key = os.environ.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
        bucket_name = os.environ.get('CLOUDFLARE_R2_BUCKET_NAME')
        public_url = os.environ.get('CLOUDFLARE_R2_PUBLIC_URL')
        
        if not all([account_id, access_key, secret_key, bucket_name, public_url]):
            return {
                'statusCode': 500,
                'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'R2 credentials not configured'})
            }
        
        body_data = json.loads(event.get('body', '{}'))
        image_source = body_data.get('image_url', '')
        
        if not image_source:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'image_url is required'})
            }
        
        image_bytes = None
        content_type = 'image/jpeg'
        
        if image_source.startswith('data:image'):
            parts = image_source.split(',', 1)
            if len(parts) != 2:
                return {
                    'statusCode': 400,
                    'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                    'body': json.dumps({'error': 'Invalid base64 image format'})
                }
            
            mime_part = parts[0]
            if 'png' in mime_part:
                content_type = 'image/png'
            elif 'webp' in mime_part:
                content_type = 'image/webp'
            
            base64_data = parts[1]
            image_bytes = base64.b64decode(base64_data)
        
        elif image_source.startswith('http'):
            response = requests.get(image_source, timeout=30)
            if response.status_code != 200:
                return {
                    'statusCode': 400,
                    'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Failed to download image: {response.status_code}'})
                }
            image_bytes = response.content
            content_type = response.headers.get('Content-Type', 'image/jpeg')
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Invalid image source. Must be URL or base64 data URI'})
            }
        
        file_extension = 'jpg'
        if 'png' in content_type:
            file_extension = 'png'
        elif 'webp' in content_type:
            file_extension = 'webp'
        
        file_name = f"{uuid.uuid4()}.{file_extension}"
        
        s3_client = boto3.client(
            's3',
            endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name='auto'
        )
        
        s3_client.put_object(
            Bucket=bucket_name,
            Key=file_name,
            Body=image_bytes,
            ContentType=content_type,
            CacheControl='public, max-age=31536000'
        )
        
        permanent_url = f"{public_url.rstrip('/')}/{file_name}"
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({
                'url': permanent_url,
                'original_url': image_source[:100] + '...' if len(image_source) > 100 else image_source
            })
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Upload failed: {str(e)}'})
        }
