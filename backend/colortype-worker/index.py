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

PROMPT_TEMPLATE = """Determine a person's colortype based on the uploaded photo.

IMPORTANT HINTS:
- This person has {eye_color} eyes
- Look at the hair color closer to the roots (it's more accurate), but consider the entire length
- Focus ONLY on skin, hair, and eyes colors - IGNORE clothes and background colors

There are 12 skin tone types: VIVID WINTER, SOFT WINTER, BRIGHT WINTER, SOFT SUMMER, DUSTY SUMMER, VIVID SUMMER, GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, GENTLE SPRING, BRIGHT SPRING, VIBRANT SPRING

=== STEP 1: DETERMINE WARM OR COOL UNDERTONE ===

First, identify if the person has WARM or COOL skin undertone:
- COOL (blue-based): Pinkish-beige skin, ash/cool hair tones → WINTER or SUMMER types
- WARM (golden-based): Yellowish-beige/golden skin, red-gold hair tones → AUTUMN or SPRING types

CRITICAL: After determining warm/cool, you MUST choose from ONLY these options:
- If COOL → Choose from: VIVID WINTER, SOFT WINTER, BRIGHT WINTER, SOFT SUMMER, DUSTY SUMMER, VIVID SUMMER
- If WARM → Choose from: GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, GENTLE SPRING, BRIGHT SPRING, VIBRANT SPRING

Write your Step 1 conclusion: "COOL undertone - considering only Winter/Summer types" OR "WARM undertone - considering only Autumn/Spring types"

=== STEP 2: DETERMINE CONTRAST AND SEASON (use ONLY the 6 types from Step 1) ===

Now analyze the TRIAD (hair + skin + eyes relationship):

For COOL undertones (Winter/Summer):
- WINTER = HIGH CONTRAST/CLARITY between hair, skin, eyes (distinct differences) → dark hair
- SUMMER = DIMENSIONAL/DIFFUSED (subtle, blended, less contrast) → lighter hair

For WARM undertones (Autumn/Spring):
- AUTUMN = DIMENSIONAL/SATURATED, darker hair, less vibrant than Spring
- SPRING = BRIGHT/LIGHT, light and vibrant hair colors

CRITICAL: Narrow down to 3 specific types based on Step 1 + Step 2:
- Cool + Winter → VIVID WINTER, SOFT WINTER, or BRIGHT WINTER
- Cool + Summer → SOFT SUMMER, DUSTY SUMMER, or VIVID SUMMER
- Warm + Autumn → GENTLE AUTUMN, FIERY AUTUMN, or VIVID AUTUMN
- Warm + Spring → GENTLE SPRING, BRIGHT SPRING, or VIBRANT SPRING

Write your Step 2 conclusion: List the 3 specific types you're considering.

=== STEP 3: MATCH TO EXACT COLORTYPE (choose ONLY from your 3 types above) ===

Now match to ONE of your 3 types using these EXACT characteristics:

GENTLE AUTUMN: HAIR: Dark honey (tawny), gentle auburn | EYES: Turquoise blue, jade, light brown | SKIN: Light warm beige
FIERY AUTUMN: HAIR: Dark honey, all warm browns (light to deep chestnut), medium to deep auburn | EYES: Turquoise blue, hazel (golden), green, brown-green, brown | SKIN: Alabaster, light to medium warm beige, café au lait, russet
VIVID AUTUMN: HAIR: Dark chestnut, dark auburn, espresso | EYES: Brown, brown-green | SKIN: Pale warm beige, medium warm beige, chestnut, mahogany

GENTLE SPRING: HAIR: Golden blond, light strawberry blond | EYES: Blue, blue-green | SKIN: Ivory, light warm beige
BRIGHT SPRING: HAIR: Golden blond, honey blond, light to medium golden brown, strawberry blond, light clear red | EYES: Blue, green, blue-green | SKIN: Ivory, light warm beige, honey
VIBRANT SPRING: HAIR: Bright auburn, medium golden brown | EYES: Blue, green, golden brown (rare) | SKIN: Ivory, light to medium warm beige, medium golden brown

SOFT WINTER: HAIR: Medium-deep cool brown, deep cool brown | EYES: Blue, green, gray | SKIN: Pale porcelain
BRIGHT WINTER: HAIR: Dark cool brown, black | EYES: Brown, blue, brown-green, green, gray | SKIN: Pale to medium beige, light to medium olive, coffee
VIVID WINTER: HAIR: Black, dark cool brown | EYES: Black-brown, brown, brown-green | SKIN: Medium beige, medium to deep olive, café noir, ebony

SOFT SUMMER: HAIR: Pale to medium cool blond | EYES: Blue, gray-blue, gray-green | SKIN: Porcelain, light beige
DUSTY SUMMER: HAIR: Medium to deep cool blond, light to medium-deep cool brown | EYES: Gray-blue, gray-green, blue | SKIN: Light beige, medium beige, almond
VIVID SUMMER: HAIR: Light to deep cool brown, medium dark cool brown | EYES: Blue-gray, blue-green, gray-green, cocoa (rare) | SKIN: Medium beige, cocoa

CRITICAL VERIFICATION BEFORE ANSWERING:
1. Does your chosen type match Step 1 undertone (warm/cool)?
2. Does your chosen type match Step 2 season?
3. Does the person's EXACT eye/hair/skin colors appear in the description?
4. If ANY answer is NO → go back and choose a different type from your Step 2 list

=== FINAL ANSWER ===

Respond with ONLY the color type name (e.g., "BRIGHT WINTER") and a brief 2-3 sentence explanation in Russian language that references the specific hair/eye/skin colors you observed."""

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

