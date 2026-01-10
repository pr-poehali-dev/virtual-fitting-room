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


# Updated prompt with THE BASE and TRIAD concepts
# VIBRANT SPRING now includes warm light brown/golden brown hair with bright eyes




REFERENCE_SCHEMA_URL = "https://cdn.poehali.dev/files/colortypes.jpg"

PROMPT_TEMPLATE = """Determine a person's colortype based on the uploaded photo.

REFERENCE SCHEMA: Compare the person in the photo with reference faces from the color type wheel schema at {schema_url}

IMPORTANT HINTS:
- This person has {eye_color} eyes
- Look at the hair color at the roots (natural color)
- Focus ONLY on skin, hair, and eyes - IGNORE clothes and background
- Compare this person's features with similar faces on the reference schema

There are EXACTLY 12 valid color types: VIVID WINTER, SOFT WINTER, BRIGHT WINTER, SOFT SUMMER, DUSTY SUMMER, VIVID SUMMER, GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, GENTLE SPRING, BRIGHT SPRING, VIBRANT SPRING

=== STEP 1: WARM OR COOL? ===

Look at the HAIR COLOR FIRST:
- RED, AUBURN, GOLDEN, COPPER, WARM BROWN hair → WARM undertone → Choose from: GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, GENTLE SPRING, BRIGHT SPRING, VIBRANT SPRING
- ASH, COOL BROWN, BLACK, PLATINUM hair → COOL undertone → Choose from: VIVID WINTER, SOFT WINTER, BRIGHT WINTER, SOFT SUMMER, DUSTY SUMMER, VIVID SUMMER

CRITICAL RULE: If hair has ANY red/golden/copper tones = AUTOMATICALLY WARM = MUST be Autumn or Spring!

=== STEP 2: HAIR DEPTH ===

For WARM undertones (red/golden/auburn hair):
- DARKEST hair (dark chestnut, espresso brown - very deep) → Choose from: GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN
- LIGHT GOLDEN BLONDE (pale, soft golden tones, low contrast) → GENTLE SPRING
- MEDIUM GOLDEN BLONDE (richer honey/caramel, MORE YELLOW, high contrast) → BRIGHT SPRING
- WARM LIGHT BROWN/GOLDEN BROWN or FIERY AUBURN/COPPER + BRIGHT EYES + light skin + HIGH CONTRAST → VIBRANT SPRING
- AUBURN/WARM BROWN + warm beige/café au lait skin (NOT light/pale) → FIERY AUTUMN

CRITICAL: 
- VIBRANT SPRING = warm light brown/golden brown OR auburn + BRIGHT vivid eyes + light warm skin + HIGH CONTRAST!
- GENTLE Spring = lighter/softer hair, BRIGHT Spring = richer/more yellow hair!

For COOL undertones (ash/cool black hair):
- DARK hair (black, dark cool brown) → Choose from: VIVID WINTER, SOFT WINTER, BRIGHT WINTER
- LIGHT hair (cool blonde, light cool brown) → Choose from: SOFT SUMMER, DUSTY SUMMER, VIVID SUMMER

=== STEP 3: EXACT TYPE ===

Match to ONE type from your 3 options:

WARM + DARK hair → Autumn types:
- GENTLE AUTUMN: Dark honey/gentle auburn, turquoise blue/jade/light brown eyes, light warm beige skin
- FIERY AUTUMN: Medium-bright auburn/warm brown, turquoise blue/hazel/green/brown eyes, warm beige/café au lait/russet skin (NOT pale ivory!)
- VIVID AUTUMN: DARKEST warm hair (dark chestnut/espresso brown - NO auburn!), brown/brown-green eyes, pale to medium warm beige or darker skin

WARM + LIGHT/BRIGHT hair → Spring types:
- GENTLE SPRING: LIGHT golden blonde/pale honey blonde (very light, almost platinum warmth), blue/blue-green eyes, ivory/porcelain skin, SOFT LOW-CONTRAST delicate appearance
- BRIGHT SPRING: MEDIUM golden blonde/rich honey blonde/warm caramel (MORE YELLOW, warmer, richer than Gentle), blue/green/blue-green eyes, ivory/warm beige skin, BRIGHT HIGH-CONTRAST warm appearance
- VIBRANT SPRING: Warm light brown/golden brown OR fiery auburn/copper red hair + BRIGHT EYES (vivid blue/green/gray-blue) + light warm skin (ivory/light beige) + HIGH CONTRAST vibrant appearance!

COOL + DARK hair → Winter types:
- SOFT WINTER: Medium-deep to deep cool brown, blue/green/gray eyes, pale porcelain skin
- BRIGHT WINTER: Dark cool brown/black, brown/blue/brown-green/green/gray eyes, pale to medium beige or olive skin
- VIVID WINTER: Black/dark cool brown, black-brown/brown/brown-green eyes, medium beige to deep olive or darker skin

COOL + LIGHT hair → Summer types:
- SOFT SUMMER: Pale to medium cool blonde, blue/gray-blue/gray-green eyes, porcelain/light beige skin
- DUSTY SUMMER: Medium-deep cool blonde or light-medium cool brown, gray-blue/gray-green/blue eyes, light to medium beige skin
- VIVID SUMMER: Light to deep cool brown, blue-gray/blue-green/gray-green/cocoa eyes, medium beige/cocoa skin

=== VERIFICATION ===

Before answering:
1. Does {eye_color} eyes match your chosen type?
2. Hair color check:
   - GOLDEN BLONDE (light/medium golden, honey, caramel - NO red!) → GENTLE SPRING or BRIGHT SPRING
   - FIERY RED/AUBURN/COPPER (clearly red-orange tones) → VIBRANT SPRING or FIERY AUTUMN
   - DARK CHESTNUT/ESPRESSO (very dark warm brown) → VIVID AUTUMN
3. If hair has red/golden tones → MUST be Autumn or Spring (NOT Winter/Summer)
4. Is your answer ONE OF THE 12 TYPES above?

KEY DISTINCTIONS:

GOLDEN BLONDE types (pale to medium blonde, NO red/brown!):
- GENTLE SPRING: LIGHT/PALE golden blonde (almost platinum-warm) + SOFT LOW-CONTRAST delicate look + porcelain/ivory skin
- BRIGHT SPRING: MEDIUM golden/honey blonde (MORE YELLOW, richer, warmer) + BRIGHT HIGH-CONTRAST warm look + warm beige skin

How to distinguish GENTLE vs BRIGHT Spring:
- Hair depth: GENTLE = lighter (pale blonde), BRIGHT = medium (richer honey/caramel)
- Warmth intensity: GENTLE = soft subtle warmth, BRIGHT = strong yellow-golden warmth
- Overall contrast: GENTLE = low-contrast delicate, BRIGHT = high-contrast vibrant

VIBRANT SPRING (warm light brown/golden brown OR auburn/copper hair!):
- KEY FEATURE: BRIGHT VIVID EYES (blue/green/gray-blue - very bright and clear!) + light warm skin (ivory/light beige) + HIGH CONTRAST vibrant appearance
- Hair: Warm light brown, golden brown, OR fiery auburn/copper red
- NOT just golden blonde! Has MORE depth (light brown tones) or red tones
- If eyes are NOT bright/vivid → NOT Vibrant Spring!

FIERY AUTUMN vs VIBRANT SPRING:
- VIBRANT SPRING: Warm brown/auburn + BRIGHT vivid eyes + LIGHT skin (ivory/light beige) + HIGH CONTRAST
- FIERY AUTUMN: Auburn/warm brown + hazel/brown/green eyes (NOT vivid blue!) + warm beige/café au lait skin (warmer, NOT pale ivory)

If person has GOLDEN BLONDE hair (not brown/red!) + light skin + blue-green eyes → BRIGHT SPRING or GENTLE SPRING (NOT Vibrant Spring!)

=== FINAL ANSWER ===

Write ONLY ONE of these 12 types on first line:
VIVID WINTER, SOFT WINTER, BRIGHT WINTER, SOFT SUMMER, DUSTY SUMMER, VIVID SUMMER, GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, GENTLE SPRING, BRIGHT SPRING, or VIBRANT SPRING

Then write 2-3 sentences explaining why, describing the REAL hair color, eye color, and skin tone you see in THIS photo."""

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
    '''Submit task to Replicate LLaVA-13b API and return prediction_id'''
    replicate_api_key = os.environ.get('REPLICATE_API_TOKEN')
    if not replicate_api_key:
        raise Exception('REPLICATE_API_TOKEN not configured')
    
    headers = {
        'Authorization': f'Bearer {replicate_api_key}',
        'Content-Type': 'application/json'
    }
    
    # Format prompt with eye color and schema URL
    prompt = PROMPT_TEMPLATE.format(eye_color=eye_color, schema_url=REFERENCE_SCHEMA_URL)
    
    payload = {
        'version': '2facb4a474a0462c15041b78b1ad70952ea46b5ec6ad29583c0b29dbd4249591',
        'input': {
            'image': image_url,
            'prompt': prompt
        }
    }
    
    print(f'[Replicate] Submitting to LLaVA-13b API...')
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
    Worker анализа цветотипа
    Args: event - dict с httpMethod, queryStringParameters (task_id)
          context - object с атрибутом request_id
    Returns: HTTP response со статусом
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
                    
                    # Extract text from output (LLaVA returns list of strings)
                    if isinstance(output, list) and len(output) > 0:
                        result_text_value = ''.join(output) if all(isinstance(x, str) for x in output) else str(output)
                    elif isinstance(output, str):
                        result_text_value = output
                    elif isinstance(output, dict):
                        result_text_value = output.get('text', str(output))
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
                print(f'[ColorType-Worker] Submitting to Replicate LLaVA-13b with eye_color: {eye_color}')
                prediction_id = submit_to_replicate(cdn_url, eye_color)
                
                # Update DB with prediction_id and cdn_url
                cursor.execute('''
                    UPDATE color_type_history
                    SET replicate_prediction_id = %s, cdn_url = %s, updated_at = %s
                    WHERE id = %s
                ''', (prediction_id, cdn_url, datetime.utcnow(), task_id))
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
                
                # Extract text from output (LLaVA returns list of strings)
                if isinstance(output, list) and len(output) > 0:
                    result_text_value = ''.join(output) if all(isinstance(x, str) for x in output) else str(output)
                elif isinstance(output, str):
                    result_text_value = output
                elif isinstance(output, dict):
                    result_text_value = output.get('text', str(output))
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