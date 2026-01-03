import json
import os
import psycopg2
from typing import Dict, Any, Optional
import requests
from datetime import datetime
import boto3
import time
import uuid
import base64

PROMPT = """Analyze the person in this photo and determine their seasonal color type from these 12 categories:

WINTER (Cool undertone + High contrast):
- Soft Winter: Medium-deep cool brown/deep cool brown hair, blue/green/gray eyes, pale porcelain skin
- Bright Winter: Dark cool brown/black hair, brown/blue/brown-green/green/gray eyes, pale to medium beige/light to medium olive/coffee skin
- Vivid Winter: Black/dark cool brown hair, black-brown/brown/brown-green eyes, medium beige/medium to deep olive/café noir/ebony skin

SUMMER (Cool undertone + Dimensional/diffused):
- Soft Summer: Pale to medium cool blond hair, blue/gray-blue/gray-green eyes, porcelain/light beige skin
- Dusty Summer: Medium to deep cool blond/light to medium-deep cool brown hair, gray-blue/gray-green/blue eyes, light beige/medium beige/almond skin
- Vivid Summer: Light to deep cool brown/medium dark cool brown hair, blue-gray/blue-green/gray-green/cocoa eyes, medium beige/cocoa skin

AUTUMN (Warm undertone + Dimensional/saturated):
- Gentle Autumn: Dark honey/gentle auburn hair, turquoise blue/jade/light brown eyes, light warm beige skin
- Fiery Autumn: Dark honey/warm browns/medium to deep auburn hair, turquoise blue/hazel/green/brown-green/brown eyes, alabaster/light to medium warm beige/café au lait/russet skin
- Vivid Autumn: Dark chestnut/dark auburn/espresso hair, brown/brown-green eyes, pale warm beige/medium warm beige/chestnut/mahogany skin

SPRING (Warm undertone + Light/bright contrast):
- Gentle Spring: Golden blond/light strawberry blond hair, blue/blue-green eyes, ivory/light warm beige skin
- Bright Spring: Golden blond/honey blond/light to medium golden brown/strawberry blond/light clear red hair, blue/green/blue-green eyes, ivory/light warm beige/honey skin
- Vibrant Spring: Bright auburn/medium golden brown hair, blue/green/golden brown eyes, ivory/light to medium warm beige/medium golden brown skin

Evaluate: 1) Skin undertone (cool blue-based vs warm golden-based), 2) Hair base color (ash/cool vs red-gold/warm), 3) Eye impression, 4) Contrast level (clarity vs dimension).

Respond with ONLY the color type name (e.g., "BRIGHT WINTER") and a brief 2-3 sentence explanation in English."""

def normalize_image_format(image: str) -> str:
    '''Convert image to data URI format if needed'''
    if image.startswith('http://') or image.startswith('https://'):
        return image
    
    if image.startswith('data:'):
        return image
    
    return f'data:image/jpeg;base64,{image}'

def upload_to_yandex_storage(image_data: str, user_id: str, task_id: str) -> str:
    '''Upload image to Yandex Object Storage, return CDN URL'''
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    
    if not s3_access_key or not s3_secret_key:
        raise Exception('S3 credentials not configured (S3_ACCESS_KEY, S3_SECRET_KEY)')
    
    # Decode base64 if needed
    if image_data.startswith('data:image'):
        image_data = image_data.split(',', 1)[1]
    
    image_bytes = base64.b64decode(image_data)
    print(f'[Yandex] Decoded {len(image_bytes)} bytes')
    
    # Generate filename: colortypes/{user_id}/{task_id}.jpg
    s3_key = f'images/colortypes/{user_id}/{task_id}.jpg'
    
    print(f'[Yandex] Uploading to: {s3_key}')
    
    # Upload to Yandex Object Storage
    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key
    )
    
    s3.put_object(
        Bucket=s3_bucket,
        Key=s3_key,
        Body=image_bytes,
        ContentType='image/jpeg'
    )
    
    # Build Yandex Cloud Storage URL
    cdn_url = f'https://storage.yandexcloud.net/{s3_bucket}/{s3_key}'
    print(f'[Yandex] Upload complete! URL: {cdn_url}')
    
    return cdn_url

def submit_to_replicate(image_url: str) -> str:
    '''Submit task to Replicate BAGEL API and return prediction_id'''
    replicate_api_key = os.environ.get('REPLICATE_API_KEY')
    if not replicate_api_key:
        raise Exception('REPLICATE_API_KEY not configured')
    
    headers = {
        'Authorization': f'Bearer {replicate_api_key}',
        'Content-Type': 'application/json',
        'Prefer': 'wait'
    }
    
    payload = {
        'version': 'bytedance/bagel:latest',
        'input': {
            'image_url': image_url,
            'prompt': PROMPT
        }
    }
    
    print(f'[Replicate] Submitting to BAGEL API...')
    response = requests.post(
        'https://api.replicate.com/v1/predictions',
        headers=headers,
        json=payload,
        timeout=30
    )
    
    if response.status_code in [200, 201]:
        result = response.json()
        prediction_id = result.get('id')
        print(f'[Replicate] Prediction created: {prediction_id}')
        return prediction_id
    
    raise Exception(f'Failed to submit to Replicate: {response.status_code} - {response.text}')

