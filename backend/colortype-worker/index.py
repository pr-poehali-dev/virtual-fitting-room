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
# Reverted composite image approach - using single photo analysis




REFERENCE_SCHEMA_URL = "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/colortypes.jpg"

PROMPT_TEMPLATE = '''CRITICAL: Analyze THIS SPECIFIC PHOTO carefully. Do not use example values - analyze the REAL colors you see in THIS image.

HINT: This person has {eye_color} eyes.

=== STEP 1: ANALYZE THE PHOTO ===

Look at THIS photo very carefully and determine:

1. UNDERTONE - Look at the hair and skin tone temperature:
   - Choose WARM-UNDERTONE if: golden/yellow/peachy/red/orange tones in hair or skin (warm base)
   - Choose COOL-UNDERTONE if: ash/blue/pink/violet tones in hair or skin (cool base)

2. LIGHTNESS - How light or dark are the overall colors (hair + skin):
   - Choose LIGHT-COLORS if: very light hair (blond, light brown) AND light/pale skin
   - Choose MEDIUM-LIGHTNESS-COLORS if: medium tones - not very light, not very dark (medium brown hair, medium skin)
   - Choose DEEP-COLORS if: dark hair (dark brown, black) OR deep skin tones

3. SATURATION - How vivid/muted are the colors (independent from lightness):
   - Choose MUTED-SATURATION-COLORS if: dusty, subdued, grayish, soft colors (low saturation)
   - Choose NEUTRAL-SATURATION-COLORS if: moderate saturation, neither muted nor bright
   - Choose BRIGHT-SATURATION-COLORS if: clear, vivid, pure colors (high saturation)

4. CONTRAST LEVEL - Compare hair, skin, and eyes in THIS photo:
   - Choose LOW-CONTRAST if: hair, skin, eyes are similar lightness (small difference)
   - Choose MEDIUM-CONTRAST if: moderate difference in lightness between features
   - Choose HIGH-CONTRAST if: very dramatic difference (e.g., very dark hair + very pale skin, or very light hair + dark skin)

5. DESCRIBE EXACT COLORS you see in THIS SPECIFIC PHOTO:
   - Hair: Use specific descriptors like "golden blond", "dark brown", "auburn", "black", "ash blond", "honey brown"
   - Eyes: Specific color like "blue", "green", "brown", "hazel", "gray-blue"
   - Skin: Specific tone like "ivory", "porcelain", "light warm beige", "medium beige", "olive", "deep brown"

=== OUTPUT FORMAT ===

Return ONLY a valid JSON object with your analysis of THIS SPECIFIC PHOTO:

{{
  "undertone": "[YOUR CHOICE: WARM-UNDERTONE or COOL-UNDERTONE]",
  "lightness": "[YOUR CHOICE: LIGHT-COLORS, MEDIUM-LIGHTNESS-COLORS, or DEEP-COLORS]",
  "saturation": "[YOUR CHOICE: MUTED-SATURATION-COLORS, NEUTRAL-SATURATION-COLORS, or BRIGHT-SATURATION-COLORS]",
  "contrast": "[YOUR CHOICE: LOW-CONTRAST, MEDIUM-CONTRAST, or HIGH-CONTRAST]",
  "hair_color": "[exact description of hair color YOU SEE]",
  "eye_color": "[exact description of eye color YOU SEE]",
  "skin_color": "[exact description of skin tone YOU SEE]"
}}

CRITICAL: Analyze the REAL photo, not the example format. Replace ALL bracketed placeholders with your actual analysis.'''

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
    
    # Format prompt with eye color
    prompt = PROMPT_TEMPLATE.format(eye_color=eye_color)
    
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

