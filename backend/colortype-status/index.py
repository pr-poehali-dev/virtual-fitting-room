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
        'hair': ['dark honey', 'tawny', 'gentle auburn', 'honey', 'auburn', 'dark honey blond', 'dark golden blond'],
        'eyes': ['turquoise blue', 'jade', 'light brown', 'turquoise', 'hazel', 'gray-green'],
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
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'DUSTY SUMMER',

    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'FIERY AUTUMN',    
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',

    ('COOL-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'SOFT WINTER',    
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',

    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',



    



}

COLOR_SYNONYMS = {
    # Hair colors
    'black': ['jet black', 'dark', 'ebony', 'raven', 'coal black'],
    'dark brown': ['espresso', 'dark', 'deep brown', 'chocolate', 'dark cool brown', 'dark warm brown'],
    'medium brown': ['brown', 'medium', 'chestnut brown'],
    'light brown': ['light', 'caramel', 'light warm brown'],
    'auburn': ['red', 'copper', 'reddish', 'red-brown', 'mahogany'],
    'blond': ['blonde', 'light', 'fair'],
    'golden blond': ['golden', 'honey', 'warm blond', 'sunny'],
    'ash blond': ['ash', 'cool blond', 'platinum', 'silver'],
    'honey': ['golden', 'warm', 'honey blond'],
    
    # Skin tones
    'porcelain': ['pale', 'fair', 'very light', 'ivory', 'alabaster'],
    'ivory': ['light', 'pale', 'fair', 'cream'],
    'beige': ['light beige', 'medium beige', 'neutral'],
    'warm beige': ['peachy', 'golden beige', 'warm'],
    'cool beige': ['pink beige', 'rosy beige', 'cool'],
    'olive': ['green undertone', 'medium olive', 'light olive'],
    'deep': ['dark', 'rich', 'deep brown'],
    
    # Eye colors
    'blue': ['light blue', 'bright blue', 'azure', 'sky blue'],
    'green': ['jade', 'emerald', 'hazel-green'],
    'brown': ['dark brown', 'light brown', 'amber', 'chestnut'],
    'hazel': ['brown-green', 'golden brown', 'amber'],
    'gray': ['grey', 'gray-blue', 'gray-green', 'silver']
}

def calculate_color_match_score(description: str, keywords: list) -> float:
    '''Calculate how well a color description matches reference keywords (with synonym support)'''
    if not keywords:
        return 0.0
    
    description_lower = description.lower()
    matches = 0
    
    for keyword in keywords:
        keyword_lower = keyword.lower()
        
        # Direct match
        if keyword_lower in description_lower:
            matches += 1
            continue
        
        # Synonym match
        found_synonym = False
        for base_word, synonyms in COLOR_SYNONYMS.items():
            if base_word in keyword_lower:
                # Check if any synonym appears in description
                if any(syn in description_lower for syn in synonyms):
                    matches += 0.8  # Synonym match = 80% score
                    found_synonym = True
                    break
        
        if found_synonym:
            continue
        
        # Partial word match (e.g., "dark" in "dark brown")
        keyword_words = keyword_lower.split()
        if any(word in description_lower for word in keyword_words if len(word) > 3):
            matches += 0.5  # Partial match = 50% score
    
    return matches / len(keywords)

def get_all_colortype_params(colortype: str) -> list:
    '''Get ALL parameter combinations for a colortype from COLORTYPE_MAP
    
    Returns: List of dicts with all possible parameter combinations for this colortype
    (Updated: checks all combinations instead of first match)
    '''
    params_list = []
    for (undertone, lightness, saturation, contrast), ct in COLORTYPE_MAP.items():
        if ct == colortype:
            params_list.append({
                'undertone': undertone,
                'lightness': lightness,
                'saturation': saturation,
                'contrast': contrast
            })
    return params_list

def calculate_param_match_score(analysis_value: str, expected_value: str) -> float:
    '''Check if parameter matches expected value (1.0 if match, 0.0 if not)'''
    return 1.0 if analysis_value == expected_value else 0.0

