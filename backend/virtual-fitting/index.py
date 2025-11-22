import json
import os
import base64
import time
from typing import Dict, Any
import requests

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Generate virtual try-on images using AI model
    Args: event - dict with httpMethod, body (person_image, garment_image as base64)
          context - object with attributes: request_id, function_name
    Returns: HTTP response with generated image URL
    '''
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
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
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
        person_image = body_data.get('person_image')
        garment_image = body_data.get('garment_image')
        
        if not person_image or not garment_image:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Missing person_image or garment_image'})
            }
        
        api_token = os.environ.get('HUGGINGFACE_API_TOKEN')
        if not api_token:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'HUGGINGFACE_API_TOKEN not configured'})
            }
        
        api_url = "https://api.endpoints.huggingface.cloud/v2/models/yisol/IDM-VTON"
        headers = {"Authorization": f"Bearer {api_token}"}
        
        payload = {
            "inputs": {
                "person_image": person_image,
                "garment_image": garment_image
            }
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            response = requests.post(api_url, headers=headers, json=payload, timeout=120)
            
            if response.status_code == 503:
                if attempt < max_retries - 1:
                    time.sleep(20)
                    continue
                return {
                    'statusCode': 503,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Model is loading, please try again in a minute'})
                }
            
            if response.status_code != 200:
                return {
                    'statusCode': response.status_code,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': f'Hugging Face API error: {response.text}'})
                }
            
            result_image = base64.b64encode(response.content).decode('utf-8')
            result_url = f"data:image/png;base64,{result_image}"
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'image_url': result_url,
                    'request_id': context.request_id
                })
            }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }