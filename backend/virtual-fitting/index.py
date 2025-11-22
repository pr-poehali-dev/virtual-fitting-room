import json
import os
from typing import Dict, Any
import requests

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Submit or check virtual try-on generation task
    Args: event - dict with httpMethod, body (person_image, garment_image) or query params (status_url)
          context - object with attributes: request_id, function_name
    Returns: HTTP response with status_url or image_url
    '''
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        api_key = os.environ.get('FAL_API_KEY')
        if not api_key:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'FAL_API_KEY not configured'})
            }
        
        headers = {
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json"
        }
        
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            status_url = query_params.get('status_url')
            
            if not status_url:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing status_url parameter'})
                }
            
            status_response = requests.get(status_url, headers=headers, timeout=10)
            
            if status_response.status_code not in [200, 202]:
                return {
                    'statusCode': status_response.status_code,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': f'Status check error: {status_response.text}'})
                }
            
            status_result = status_response.json()
            status = status_result.get('status')
            
            if status == 'COMPLETED':
                print(f"Fal.ai response: {json.dumps(status_result)}")
                
                output = status_result.get('output')
                if isinstance(output, dict):
                    result_url = output.get('url')
                elif isinstance(output, str):
                    result_url = output
                else:
                    result_url = status_result.get('image', {}).get('url') if isinstance(status_result.get('image'), dict) else status_result.get('image')
                
                print(f"Extracted image URL: {result_url}")
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'status': 'COMPLETED',
                        'image_url': result_url
                    })
                }
            
            elif status == 'FAILED':
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'status': 'FAILED',
                        'error': status_result.get('error', 'Unknown error')
                    })
                }
            
            else:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'status': status or 'IN_PROGRESS'
                    })
                }
        
        elif method == 'POST':
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
            
            queue_url = "https://queue.fal.run/fal-ai/idm-vton"
            payload = {
                "human_image_url": person_image,
                "garment_image_url": garment_image,
                "description": "clothing item"
            }
            
            submit_response = requests.post(queue_url, headers=headers, json=payload, timeout=30)
            
            if submit_response.status_code != 200:
                return {
                    'statusCode': submit_response.status_code,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': f'Fal.ai API error: {submit_response.text}'})
                }
            
            submit_result = submit_response.json()
            status_url = submit_result.get('status_url') or submit_result.get('response_url')
            
            if not status_url:
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'No status_url returned'})
                }
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'status': 'SUBMITTED',
                    'status_url': status_url
                })
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Method not allowed'})
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