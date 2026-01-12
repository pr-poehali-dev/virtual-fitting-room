import json
import os
import psycopg2
import requests
from typing import Dict, Any
from datetime import datetime

def check_replicate_status(prediction_id: str) -> dict:
    '''Check status directly on Replicate API'''
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
    
    raise Exception(f'Failed to check status: {response.status_code}')

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

# Mapping table
COLORTYPE_MAP = {
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'HIGH-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MUTED-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-COLORS', 'MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-COLORS', 'HIGH-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'BRIGHT-COLORS', 'LOW-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'BRIGHT-COLORS', 'MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'BRIGHT-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'LOW-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'HIGH-CONTRAST'): 'FIERY AUTUMN',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MEDIUM-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'HIGH-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'MUTED-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'MUTED-COLORS', 'MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MUTED-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-COLORS', 'LOW-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-COLORS', 'MEDIUM-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
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
    intensity = analysis.get('intensity', '')
    contrast = analysis.get('contrast', '')
    hair = analysis.get('hair_color', '')
    eyes = analysis.get('eye_color', '')
    skin = analysis.get('skin_color', '')
    
    base_colortype = COLORTYPE_MAP.get((undertone, intensity, contrast))
    
    if not base_colortype:
        return None, f"No mapping found for {undertone} + {intensity} + {contrast}"
    
    ref = COLORTYPE_REFERENCES[base_colortype]
    hair_score = calculate_color_match_score(hair, ref['hair'])
    skin_score = calculate_color_match_score(skin, ref['skin'])
    eyes_score = calculate_color_match_score(eyes, ref['eyes'])
    
    base_score = (hair_score * 0.4) + (skin_score * 0.4) + (eyes_score * 0.2)
    
    print(f'[Match] Base type: {base_colortype}, scores: hair={hair_score:.2f}, skin={skin_score:.2f}, eyes={eyes_score:.2f}, total={base_score:.2f}')
    
    if base_score >= 0.4:
        explanation = f"Based on {undertone}, {intensity}, {contrast}. Hair: {hair}, Skin: {skin}, Eyes: {eyes}. Matches {base_colortype} characteristics."
        return base_colortype, explanation
    
    season_group = base_colortype.split()[-1]
    same_season_types = [ct for ct in COLORTYPE_REFERENCES.keys() if season_group in ct]
    
    best_colortype = base_colortype
    best_score = base_score
    
    for colortype in same_season_types:
        ref = COLORTYPE_REFERENCES[colortype]
        h_score = calculate_color_match_score(hair, ref['hair'])
        s_score = calculate_color_match_score(skin, ref['skin'])
        e_score = calculate_color_match_score(eyes, ref['eyes'])
        total_score = (h_score * 0.4) + (s_score * 0.4) + (e_score * 0.2)
        
        print(f'[Match] Checking {colortype}: hair={h_score:.2f}, skin={s_score:.2f}, eyes={e_score:.2f}, total={total_score:.2f}')
        
        if total_score > best_score:
            best_score = total_score
            best_colortype = colortype
    
    explanation = f"Based on {undertone}, {intensity}, {contrast}. Hair: {hair}, Skin: {skin}, Eyes: {eyes}. Best match: {best_colortype} (score: {best_score:.2f})."
    return best_colortype, explanation

def extract_color_type(result_text: str) -> str:
    '''Extract color type name from result text (fallback for old format)'''
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
    Проверка статуса анализа цветотипа с опциональной принудительной проверкой
    Args: event - dict с httpMethod, queryStringParameters (task_id, force_check)
          context - object с атрибутом request_id
    Returns: HTTP response со статусом задачи и результатом если готово
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
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    params = event.get('queryStringParameters', {}) or {}
    print(f'[ColorType-Status] Query params: {params}')
    task_id = params.get('task_id')
    force_check = params.get('force_check') == 'true'
    print(f'[ColorType-Status] task_id={task_id}, force_check={force_check}')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id is required'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT status, result_text, color_type, replicate_prediction_id
            FROM color_type_history
            WHERE id = %s
        ''', (task_id,))
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        status, result_text, color_type, replicate_prediction_id = row
        
        # Direct API check (no worker trigger, like nanobananapro-async-status)
        if force_check and status == 'processing' and replicate_prediction_id:
            print(f'[ColorType-Status] Force checking task {task_id} on Replicate')
            try:
                replicate_data = check_replicate_status(replicate_prediction_id)
                replicate_status = replicate_data.get('status', 'unknown')
                
                print(f'[ColorType-Status] Replicate status: {replicate_status}')
                
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
                        print(f'[ColorType-Status] Raw result: {result_text_value[:200]}...')
                        
                        # Try to parse JSON from AI response
                        extracted_color_type = None
                        explanation = result_text_value
                        
                        try:
                            json_str = result_text_value
                            if '```json' in result_text_value:
                                json_str = result_text_value.split('```json')[1].split('```')[0].strip()
                            elif '```' in result_text_value:
                                json_str = result_text_value.split('```')[1].split('```')[0].strip()
                            
                            analysis = json.loads(json_str)
                            extracted_color_type, explanation = match_colortype(analysis)
                            
                            print(f'[ColorType-Status] Matched to: {extracted_color_type}')
                            print(f'[ColorType-Status] Explanation: {explanation}')
                            
                        except (json.JSONDecodeError, KeyError, TypeError) as e:
                            print(f'[ColorType-Status] Failed to parse JSON: {e}')
                            print(f'[ColorType-Status] Falling back to text extraction')
                            extracted_color_type = extract_color_type(result_text_value)
                            explanation = result_text_value
                        
                        print(f'[ColorType-Status] Task completed! Color type: {extracted_color_type}')
                        print(f'[ColorType-Status] Result preview: {explanation[:100]}...')
                        
                        cursor.execute('''
                            UPDATE color_type_history
                            SET status = 'completed', result_text = %s, color_type = %s, updated_at = %s
                            WHERE id = %s
                        ''', (explanation, extracted_color_type, datetime.utcnow(), task_id))
                        conn.commit()
                        
                        status = 'completed'
                        result_text = explanation
                        color_type = extracted_color_type
                        print(f'[ColorType-Status] DB updated successfully')
                    
                elif replicate_status == 'failed':
                    error_msg = replicate_data.get('error', 'Analysis failed')
                    print(f'[ColorType-Status] Task failed: {error_msg}')
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'failed', result_text = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    status = 'failed'
                    result_text = error_msg
                
            except Exception as e:
                print(f'[ColorType-Status] Force check error: {str(e)}')
        
        cursor.close()
        conn.close()
        
        response_data = {
            'task_id': task_id,
            'status': status,
            'result_text': result_text,
            'color_type': color_type
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        print(f'[ColorType-Status] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }