import json
import os
import replicate
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Generate virtual try-on with multiple garments using Replicate API
    Args: event - dict with httpMethod, body (person_image, garment_images[], category, prompt_hints)
          context - object with request_id attribute
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    api_token = os.environ.get('REPLICATE_API_TOKEN')
    if not api_token:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'REPLICATE_API_TOKEN not configured'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    person_image = body_data.get('person_image')
    garment_images = body_data.get('garment_images', [])
    category = body_data.get('category', '')
    prompt_hints = body_data.get('prompt_hints', '')
    
    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }
    
    if not garment_images or len(garment_images) == 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'At least one garment_image is required'})
        }
    
    if not category:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'category is required'})
        }
    
    try:
        os.environ['REPLICATE_API_TOKEN'] = api_token
        
        input_data = {
            "human_img": person_image,
            "garm_img": garment_images[0],
            "category": category,
        }
        
        if prompt_hints:
            input_data["garment_des"] = prompt_hints
        
        output = replicate.run(
            "cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
            input=input_data
        )
        
        result_url = output if isinstance(output, str) else str(output)
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'result_url': result_url,
                'category': category,
                'garments_count': len(garment_images)
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Generation failed: {str(e)}'})
        }