# Colortype reference data with keywords
COLORTYPE_REFERENCES = {
    'GENTLE AUTUMN': {
        'hair': ['dark honey', 'tawny', 'gentle auburn', 'honey', 'auburn'],
        'eyes': ['turquoise blue', 'jade', 'light brown', 'turquoise', 'hazel'],
        'skin': ['light warm beige', 'warm beige', 'beige']
    },
    'FIERY AUTUMN': {
        'hair': ['dark honey', 'warm brown', 'chestnut', 'auburn', 'deep auburn', 'medium auburn'],
        'eyes': ['turquoise blue', 'hazel', 'golden', 'green', 'brown-green', 'brown'],
        'skin': ['alabaster', 'light warm beige', 'warm beige', 'café au lait', 'russet']
    },
    'VIVID AUTUMN': {
        'hair': ['dark chestnut', 'dark auburn', 'espresso', 'deep brown', 'black'],
        'eyes': ['brown', 'brown-green', 'dark brown'],
        'skin': ['pale warm beige', 'medium warm beige', 'chestnut', 'mahogany']
    },
    'GENTLE SPRING': {
        'hair': ['golden blond', 'light strawberry blond', 'strawberry', 'light blond', 'golden'],
        'eyes': ['blue', 'blue-green', 'light blue'],
        'skin': ['ivory', 'light warm beige', 'pale']
    },
    'BRIGHT SPRING': {
        'hair': ['golden blond', 'honey blond', 'golden brown', 'strawberry blond', 'light clear red', 'medium golden brown'],
        'eyes': ['blue', 'green', 'blue-green', 'bright blue'],
        'skin': ['ivory', 'light warm beige', 'honey', 'warm beige']
    },
    'VIBRANT SPRING': {
        'hair': ['bright auburn', 'medium golden brown', 'auburn', 'golden brown'],
        'eyes': ['blue', 'green', 'golden brown', 'bright'],
        'skin': ['ivory', 'light warm beige', 'medium warm beige', 'medium golden brown']
    },
    'SOFT WINTER': {
        'hair': ['medium-deep cool brown', 'deep cool brown', 'cool brown', 'ashy brown'],
        'eyes': ['blue', 'green', 'gray', 'cool'],
        'skin': ['pale porcelain', 'porcelain', 'pale']
    },
    'BRIGHT WINTER': {
        'hair': ['dark cool brown', 'black', 'cool black', 'deep brown'],
        'eyes': ['brown', 'blue', 'brown-green', 'green', 'gray', 'dark'],
        'skin': ['pale beige', 'medium beige', 'light olive', 'medium olive', 'coffee']
    },
    'VIVID WINTER': {
        'hair': ['black', 'dark cool brown', 'cool black', 'jet black'],
        'eyes': ['black-brown', 'brown', 'brown-green', 'dark brown', 'black'],
        'skin': ['medium beige', 'deep olive', 'café noir', 'ebony', 'dark']
    },
    'SOFT SUMMER': {
        'hair': ['pale cool blond', 'medium cool blond', 'cool blond', 'ash blond', 'light ash'],
        'eyes': ['blue', 'gray-blue', 'gray-green', 'soft blue'],
        'skin': ['porcelain', 'light beige', 'pale']
    },
    'DUSTY SUMMER': {
        'hair': ['medium cool blond', 'deep cool blond', 'light cool brown', 'medium cool brown', 'ash brown'],
        'eyes': ['gray-blue', 'gray-green', 'blue', 'muted'],
        'skin': ['light beige', 'medium beige', 'almond']
    },
    'VIVID SUMMER': {
        'hair': ['light cool brown', 'deep cool brown', 'medium dark cool brown', 'cool brown'],
        'eyes': ['blue-gray', 'blue-green', 'gray-green', 'cocoa'],
        'skin': ['medium beige', 'cocoa', 'brown']
    }
}

# Mapping table: (undertone, lightness, saturation, contrast) -> colortype
COLORTYPE_MAP = {
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'DUSTY SUMMER',
    
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'VIVID WINTER',
    
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'FIERY AUTUMN',
}

def calculate_color_match_score(description: str, keywords: list) -> float:
    '''Calculate how well a color description matches reference keywords'''
    description_lower = description.lower()
    matches = sum(1 for keyword in keywords if keyword.lower() in description_lower)
    return matches / len(keywords) if keywords else 0.0

def match_colortype(analysis: dict) -> tuple:
    '''Match analysis to colortype using table + reference validation
    Returns: (colortype, explanation)
    '''
    undertone = analysis.get('undertone', '')
    lightness = analysis.get('lightness', '')
    saturation = analysis.get('saturation', '')
    contrast = analysis.get('contrast', '')
    hair = analysis.get('hair_color', '')
    eyes = analysis.get('eye_color', '')
    skin = analysis.get('skin_color', '')
    
    # Step 1: Try to get base colortype from mapping table
    base_colortype = COLORTYPE_MAP.get((undertone, lightness, saturation, contrast))
    
    if not base_colortype:
        # FALLBACK: If exact combination not found, search ALL 12 colortypes by color match
        print(f'[Match] No exact mapping for {undertone}/{lightness}/{saturation}/{contrast}, searching by color similarity...')
        
        best_colortype = None
        best_score = 0.0
        
        for colortype in COLORTYPE_REFERENCES.keys():
            ref = COLORTYPE_REFERENCES[colortype]
            h_score = calculate_color_match_score(hair, ref['hair'])
            s_score = calculate_color_match_score(skin, ref['skin'])
            e_score = calculate_color_match_score(eyes, ref['eyes'])
            total_score = (h_score * 0.51) + (s_score * 0.40) + (e_score * 0.09)
            
            print(f'[Match] Checking {colortype}: hair={h_score:.2f}, skin={s_score:.2f}, eyes={e_score:.2f}, total={total_score:.2f}')
            
            if total_score > best_score:
                best_score = total_score
                best_colortype = colortype
        
        explanation = f"No exact mapping for {undertone}/{lightness}/{saturation}/{contrast}. Best color match: {best_colortype} (score: {best_score:.2f}). Hair: {hair}, Skin: {skin}, Eyes: {eyes}."
        return best_colortype, explanation
    
    # Step 2: Calculate match scores for base colortype
    ref = COLORTYPE_REFERENCES[base_colortype]
    hair_score = calculate_color_match_score(hair, ref['hair'])
    skin_score = calculate_color_match_score(skin, ref['skin'])
    eyes_score = calculate_color_match_score(eyes, ref['eyes'])
    
    # Weighted score: hair 51%, skin 40%, eyes 9%
    base_score = (hair_score * 0.51) + (skin_score * 0.40) + (eyes_score * 0.09)
    
    print(f'[Match] Base type: {base_colortype}, scores: hair={hair_score:.2f}, skin={skin_score:.2f}, eyes={eyes_score:.2f}, total={base_score:.2f}')
    
    # Step 3: If good match, return base colortype
    if base_score >= 0.4:  # At least 40% match
        explanation = f"Based on {undertone}, {lightness}, {saturation}, {contrast}. Hair: {hair}, Skin: {skin}, Eyes: {eyes}. Matches {base_colortype} characteristics."
        return base_colortype, explanation
    
    # Step 4: Find best match in same season group
    season_group = base_colortype.split()[-1]  # AUTUMN, SPRING, WINTER, SUMMER
    same_season_types = [ct for ct in COLORTYPE_REFERENCES.keys() if season_group in ct]
    
    best_colortype = base_colortype
    best_score = base_score
    
    for colortype in same_season_types:
        ref = COLORTYPE_REFERENCES[colortype]
        h_score = calculate_color_match_score(hair, ref['hair'])
        s_score = calculate_color_match_score(skin, ref['skin'])
        e_score = calculate_color_match_score(eyes, ref['eyes'])
        total_score = (h_score * 0.51) + (s_score * 0.40) + (e_score * 0.09)
        
        print(f'[Match] Checking {colortype}: hair={h_score:.2f}, skin={s_score:.2f}, eyes={e_score:.2f}, total={total_score:.2f}')
        
        if total_score > best_score:
            best_score = total_score
            best_colortype = colortype
    
    explanation = f"Based on {undertone}, {lightness}, {saturation}, {contrast}. Hair: {hair}, Skin: {skin}, Eyes: {eyes}. Best match: {best_colortype} (score: {best_score:.2f})."
    return best_colortype, explanation

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
                        raw_result = ''.join(output) if all(isinstance(x, str) for x in output) else str(output)
                    elif isinstance(output, str):
                        raw_result = output
                    elif isinstance(output, dict):
                        raw_result = output.get('text', str(output))
                    else:
                        raw_result = str(output)
                    
                    if raw_result:
                        print(f'[ColorType-Worker] Stuck task {stuck_id} raw result: {raw_result[:200]}...')
                        
                        # Try to parse JSON from AI response
                        try:
                            # Extract JSON from markdown code blocks if present
                            json_str = raw_result
                            if '```json' in raw_result:
                                json_str = raw_result.split('```json')[1].split('```')[0].strip()
                            elif '```' in raw_result:
                                json_str = raw_result.split('```')[1].split('```')[0].strip()
                            
                            analysis = json.loads(json_str)
                            color_type, explanation = match_colortype(analysis)
                            result_text_value = explanation
                            
                            print(f'[ColorType-Worker] Stuck task {stuck_id} matched to: {color_type}')
                            print(f'[ColorType-Worker] Explanation: {explanation}')
                            
                        except (json.JSONDecodeError, KeyError, TypeError) as e:
                            print(f'[ColorType-Worker] Failed to parse JSON for stuck task {stuck_id}: {e}')
                            print(f'[ColorType-Worker] Falling back to text extraction')
                            color_type = extract_color_type(raw_result)
                            result_text_value = raw_result
                        
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
                    raw_result = ''.join(output) if all(isinstance(x, str) for x in output) else str(output)
                elif isinstance(output, str):
                    raw_result = output
                elif isinstance(output, dict):
                    raw_result = output.get('text', str(output))
                else:
                    raw_result = str(output)
                
                if raw_result:
                    print(f'[ColorType-Worker] Task {task_id} raw result: {raw_result[:200]}...')
                    
                    # Try to parse JSON from AI response
                    try:
                        # Extract JSON from markdown code blocks if present
                        json_str = raw_result
                        if '```json' in raw_result:
                            json_str = raw_result.split('```json')[1].split('```')[0].strip()
                        elif '```' in raw_result:
                            json_str = raw_result.split('```')[1].split('```')[0].strip()
                        
                        analysis = json.loads(json_str)
                        color_type, explanation = match_colortype(analysis)
                        result_text_value = explanation
                        
                        print(f'[ColorType-Worker] Task {task_id} matched to: {color_type}')
                        print(f'[ColorType-Worker] Explanation: {explanation}')
                        
                    except (json.JSONDecodeError, KeyError, TypeError) as e:
                        print(f'[ColorType-Worker] Failed to parse JSON for task {task_id}: {e}')
                        print(f'[ColorType-Worker] Falling back to text extraction')
                        color_type = extract_color_type(raw_result)
                        result_text_value = raw_result
                    
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