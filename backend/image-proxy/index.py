import json
import os
from typing import Dict, Any
import urllib.request
import base64

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Proxy для загрузки изображений с внешних источников для PDF
    Args: event - dict с httpMethod, queryStringParameters
          context - object с attributes: request_id, function_name
    Returns: HTTP response с base64 изображением
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        query_params = event.get('queryStringParameters') or {}
        image_url = query_params.get('url')
        
        if not image_url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Missing url parameter'})
            }
        
        print(f'[ImageProxy] Fetching image: {image_url}')
        
        req = urllib.request.Request(image_url)
        req.add_header('User-Agent', 'Mozilla/5.0')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            image_data = response.read()
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            
            print(f'[ImageProxy] Loaded {len(image_data)} bytes, type: {content_type}')
            
            base64_data = base64.b64encode(image_data).decode('utf-8')
            
            data_url = f'data:{content_type};base64,{base64_data}'
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'data_url': data_url})
            }
    
    except urllib.error.HTTPError as e:
        print(f'[ImageProxy] HTTP Error: {e.code}')
        return {
            'statusCode': 502,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Failed to fetch image: HTTP {e.code}'})
        }
    
    except Exception as e:
        print(f'[ImageProxy] Error: {type(e).__name__}: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
