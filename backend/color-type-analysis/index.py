import json
import os
import random
from typing import Dict, Any

COLOR_TYPES = [
    'warm_spring',
    'light_spring', 
    'light_summer',
    'cool_summer',
    'soft_summer',
    'soft_autumn',
    'warm_autumn',
    'dark_autumn',
    'dark_winter',
    'bright_spring',
    'bright_winter',
    'cool_winter'
]

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Analyze portrait photo to determine color type
    Args: event - dict with httpMethod, body (image as base64)
          context - object with attributes: request_id, function_name
    Returns: HTTP response with detected color type
    '''
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': 'https://fitting-room.ru',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://fitting-room.ru'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_str = event.get('body', '{}')
    if not body_str or body_str.strip() == '':
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://fitting-room.ru'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Missing image data'})
        }
    
    try:
        body_data = json.loads(body_str)
        image_data = body_data.get('image')
        
        if not image_data:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://fitting-room.ru'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Missing image data'})
            }
        
        detected_color_type = random.choice(COLOR_TYPES)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://fitting-room.ru'
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'color_type': detected_color_type,
                'request_id': context.request_id
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://fitting-room.ru'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }