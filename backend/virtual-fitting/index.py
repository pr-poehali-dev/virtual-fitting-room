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
                response_url = status_result.get('response_url')
                
                if response_url:
                    result_response = requests.get(response_url, headers=headers, timeout=10)
                    if result_response.status_code == 200:
                        result_data = result_response.json()
                        print(f"Fal.ai result data: {json.dumps(result_data)}")
                        
                        output = result_data.get('data') or result_data.get('output')
                        if isinstance(output, dict):
                            result_url = output.get('url')
                        elif isinstance(output, str):
                            result_url = output
                        else:
                            result_url = result_data.get('image', {}).get('url') if isinstance(result_data.get('image'), dict) else result_data.get('image')
                        
                        print(f"Extracted image URL: {result_url}")
                    else:
                        result_url = None
                else:
                    result_url = None
                
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
            description = body_data.get('description', '')
            mask_image = body_data.get('mask_image')
            category_hint = body_data.get('category_hint', '')
            
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
            
            # Use IDM-VTON model with smart category-based descriptions
            queue_url = "https://queue.fal.run/fal-ai/idm-vton"
            
            # Build realistic description with strong category hints
            base_description = description if description else ""
            
            # Add STRONG category-specific placement instructions
            category_instructions = []
            if category_hint:
                hint_lower = category_hint.lower()
                
                # Upper body garments
                if 'top' in hint_lower or 'shirt' in hint_lower or 'blouse' in hint_lower or 't-shirt' in hint_lower:
                    category_instructions.append("UPPER BODY GARMENT ONLY: fit on torso, shoulders, and chest area")
                    category_instructions.append("do not extend below waist")
                    category_instructions.append("naturally fitting shirt/top with realistic shoulder and chest fit")
                
                # Lower body garments
                elif 'pants' in hint_lower or 'trousers' in hint_lower or 'jeans' in hint_lower:
                    category_instructions.append("LOWER BODY GARMENT ONLY: fit on legs and waist area")
                    category_instructions.append("do not cover upper body")
                    category_instructions.append("naturally fitting pants with proper waist and leg draping")
                
                # Dresses
                elif 'dress' in hint_lower or 'платье' in hint_lower:
                    category_instructions.append("FULL LENGTH DRESS: covers torso and extends to legs")
                    category_instructions.append("naturally flowing dress with realistic body contours")
                
                # Skirts
                elif 'skirt' in hint_lower or 'юбка' in hint_lower:
                    category_instructions.append("SKIRT ONLY: fit on waist and hips area")
                    category_instructions.append("do not cover upper body")
                    category_instructions.append("naturally fitting skirt starting at waist")
                
                # Jackets/Coats
                elif 'jacket' in hint_lower or 'coat' in hint_lower or 'куртка' in hint_lower or 'пальто' in hint_lower:
                    category_instructions.append("OUTER GARMENT: jacket or coat worn over existing clothing")
                    category_instructions.append("naturally fitting outerwear with proper shoulder fit")
                
                # Shoes
                elif 'shoes' in hint_lower or 'boots' in hint_lower or 'обувь' in hint_lower or 'туфли' in hint_lower or 'ботинки' in hint_lower or 'сапоги' in hint_lower:
                    category_instructions.append("FOOTWEAR ONLY: fit on feet and lower legs area")
                    category_instructions.append("do not affect upper body or torso")
                    category_instructions.append("realistic shoes or boots on feet")
                
                # Accessories
                elif 'accessory' in hint_lower or 'hat' in hint_lower or 'шляпа' in hint_lower or 'шарф' in hint_lower or 'scarf' in hint_lower:
                    category_instructions.append("ACCESSORY ONLY: small item worn on appropriate body part")
                    category_instructions.append("do not replace main clothing")
                
                # Default fallback
                else:
                    category_instructions.append(f"garment type: {category_hint}")
            
            # Realism prompts
            realism_prompts = [
                "photorealistic high quality",
                "natural lighting and shadows",
                "preserve exact original garment colors and patterns",
                "realistic fabric texture and draping",
                "natural wrinkles and folds",
                "maintain all garment details",
                "professional photography quality",
                "natural body fit and proportions",
                "correct garment placement on body"
            ]
            
            # Combine all parts
            all_parts = []
            if base_description:
                all_parts.append(base_description)
            all_parts.extend(category_instructions)
            all_parts.extend(realism_prompts)
            
            detailed_description = ' '.join(all_parts)
            
            payload = {
                "human_image_url": person_image,
                "garment_image_url": garment_image,
                "description": detailed_description,
                "num_inference_steps": 50,
                "guidance_scale": 2.0
            }
            
            print(f"Using IDM-VTON model, category hint: {category_hint}")
            print(f"Full description: {detailed_description}")
            
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