def match_colortype(analysis: dict) -> tuple:
    '''Match analysis to best colortype using weighted 7-parameter scoring
    
    Scoring:
    - Undertone: 100%
    - Lightness: 33%
    - Saturation: 33%
    - Contrast: 34%
    - Hair color: 33%
    - Skin color: 33%
    - Eye color: 34%
    
    Total score = (param_score * 0.5) + (color_score * 0.5)
    
    Returns: (colortype, explanation)
    '''
    undertone = analysis.get('undertone', '')
    lightness = analysis.get('lightness', '')
    saturation = analysis.get('saturation', '')
    contrast = analysis.get('contrast', '')
    hair = analysis.get('hair_color', '')
    eyes = analysis.get('eye_color', '')
    skin = analysis.get('skin_color', '')
    
    print(f'[Match] Analyzing: {undertone}/{lightness}/{saturation}/{contrast}')
    print(f'[Match] Colors: hair="{hair}", skin="{skin}", eyes="{eyes}"')
    
    best_colortype = None
    best_total_score = 0.0
    best_param_score = 0.0
    best_color_score = 0.0
    
    # Check ALL 12 colortypes
    for colortype in COLORTYPE_REFERENCES.keys():
        # Get ALL parameter combinations for this colortype
        all_params = get_all_colortype_params(colortype)
        
        # Find BEST matching parameter combination for this colortype
        best_param_score = 0.0
        best_match_info = None
        
        if all_params:
            for expected_params in all_params:
                # Calculate parameter match score (undertone 50%, lightness 16.5%, saturation 16.5%, contrast 17%)
                # Normalized so total = 1.0 when all match
                undertone_match = calculate_param_match_score(undertone, expected_params['undertone'])
                lightness_match = calculate_param_match_score(lightness, expected_params['lightness'])
                saturation_match = calculate_param_match_score(saturation, expected_params['saturation'])
                contrast_match = calculate_param_match_score(contrast, expected_params['contrast'])
                
                param_score_candidate = (undertone_match * 0.50) + (lightness_match * 0.165) + (saturation_match * 0.165) + (contrast_match * 0.17)
                
                if param_score_candidate > best_param_score:
                    best_param_score = param_score_candidate
                    best_match_info = {
                        'U': undertone_match,
                        'L': lightness_match,
                        'S': saturation_match,
                        'C': contrast_match
                    }
        
        param_score = best_param_score
        undertone_match = best_match_info['U'] if best_match_info else 0
        lightness_match = best_match_info['L'] if best_match_info else 0
        saturation_match = best_match_info['S'] if best_match_info else 0
        contrast_match = best_match_info['C'] if best_match_info else 0
        
        # Calculate color match score (hair 33%, skin 33%, eyes 34%)
        ref = COLORTYPE_REFERENCES[colortype]
        hair_score = calculate_color_match_score(hair, ref['hair'])
        skin_score = calculate_color_match_score(skin, ref['skin'])
        eyes_score = calculate_color_match_score(eyes, ref['eyes'])
        
        color_score = (hair_score * 0.33) + (skin_score * 0.33) + (eyes_score * 0.34)
        
        # Total score: 50% parameters + 50% colors
        total_score = (param_score * 0.5) + (color_score * 0.5)
        
        print(f'[Match] {colortype}: param={param_score:.2f} (U:{undertone_match:.0f} L:{lightness_match:.0f} S:{saturation_match:.0f} C:{contrast_match:.0f}), color={color_score:.2f} (h:{hair_score:.2f} s:{skin_score:.2f} e:{eyes_score:.2f}), total={total_score:.2f}')
        
        if total_score > best_total_score:
            best_total_score = total_score
            best_colortype = colortype
            best_param_score = param_score
            best_color_score = color_score
    
    explanation = f"Best match: {best_colortype} (total: {best_total_score:.2f}, params: {best_param_score:.2f}, colors: {best_color_score:.2f}). Analysis: {undertone}/{lightness}/{saturation}/{contrast}. Hair: {hair}, Skin: {skin}, Eyes: {eyes}."
    
    print(f'[Match] FINAL: {best_colortype} with score {best_total_score:.2f}')
    
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
                            
                            # Fix escaped underscores from LLaVA
                            # Handle both \_ and \\\_
                            json_str = json_str.replace('\\\\_', '_')  # Double-escaped
                            json_str = json_str.replace('\\_', '_')      # Single-escaped
                            
                            print(f'[ColorType-Status] Cleaned JSON: {json_str[:300]}...')
                            
                            analysis = json.loads(json_str)
                            print(f'[ColorType-Status] Parsed analysis: {analysis}')
                            
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