def check_replicate_status(prediction_id: str) -> Optional[dict]:
    '''Check status of Replicate prediction'''
    replicate_api_key = os.environ.get('REPLICATE_API_KEY')
    if not replicate_api_key:
        raise Exception('REPLICATE_API_KEY not configured')
    
    headers = {
        'Authorization': f'Bearer {replicate_api_key}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        f'https://api.replicate.com/v1/predictions/{prediction_id}',
        headers=headers,
        timeout=10
    )
    
    if response.status_code == 200:
        return response.json()
    
    raise Exception(f'Failed to check status: {response.status_code} - {response.text}')

def extract_color_type(result_text: str) -> Optional[str]:
    '''Extract color type name from result text'''
    color_types = [
        'SOFT WINTER', 'BRIGHT WINTER', 'VIVID WINTER',
        'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER',
        'GENTLE AUTUMN', 'FIERY AUTUMN', 'VIVID AUTUMN',
        'GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING'
    ]
    
    result_upper = result_text.upper()
    for color_type in color_types:
        if color_type in result_upper:
            return color_type
    
    return None

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Обработка задачи анализа цветотипа по task_id
    Args: event - dict с httpMethod, queryStringParameters (task_id)
          context - object с атрибутом request_id
    Returns: HTTP response со статусом обработки
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    query_params = event.get('queryStringParameters') or {}
    task_id = query_params.get('task_id')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id parameter is required'})
        }
    
    print(f'[ColorType-Worker] Processing task: {task_id}')
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Get task
        cursor.execute('''
            SELECT id, person_image, replicate_prediction_id, user_id, status, saved_to_history
            FROM color_type_history
            WHERE id = %s
        ''', (task_id,))
        
        task_row = cursor.fetchone()
        
        if not task_row:
            print(f'[ColorType-Worker] Task {task_id} not found')
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        task_id, person_image, replicate_prediction_id, user_id, task_status, saved_to_history = task_row
        
        # Check if already processed
        if saved_to_history:
            print(f'[ColorType-Worker] Task {task_id} already saved to history, skipping')
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'status': 'already_processed'})
            }
        
        # Process pending task
        if task_status == 'pending':
            if not replicate_prediction_id:
                # ATOMIC: Mark as processing FIRST
                print(f'[ColorType-Worker] Task {task_id}: ATOMIC UPDATE to prevent duplicate submission')
                cursor.execute('''
                    UPDATE color_type_history
                    SET status = 'processing', updated_at = %s
                    WHERE id = %s AND status = 'pending'
                    RETURNING id
                ''', (datetime.utcnow(), task_id))
                updated_row = cursor.fetchone()
                conn.commit()
                
                if not updated_row:
                    print(f'[ColorType-Worker] Task {task_id} already being processed, skipping')
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'task_already_processing'})
                    }
                
                print(f'[ColorType-Worker] Task {task_id} marked as processing')
                
                # Upload image to Yandex Storage
                print(f'[ColorType-Worker] Uploading image to Yandex Storage')
                cdn_url = upload_to_yandex_storage(person_image, user_id, task_id)
                
                # Submit to Replicate
                print(f'[ColorType-Worker] Submitting to Replicate BAGEL')
                prediction_id = submit_to_replicate(cdn_url)
                
                # Update DB with prediction_id
                cursor.execute('''
                    UPDATE color_type_history
                    SET replicate_prediction_id = %s, updated_at = %s
                    WHERE id = %s
                ''', (prediction_id, datetime.utcnow(), task_id))
                conn.commit()
                
                print(f'[ColorType-Worker] Task {task_id} submitted to Replicate: {prediction_id}')
                
                cursor.close()
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'isBase64Encoded': False,
                    'body': json.dumps({'status': 'submitted', 'prediction_id': prediction_id})
                }
        
        # Process processing task
        if task_status == 'processing' and replicate_prediction_id:
            print(f'[ColorType-Worker] Checking Replicate status for {replicate_prediction_id}')
            replicate_data = check_replicate_status(replicate_prediction_id)
            replicate_status = replicate_data.get('status', 'unknown')
            
            print(f'[ColorType-Worker] Replicate status: {replicate_status}')
            
            if replicate_status == 'succeeded':
                output = replicate_data.get('output', '')
                
                if output:
                    color_type = extract_color_type(output)
                    print(f'[ColorType-Worker] Analysis complete! Color type: {color_type}')
                    
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'completed', result_text = %s, color_type = %s, saved_to_history = true, updated_at = %s
                        WHERE id = %s
                    ''', (output, color_type, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    print(f'[ColorType-Worker] Task {task_id} completed and saved to history')
                    
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'completed', 'color_type': color_type})
                    }
            
            elif replicate_status == 'failed':
                error_msg = replicate_data.get('error', 'Analysis failed')
                print(f'[ColorType-Worker] Task failed: {error_msg}')
                
                cursor.execute('''
                    UPDATE color_type_history
                    SET status = 'failed', result_text = %s, updated_at = %s
                    WHERE id = %s
                ''', (error_msg, datetime.utcnow(), task_id))
                conn.commit()
                
                cursor.close()
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'isBase64Encoded': False,
                    'body': json.dumps({'status': 'failed', 'error': error_msg})
                }
            
            else:
                print(f'[ColorType-Worker] Still processing on Replicate')
                cursor.close()
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'isBase64Encoded': False,
                    'body': json.dumps({'status': 'still_processing'})
                }
        
        cursor.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'status': task_status})
        }
        
    except Exception as e:
        print(f'[ColorType-Worker] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }
