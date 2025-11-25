import json
import os
import replicate
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Generate virtual try-on with multiple garments using Replicate API with categories
    Args: event - dict with httpMethod, body (person_image, garments[{image, category}], prompt_hints)
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
    garments = body_data.get('garments', [])
    prompt_hints = body_data.get('prompt_hints', '')
    
    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }
    
    if not garments or len(garments) == 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'At least one garment is required'})
        }
    
    if len(garments) > 3:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Максимум 3 вещи за раз (ограничение по времени генерации)'})
        }
    
    try:
        os.environ['REPLICATE_API_TOKEN'] = api_token
        
        current_image = person_image
        
        for idx, garment in enumerate(garments):
            garment_image = garment.get('image') if isinstance(garment, dict) else garment
            garment_category = garment.get('category', 'upper_body') if isinstance(garment, dict) else 'upper_body'
            
            valid_categories = ['upper_body', 'lower_body', 'dresses', 'shoes']
            if garment_category not in valid_categories:
                garment_category = 'upper_body'
            
            input_data = {
                "human_img": current_image,
                "garm_img": garment_image,
                "category": garment_category,
            }
            
            if prompt_hints:
                input_data["garment_des"] = prompt_hints
            
            try:
                output = replicate.run(
                    "cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
                    input=input_data
                )
                current_image = output if isinstance(output, str) else str(output)
            except Exception as garment_error:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'error': f'Ошибка при примерке вещи {idx + 1}: {str(garment_error)}',
                        'garment_index': idx
                    })
                }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'result_url': current_image,
                'garments_count': len(garments)
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Ошибка генерации: {str(e)}'})
        }