def submit_to_replicate(image_url: str, eye_color: str = 'brown') -> str:
    '''Submit task to Replicate BAGEL API and return prediction_id'''
    replicate_api_key = os.environ.get('REPLICATE_API_TOKEN')
    if not replicate_api_key:
        raise Exception('REPLICATE_API_TOKEN not configured')
    
    headers = {
        'Authorization': f'Bearer {replicate_api_key}',
        'Content-Type': 'application/json'
    }
    
    # Format prompt with eye color
    prompt = PROMPT_TEMPLATE.format(eye_color=eye_color)
    
    payload = {
        'version': '7dd8def79e503990740db4704fa81af995d440fefe714958531d7044d2757c9c',
        'input': {
            'task': 'image-understanding',
            'image': image_url,
            'prompt': prompt
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
    replicate_api_key = os.environ.get('REPLICATE_API_TOKEN')
    if not replicate_api_key:
        raise Exception('REPLICATE_API_TOKEN not configured')
    
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

def refund_balance_if_needed(conn, user_id: str, task_id: str) -> None:
    '''Refund 30 rubles to user balance if not unlimited and not already refunded'''
    try:
        cursor = conn.cursor()
        
        # Check if already refunded
        cursor.execute('SELECT refunded FROM color_type_history WHERE id = %s', (task_id,))
        refund_row = cursor.fetchone()
        
        if refund_row and refund_row[0]:
            print(f'[Refund] Task {task_id} already refunded, skipping')
            cursor.close()
            return
        
        # Check if user has unlimited access
        cursor.execute('SELECT unlimited_access FROM users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            print(f'[Refund] User {user_id} not found')
            cursor.close()
            return
        
        unlimited_access = user_row[0]
        
        if unlimited_access:
            print(f'[Refund] User {user_id} has unlimited access, no refund needed')
            cursor.execute('UPDATE color_type_history SET refunded = true WHERE id = %s', (task_id,))
            conn.commit()
            cursor.close()
            return
        
        # Refund 30 rubles
        cursor.execute('UPDATE users SET balance = balance + 30 WHERE id = %s', (user_id,))
        cursor.execute('UPDATE color_type_history SET refunded = true WHERE id = %s', (task_id,))
        conn.commit()
        
        print(f'[Refund] Refunded 30 rubles to user {user_id} for task {task_id}')
        cursor.close()
        
    except Exception as e:
        print(f'[Refund] Error refunding balance: {str(e)}')

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
        
        # FIRST: Check for stuck tasks older than 3 minutes and save completed ones to history
        print(f'[ColorType-Worker] Checking for stuck completed tasks older than 3 minutes...')
        cursor.execute('''
            SELECT id, replicate_prediction_id, user_id, created_at
            FROM color_type_history
            WHERE status = 'processing' 
              AND replicate_prediction_id IS NOT NULL
              AND created_at < NOW() - INTERVAL '3 minutes'
            ORDER BY created_at ASC
            LIMIT 10
        ''')
        
        stuck_tasks = cursor.fetchall()
        print(f'[ColorType-Worker] Found {len(stuck_tasks)} stuck tasks to check')
        
        for stuck_task in stuck_tasks:
            stuck_id, stuck_prediction_id, stuck_user_id, stuck_created = stuck_task
            print(f'[ColorType-Worker] Checking stuck task {stuck_id} (created {stuck_created})')
            
            try:
                replicate_data = check_replicate_status(stuck_prediction_id)
                replicate_status = replicate_data.get('status', 'unknown')
                
                if replicate_status == 'succeeded':
                    output = replicate_data.get('output', '')
                    
                    # Extract text from output (Replicate BAGEL returns dict or list)
                    if isinstance(output, dict):
                        result_text_value = output.get('text', str(output))
                    elif isinstance(output, list) and len(output) > 0:
                        result_text_value = output[0] if isinstance(output[0], str) else str(output[0])
                    elif isinstance(output, str):
                        result_text_value = output
                    else:
                        result_text_value = str(output)
                    
                    if result_text_value:
                        color_type = extract_color_type(result_text_value)
                        print(f'[ColorType-Worker] Stuck task {stuck_id} is completed! Color type: {color_type}')
                        print(f'[ColorType-Worker] Result preview: {result_text_value[:100]}...')
                        
                        cursor.execute('''
                            UPDATE color_type_history
                            SET status = 'completed', result_text = %s, color_type = %s, saved_to_history = true, updated_at = %s
                            WHERE id = %s
                        ''', (result_text_value, color_type, datetime.utcnow(), stuck_id))
                        conn.commit()
                        print(f'[ColorType-Worker] Stuck task {stuck_id} SAVED to history!')
                
                elif replicate_status == 'failed':
                    error_msg = replicate_data.get('error', 'Analysis failed')
                    print(f'[ColorType-Worker] Stuck task {stuck_id} failed: {error_msg}')
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'failed', result_text = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), stuck_id))
                    conn.commit()
                    
                    # Refund balance for failed task
                    refund_balance_if_needed(conn, stuck_user_id, stuck_id)
                else:
                    print(f'[ColorType-Worker] Stuck task {stuck_id} still processing on Replicate (status: {replicate_status})')
                
            except Exception as e:
                print(f'[ColorType-Worker] Error checking stuck task {stuck_id}: {str(e)}')
        
        # NOW: Get current task
        cursor.execute('''
            SELECT id, person_image, replicate_prediction_id, user_id, status, saved_to_history, eye_color
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
        
        task_id, person_image, replicate_prediction_id, user_id, task_status, saved_to_history, eye_color = task_row
        eye_color = eye_color or 'brown'  # Default to brown if None
        
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
                print(f'[ColorType-Worker] Submitting to Replicate BAGEL with eye_color: {eye_color}')
                prediction_id = submit_to_replicate(cdn_url, eye_color)
                
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
                
                # Extract text from output (Replicate BAGEL returns dict or list)
                if isinstance(output, dict):
                    result_text_value = output.get('text', str(output))
                elif isinstance(output, list) and len(output) > 0:
                    result_text_value = output[0] if isinstance(output[0], str) else str(output[0])
                elif isinstance(output, str):
                    result_text_value = output
                else:
                    result_text_value = str(output)
                
                if result_text_value:
                    color_type = extract_color_type(result_text_value)
                    print(f'[ColorType-Worker] Analysis complete! Color type: {color_type}')
                    print(f'[ColorType-Worker] Result preview: {result_text_value[:100]}...')
                    
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'completed', result_text = %s, color_type = %s, saved_to_history = true, updated_at = %s
                        WHERE id = %s
                    ''', (result_text_value, color_type, datetime.utcnow(), task_id))
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
                
                # Refund balance for failed task
                refund_balance_if_needed(conn, user_id, task_id)
                
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
        
        # Task processing complete
        
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