import json
import os
import base64
import requests
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Generate virtual try-on images using Yandex Cloud Foundation Models
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
        
        api_key = os.environ.get('YANDEX_CLOUD_API_KEY')
        folder_id = os.environ.get('YANDEX_CLOUD_FOLDER_ID')
        
        if not api_key or not folder_id:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Yandex Cloud credentials not configured'})
            }
        
        person_base64 = person_image.split(',')[1] if ',' in person_image else person_image
        garment_base64 = garment_image.split(',')[1] if ',' in garment_image else garment_image
        
        prompt = f"Virtual try-on: person wearing the garment. Realistic photo, high quality, natural lighting."
        
        yandex_api_url = 'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync'
        
        payload = {
            "modelUri": f"art://{folder_id}/yandex-art/latest",
            "generationOptions": {
                "seed": 17,
                "aspectRatio": {
                    "widthRatio": 1,
                    "heightRatio": 1
                }
            },
            "messages": [
                {
                    "weight": 1,
                    "text": prompt
                }
            ]
        }
        
        headers = {
            'Authorization': f'Api-Key {api_key}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(yandex_api_url, json=payload, headers=headers)
        
        if response.status_code != 200:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': f'Yandex API error: {response.text}'})
            }
        
        operation_data = response.json()
        operation_id = operation_data.get('id')
        
        if not operation_id:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Failed to start generation'})
            }
        
        import time
        max_attempts = 60
        attempt = 0
        
        while attempt < max_attempts:
            time.sleep(2)
            
            check_url = f'https://llm.api.cloud.yandex.net:443/operations/{operation_id}'
            check_response = requests.get(check_url, headers=headers)
            
            if check_response.status_code != 200:
                continue
            
            result = check_response.json()
            
            if result.get('done'):
                if 'response' in result and 'image' in result['response']:
                    image_base64 = result['response']['image']
                    result_url = f"data:image/jpeg;base64,{image_base64}"
                    
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
                else:
                    return {
                        'statusCode': 500,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Generation failed'})
                    }
            
            attempt += 1
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Generation timeout'})
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
