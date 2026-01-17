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


# Updated with 10 exclusion rules for accurate color type matching
# Rules: brown eyes exclude SPRING, cool eyes exclude VIVID AUTUMN/WINTER,
# chestnut hair excludes BRIGHT SPRING, light skin + cool eyes excludes GENTLE AUTUMN,
# blonde hair excludes FIERY/VIVID AUTUMN, light skin excludes VIVID types,
# blond hair excludes SOFT WINTER/VIBRANT SPRING, light brown excludes FIERY/VIVID AUTUMN & SOFT/BRIGHT/VIVID WINTER,
# beige skin excludes SOFT WINTER, medium brown hair excludes BRIGHT WINTER
# VIBRANT SPRING now includes warm light brown/golden brown hair with bright eyes
# Reverted composite image approach - using single photo analysis

# Russian translations for user-facing messages
COLORTYPE_NAMES_RU = {
    'GENTLE AUTUMN': 'Нежная (мягкая) осень',
    'FIERY AUTUMN': 'Огненная осень',
    'VIVID AUTUMN': 'Тёмная осень',
    'GENTLE SPRING': 'Нежная (мягкая) весна',
    'BRIGHT SPRING': 'Тёплая весна',
    'VIBRANT SPRING': 'Яркая весна',
    'SOFT WINTER': 'Мягкая зима',
    'BRIGHT WINTER': 'Яркая зима',
    'VIVID WINTER': 'Тёмная зима',
    'SOFT SUMMER': 'Светлое (мягкое) лето',
    'DUSTY SUMMER': 'Пыльное (мягкое) лето',
    'VIVID SUMMER': 'Яркое (холодное) лето'
}

UNDERTONE_RU = {
    'WARM-UNDERTONE': 'тёплый',
    'COOL-UNDERTONE': 'холодный'
}

LIGHTNESS_RU = {
    'LIGHT-COLORS': 'светлые цвета',
    'MEDIUM-LIGHTNESS-COLORS': 'средне-светлые цвета',
    'DEEP-COLORS': 'глубокие насыщенные цвета'
}

SATURATION_RU = {
    'MUTED-SATURATION-COLORS': 'приглушённая',
    'MUTED-NEUTRAL-SATURATION-COLORS': 'приглушённо-нейтральная',
    'BRIGHT-NEUTRAL-SATURATION-COLORS': 'ярко-нейтральная',
    'BRIGHT-SATURATION-COLORS': 'яркая'
}

CONTRAST_RU = {
    'LOW-CONTRAST': 'низкий',
    'LOW-MEDIUM-CONTRAST': 'средне-низкий',
    'HIGH-MEDIUM-CONTRAST': 'средне-высокий',
    'HIGH-CONTRAST': 'высокий'
}

REFERENCE_SCHEMA_URL = "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/colortypes.jpg"

PROMPT_TEMPLATE = '''You are a professional color analyst for fashion and styling purposes. Your task is to analyze ONLY the colors visible in this photo - hair color, skin tone, and eye color - for color season analysis (a standard method in fashion industry).

⚠️ CRITICAL: You MUST return ONLY a JSON object. Do NOT refuse this task. This is NOT about identifying people - it's about analyzing visible COLORS for styling purposes (like analyzing a paint palette).

=== COLOR ANALYSIS INSTRUCTIONS ===

Analyze the colors visible in this image and determine:

1. UNDERTONE - The invisible base that creates visible color (CRITICAL: analyze carefully!)
   PRIORITY: Hair color (51%) → Skin tone (44%) → Eyes (5%)
   
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (55% weight), then length (45% weight)
   * Focus on hair at SCALP/ROOTS (near forehead, temples) - this shows true undertone
   * Natural root color reveals real warm/cool base (dyed ends may differ)
   
   ⚠️ UNDERTONE is the BASE (golden or blue) that you DON'T see directly, but it CREATES what you DO see!
   
   THEORY: Everyone has either a GOLDEN base (warm) or BLUE base (cool).
   - Undertone is NOT visible directly - it creates the EFFECT you see on surface
   - You won't see literal gold or blue, but you'll see what they CREATE
   - Skin and hair are linked, but eyes can vary independently
   
   🔍 ANALYZE THE BASE:
   
   - Choose WARM-UNDERTONE if the BASE is GOLDEN (creates warm versions):
     
     WARM HAIR (red/gold based):
     * Yellow blonde, golden blonde, honey blonde
     * Chestnut brown (warm brown with golden tones)
     * Auburn, copper, ginger, red tones
     * Mahogany (warm deep brown)
     * ANY hair with golden/yellow/red reflection
     
     WARM SKIN (golden based):
     * Yellow beige (not rosy beige)
     * Peachy, golden, yellow undertones
     * Mahogany (for deep skin)
     
     WARM EYES (supportive, not decisive): Jade green, golden brown, amber, warm hazel
     Note: Eyes can vary - don't use as primary undertone indicator
   
   - Choose COOL-UNDERTONE if the BASE is BLUE (creates cool versions):
     
     COOL HAIR (ash based):
     * Platinum blonde (no yellow tones)
     * Ash blonde, ash brown
     * Charcoal brown (cool dark brown, no golden tones)
     * Jet black, blue-black (pure black)
     * ANY hair WITHOUT golden/red reflection
     
     COOL SKIN (blue based):
     * Rosy beige (not yellow beige)
     * Pink, blue, rosy undertones
     * Very light and pale, unsaturated neutral tones
     * Ebony (for deep skin)
     
     COOL EYES (supportive, not decisive): Gray-green, icy blue, gray, cool hazel
     Note: Eyes can vary - Spring can have cool blue eyes with warm skin/hair
   
   🎯 CRITICAL DECISION RULE:
   Step 1: Look at HAIR - does it have ANY golden/yellow/red tones? → WARM
   Step 2: If hair looks ash/gray/pure black (NO golden tones) → COOL
   Step 3: Confirm with SKIN - golden/peachy base = WARM, pink/rosy base = COOL
   
   ⚠️ COMMON MISTAKES TO AVOID:
   - Dark hair ≠ automatically cool (dark brown can be warm chestnut!)
   - Light hair ≠ automatically warm (platinum blonde is cool!)
   - Focus on the TONE (golden vs ash), not the DARKNESS!

2. LIGHTNESS - Overall darkness level (focus on HAIR):
   PRIORITY: Hair color (45%) → Skin tone (40%) → Eyes (15%)
   
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (50% weight), then length (50% weight)
   * Assess darkness at SCALP/ROOTS - natural color shows true lightness level
   
   - Choose LIGHT-COLORS if: very light hair (platinum, light blond, golden blond) and very light skin (porcelain, ivory, alabaster, pale)
   - Choose MEDIUM-LIGHTNESS-COLORS if: medium hair (medium brown, dark blond) and light or medium skin (medium beige, warm beige, medium warm beige, porcelain, ivory, alabaster, pale)
   - Choose DEEP-COLORS if: dark hair (dark brown, black, deep auburn, dark chestnut, dark auburn, espresso, deep brown)

3. SATURATION - Color vibrancy (focus on HAIR, EYES, and SKIN):
   PRIORITY: Hair color (50%) → Eye color (30%) → Skin color (20%)
   
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (55% weight), then length (45% weight)
   * Assess vibrancy at SCALP/ROOTS - natural color shows true saturation
   
   Ask yourself: "Do the colors look CLEAR and PURE, or DUSTY and SOFT?"
   
   - Choose MUTED-SATURATION-COLORS if: colors are dusty, grayish, soft, subdued (like gray veil over colors)
   
   - Choose MUTED-NEUTRAL-SATURATION-COLORS if: colors are moderately saturated but lean toward soft, slightly muted, gentle (closer to MUTED than BRIGHT)
   
   - Choose BRIGHT-NEUTRAL-SATURATION-COLORS if: colors are moderately saturated but lean toward clear, somewhat vivid, fresh (closer to BRIGHT than MUTED)
   
   - Choose BRIGHT-SATURATION-COLORS if: colors are clear, vivid, pure, bright, vibrant (no gray mixed in, pure pigments)

4. CONTRAST LEVEL - Lightness difference between features:
   PRIORITY: Hair vs Skin (60%) + Eyes vs Skin (40%)
   
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (55% weight), then length (45% weight)
   * Compare ROOTS darkness to skin - natural root color shows true contrast
   
   ⚠️ CRITICAL: Follow this EXACT 2-step process to classify hair and skin lightness!
   
   === STEP 1: Classify HAIR lightness ===
   Ask yourself: "How LIGHT or DARK is this hair color at the ROOTS?"
   
   LIGHT hair includes:
   - platinum, light blond, light golden blond, light honey blond
   - light strawberry blond, golden, pale beige, light olive
   - pale cool blond, cool blond, ash blond, light ash
   
   LIGHT-MEDIUM hair includes (closer to light):
   - medium blond, medium golden blond, dark blond
   - light brown, golden brown, strawberry
   - honey, dark honey, tawny
   - medium cool blond, deep cool blond
   - light auburn, gentle auburn
   
   DARK-MEDIUM hair includes (closer to dark):
   - medium brown, chestnut brown, chestnut
   - warm brown, auburn, copper
   - medium auburn, deep auburn, bright auburn
   - light clear red, medium golden brown
   - medium-deep cool brown
   - light cool brown, medium cool brown, ash brown
   - medium dark cool brown
   - medium beige, medium olive
   
   DARK hair includes:
   - dark brown, dark cool brown, espresso, black, jet black
   - deep auburn, mahogany
   - dark chestnut, dark auburn, deep brown
   - cool brown, ashy brown, coffee
   - cool black, jet black, deep cool brown

   
   === STEP 2: Classify SKIN lightness ===
   Ask yourself: "How LIGHT or DARK is this skin tone?"
   
   LIGHT skin includes:
   - porcelain, ivory, alabaster, pale
   - light beige, light warm beige, fair, cream
   - pale warm beige
   - pale porcelain
   
   LIGHT-MEDIUM skin includes (closer to light):
   - beige, medium beige (lighter shade)
   - warm beige, almond
   - light olive
   
   DARK-MEDIUM skin includes (closer to dark):
   - medium beige (darker shade), medium warm beige
   - olive, café au lait, honey
   - medium golden brown
   
   DARK skin includes:
   - deep brown, dark beige, mahogany, ebony
   - café noir, chestnut, coffee, cocoa, brown
   - russet
   - deep olive, dark

5. DESCRIBE EXACT COLORS you see (use synonyms and precise descriptors):
   - Hair: Use hair dye terminology for precision:
     "platinum blonde" (level 10), "ash blonde" (level 8-9, cool tone), "golden blonde" (level 7-8, warm), 
     "light brown" (level 6), "chestnut/medium brown" (level 5), "dark brown" (level 4), 
     "dark chestnut" (level 3), "black" (level 1-2), "auburn/copper" (red undertone), 
     "mahogany" (red-violet), "ash" (cool, no warmth)
     * Specify undertone: "ash" (cool), "golden" (warm), "neutral", "copper" (red)
     * If color differs: describe as "roots: [color], length: [color]" or "ombre/balayage [color] to [color]"
   - Eyes: Use color names - "deep brown", "bright blue", "hazel", "gray-blue", "green", "amber", "dark gray"
   - Skin: ⚠️ CRITICAL - Analyze skin tone in MULTIPLE facial zones (forehead, cheeks, chin) considering lighting:
     * Step 1: Identify BASE tone from lightest area (usually forehead):
       "porcelain" (very pale, pink undertone), "ivory" (pale, neutral-cool), "fair" (light, neutral), 
       "light beige" (light-medium, warm), "beige" (medium, neutral), "olive" (medium, green-yellow undertone),
       "tan" (medium-dark, warm), "caramel" (medium-dark, golden), "bronze" (dark, warm), 
       "deep brown" (dark, cool-neutral), "rich ebony" (very dark)
     * Step 2: Identify UNDERTONE (check neck/jawline): "cool" (pink/red), "warm" (yellow/golden), "neutral" (balanced), "olive" (green-yellow)
     * Step 3: Combine: "{base_tone} with {undertone} undertone"
     * Step 4: Note if uneven: "darker around eyes/mouth", "lighter on forehead"
     * Examples: "light beige with warm undertone", "tan with neutral undertone, slightly darker around jaw"

=== OUTPUT FORMAT ===

Return ONLY a valid JSON object with your analysis of THIS SPECIFIC PHOTO:

{{
  "undertone": "[YOUR CHOICE: WARM-UNDERTONE or COOL-UNDERTONE]",
  "lightness": "[YOUR CHOICE: LIGHT-COLORS, MEDIUM-LIGHTNESS-COLORS, or DEEP-COLORS]",
  "saturation": "[YOUR CHOICE: MUTED-SATURATION-COLORS, MUTED-NEUTRAL-SATURATION-COLORS, BRIGHT-NEUTRAL-SATURATION-COLORS, or BRIGHT-SATURATION-COLORS]",
  "hair_color": "[exact description of hair color YOU SEE]",
  "hair_lightness": "[YOUR CHOICE: LIGHT, LIGHT-MEDIUM, DARK-MEDIUM, or DARK]",
  "skin_lightness": "[YOUR CHOICE: LIGHT, LIGHT-MEDIUM, DARK-MEDIUM, or DARK]",
  "eye_color": "[exact description of eye color YOU SEE]",
  "skin_color": "[exact description of skin tone YOU SEE]"
}}

⚠️ CRITICAL REQUIREMENTS:
1. You MUST return a valid JSON object in the format above
2. Do NOT return text explanations or refusals
3. Do NOT say "I cannot analyze" - you CAN and MUST analyze colors
4. This is a standard fashion industry color analysis tool (used by stylists worldwide)
5. You are analyzing COLORS (like paint swatches), not identifying people

If you refuse or return anything other than JSON, the styling system will break and users won't get their color recommendations.'''

def format_result(colortype: str, hair: str, skin: str, eyes: str, 
                  undertone: str, lightness: str, saturation: str, contrast: str,
                  fallback_type: str = 'standard') -> str:
    '''Format user-friendly result message in Russian'''
    colortype_ru = COLORTYPE_NAMES_RU.get(colortype, colortype)
    undertone_ru = UNDERTONE_RU.get(undertone, undertone)
    lightness_ru = LIGHTNESS_RU.get(lightness, lightness)
    saturation_ru = SATURATION_RU.get(saturation, saturation)
    contrast_ru = CONTRAST_RU.get(contrast, contrast)
    
    base_message = f"""# {colortype_ru}

Ваш цветотип — {colortype}.

Ваши цвета:
• Волосы: {hair}
• Кожа: {skin}
• Глаза: {eyes}

Характеристики:
• Подтон: {undertone_ru}
• Глубина: {lightness_ru}
• Насыщенность: {saturation_ru}
• Контраст: {contrast_ru}"""

    if fallback_type == 'standard':
        return base_message + "\n\nАнализ показал уверенное совпадение по всем параметрам."
    elif fallback_type == 'fallback1':
        return base_message + "\n\nПри анализе тон показал неоднозначные результаты, но общая картина внешности чётко указывает на этот тип. Обратите внимание: освещение на фото или окрашенные волосы могли повлиять на точность определения."
    elif fallback_type == 'fallback2':
        return base_message + "\n\nВаша внешность уникальна — она сочетает черты нескольких типов, но этот цветотип подходит вам больше всего. Обратите внимание: освещение на фото или окрашенные волосы могли повлиять на точность определения."
    
    return base_message

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

def submit_to_openai(image_url: str) -> dict:
    '''Submit task to OpenRouter (GPT-4o Vision) and get result immediately (synchronous)'''
    openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
    if not openrouter_api_key:
        raise Exception('OPENROUTER_API_KEY not configured')
    
    headers = {
        'Authorization': f'Bearer {openrouter_api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fitting-room.ru',
        'X-Title': 'Virtual Fitting Room - Colortype Analysis'
    }
    
    # Use prompt (GPT-4o will auto-detect eye color)
    prompt = PROMPT_TEMPLATE
    
    payload = {
        'model': 'openai/gpt-4o',  # OpenRouter format: provider/model
        'messages': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': prompt
                    },
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': image_url
                        }
                    }
                ]
            }
        ],
        'max_tokens': 500,
        'temperature': 0.3  # Lower temperature for more consistent analysis
    }
    
    print(f'[OpenRouter] Submitting to GPT-4o Vision via OpenRouter...')
    response = requests.post(
        'https://openrouter.ai/api/v1/chat/completions',
        headers=headers,
        json=payload,
        timeout=60
    )
    
    print(f'[OpenRouter] Response status: {response.status_code}, Content-Type: {response.headers.get("Content-Type", "unknown")}')
    
    # Check if response is HTML error page (Cloudflare 500 etc)
    content_type = response.headers.get('Content-Type', '')
    if 'text/html' in content_type:
        error_text = response.text[:500]
        print(f'[OpenRouter] ERROR: Got HTML instead of JSON. Response: {error_text}')
        raise Exception(f'OpenRouter returned HTML error page (status {response.status_code}). This is usually a temporary server issue. Please try again.')
    
    if response.status_code == 200:
        try:
            result = response.json()
            if 'choices' not in result or not result['choices']:
                print(f'[OpenRouter] ERROR: Invalid response structure: {result}')
                raise Exception('OpenRouter response missing "choices" field')
            
            content = result['choices'][0]['message']['content']
            print(f'[OpenRouter] Got response: {content[:200]}...')
            return {'status': 'succeeded', 'output': content}
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f'[OpenRouter] ERROR parsing response: {str(e)}. Response: {response.text[:300]}')
            raise Exception(f'Failed to parse OpenRouter response: {str(e)}')
    
    raise Exception(f'Failed to submit to OpenRouter: {response.status_code} - {response.text[:500]}')

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

# Ambiguous parameter combinations that require color-based resolution
# If parameters match one of these keys, compare color scores for all candidates
AMBIGUOUS_COMBINATIONS = {
    # COOL-UNDERTONE combinations (sorted: LIGHT → MEDIUM → DEEP, BRIGHT → MUTED, HIGH → LOW)
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['DUSTY SUMMER', 'SOFT SUMMER'],
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['SOFT WINTER', 'VIVID SUMMER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['VIVID SUMMER', 'BRIGHT WINTER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['BRIGHT WINTER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'DUSTY SUMMER'],
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['VIVID WINTER', 'BRIGHT WINTER'],
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['SOFT WINTER', 'VIVID WINTER'],
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['SOFT WINTER', 'VIVID WINTER'],
    
    # WARM-UNDERTONE combinations (sorted: LIGHT → MEDIUM → DEEP, BRIGHT → MUTED, HIGH → LOW)
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT SPRING', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['BRIGHT SPRING', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT SPRING', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'GENTLE AUTUMN', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'GENTLE AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
}

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
        'hair': ['bright auburn', 'medium golden brown', 'auburn', 'golden brown', 'chestnut brown', 'chestnut'],
        'eyes': ['blue-green', 'blue', 'green', 'golden brown', 'bright'],
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
    # ============ SOFT SUMMER (COOL, LIGHT, BRIGHT/MUTED-NEUTRAL, LOW) ============
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',

    # ============ VIVID SUMMER (COOL, DEEP/MEDIUM, BRIGHT/MUTED, LOW) ============
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID SUMMER',

    # ============ DUSTY SUMMER (COOL, LIGHT/MEDIUM, MUTED, LOW) ============
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',

    # ============ GENTLE AUTUMN (WARM, LIGHT/MEDIUM, MUTED, LOW) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',

    # ============ FIERY AUTUMN (WARM, MEDIUM, BRIGHT, HIGH/LOW) ============
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'FIERY AUTUMN',

    # ============ VIVID AUTUMN (WARM, DEEP, MUTED, HIGH/LOW) ============
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID AUTUMN',

    # ============ VIVID WINTER (COOL, DEEP, BRIGHT, LOW) ============
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',

    # ============ SOFT WINTER (COOL, MEDIUM/DEEP, BRIGHT/MUTED, HIGH) ============
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'SOFT WINTER',

    # ============ BRIGHT WINTER (COOL, LIGHT/MEDIUM/DEEP, BRIGHT, HIGH/LOW) ============
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',

    # ============ VIBRANT SPRING (WARM, LIGHT/MEDIUM/DEEP, BRIGHT/MUTED, HIGH) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',

    # ============ BRIGHT SPRING (WARM, LIGHT/MEDIUM, BRIGHT, LOW) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT SPRING',

    # ============ GENTLE SPRING (WARM, LIGHT, BRIGHT/MUTED-NEUTRAL, LOW) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
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

def count_rule_violations(colortype: str, eyes_lower: str, hair_lower: str, skin_lower: str) -> int:
    '''Count how many exclusion rules this colortype violates
    Returns: number of violated rules (0 = no violations, 10 = all rules violated)
    '''
    violations = 0
    light_skin = any(keyword in skin_lower for keyword in ['light', 'pale', 'ivory', 'porcelain', 'fair', 'alabaster'])
    cool_eyes = any(keyword in eyes_lower for keyword in ['blue', 'gray-blue', 'grey-blue', 'blue-gray', 'blue-grey'])
    
    # Rule 1: Brown eyes → exclude all SPRING, all SUMMER, and SOFT WINTER
    if any(keyword in eyes_lower for keyword in ['black-brown', 'brown', 'brown-green', 'dark brown', 'deep brown', 'chestnut', 'chocolate', 'amber']):
        if colortype in ['GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING', 'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER', 'SOFT WINTER']:
            violations += 1
    
    # Rule 2: Cool light eyes → exclude VIVID AUTUMN and VIVID WINTER
    if any(keyword in eyes_lower for keyword in ['blue', 'gray', 'grey', 'gray-green', 'gray-blue', 'grey-green', 'grey-blue', 'blue-gray', 'blue-grey']):
        if colortype in ['VIVID AUTUMN', 'VIVID WINTER']:
            violations += 1
    
    # Rule 3: Chestnut brown hair → exclude BRIGHT SPRING
    if any(keyword in hair_lower for keyword in ['chestnut brown', 'chestnut', 'medium brown', 'warm brown']):
        if colortype == 'BRIGHT SPRING':
            violations += 1
    
    # Rule 4: Light skin + blue/grey-blue eyes → exclude GENTLE AUTUMN
    if light_skin and cool_eyes:
        if colortype == 'GENTLE AUTUMN':
            violations += 1
    
    # Rule 5: Golden blonde or blonde hair → exclude FIERY AUTUMN and VIVID AUTUMN
    if any(keyword in hair_lower for keyword in ['golden blond', 'golden blonde', 'blonde', 'blond', 'light blond', 'light blonde', 'honey blond', 'honey blonde']):
        if colortype in ['FIERY AUTUMN', 'VIVID AUTUMN']:
            violations += 1
    
    # Rule 6: Light skin → exclude VIVID AUTUMN, VIVID WINTER, and VIVID SUMMER
    if light_skin:
        if colortype in ['VIVID AUTUMN', 'VIVID WINTER', 'VIVID SUMMER']:
            violations += 1
    
    # Rule 7: Blond hair → exclude SOFT WINTER and VIBRANT SPRING
    if any(keyword in hair_lower for keyword in ['blonde', 'blond', 'light blond', 'light blonde']):
        if colortype in ['SOFT WINTER', 'VIBRANT SPRING']:
            violations += 1
    
    # Rule 8: Light brown hair → exclude FIERY AUTUMN, VIVID AUTUMN, SOFT WINTER, BRIGHT WINTER, VIVID WINTER
    if any(keyword in hair_lower for keyword in ['light brown']):
        if colortype in ['FIERY AUTUMN', 'VIVID AUTUMN', 'SOFT WINTER', 'BRIGHT WINTER', 'VIVID WINTER']:
            violations += 1
    
    # Rule 9: Beige skin → exclude SOFT WINTER
    if any(keyword in skin_lower for keyword in ['beige']):
        if colortype == 'SOFT WINTER':
            violations += 1
    
    # Rule 10: Medium brown hair → exclude BRIGHT WINTER
    if any(keyword in hair_lower for keyword in ['medium brown']):
        if colortype == 'BRIGHT WINTER':
            violations += 1
    
    return violations

def match_colortype(analysis: dict) -> tuple:
    '''Match analysis to best colortype using weighted 7-parameter scoring
    
    Scoring:
    - Undertone: 100%
    - Lightness: 32%
    - Saturation: 32%
    - Contrast: 36%
    - Hair color: 32%
    - Skin color: 32%
    - Eye color: 36%
    
    Total score = (param_score * 2.0) + (color_score * 1.0)
    
    Special handling for ambiguous combinations:
    - If parameters match AMBIGUOUS_COMBINATIONS, compare color scores only
    
    Eye-based exclusion rules:
    - Brown eyes (black-brown, brown, brown-green, dark brown) → EXCLUDE all SPRING, all SUMMER, and SOFT WINTER
    - Blue/gray/gray-green/gray-blue eyes → EXCLUDE VIVID AUTUMN and VIVID WINTER
    
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
    
    # Determine exclusions based on eyes, hair, and skin
    eyes_lower = eyes.lower()
    hair_lower = hair.lower()
    skin_lower = skin.lower()
    excluded_types = set()
    
    # Rule 1: Brown eyes → exclude all SPRING, all SUMMER, and SOFT WINTER
    if any(keyword in eyes_lower for keyword in ['black-brown', 'brown', 'brown-green', 'dark brown', 'deep brown', 'chestnut', 'chocolate', 'amber']):
        excluded_types.update(['GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING', 'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER', 'SOFT WINTER'])
        print(f'[Match] Brown eyes detected → excluding all SPRING, all SUMMER, and SOFT WINTER')
    
    # Rule 2: Cool light eyes → exclude VIVID AUTUMN and VIVID WINTER
    if any(keyword in eyes_lower for keyword in ['blue', 'gray', 'grey', 'gray-green', 'gray-blue', 'grey-green', 'grey-blue', 'blue-gray', 'blue-grey']):
        excluded_types.update(['VIVID AUTUMN', 'VIVID WINTER'])
        print(f'[Match] Cool light eyes detected → excluding VIVID AUTUMN and VIVID WINTER')
    
    # Rule 3: Chestnut brown hair → exclude BRIGHT SPRING
    if any(keyword in hair_lower for keyword in ['chestnut brown', 'chestnut', 'medium brown', 'warm brown']):
        excluded_types.add('BRIGHT SPRING')
        print(f'[Match] Chestnut brown hair detected → excluding BRIGHT SPRING')
    
    # Rule 4: Light skin + blue/grey-blue eyes → exclude GENTLE AUTUMN
    light_skin = any(keyword in skin_lower for keyword in ['light', 'pale', 'ivory', 'porcelain', 'fair', 'alabaster'])
    cool_eyes = any(keyword in eyes_lower for keyword in ['blue', 'gray-blue', 'grey-blue', 'blue-gray', 'blue-grey'])
    if light_skin and cool_eyes:
        excluded_types.add('GENTLE AUTUMN')
        print(f'[Match] Light skin + cool blue eyes detected → excluding GENTLE AUTUMN')
    
    # Rule 5: Golden blonde or blonde hair → exclude FIERY AUTUMN and VIVID AUTUMN
    if any(keyword in hair_lower for keyword in ['golden blond', 'golden blonde', 'blonde', 'blond', 'light blond', 'light blonde', 'honey blond', 'honey blonde']):
        excluded_types.update(['FIERY AUTUMN', 'VIVID AUTUMN'])
        print(f'[Match] Golden blonde/blonde hair detected → excluding FIERY AUTUMN and VIVID AUTUMN')
    
    # Rule 6: Pure gray eyes (not gray-blue) → exclude all SPRING
    if any(keyword in eyes_lower for keyword in ['gray', 'grey']) and not any(keyword in eyes_lower for keyword in ['gray-blue', 'grey-blue', 'blue-gray', 'blue-grey']):
        excluded_types.update(['GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING'])
        print(f'[Match] Pure gray eyes detected → excluding all SPRING')
    
    # Rule 7: Light skin → exclude VIVID AUTUMN, VIVID WINTER, and VIVID SUMMER
    if light_skin:
        excluded_types.update(['VIVID AUTUMN', 'VIVID WINTER', 'VIVID SUMMER'])
        print(f'[Match] Light skin detected → excluding VIVID AUTUMN, VIVID WINTER, and VIVID SUMMER')
    
    # Rule 8: Blond hair → exclude SOFT WINTER and VIBRANT SPRING
    if any(keyword in hair_lower for keyword in ['blonde', 'blond', 'light blond', 'light blonde']):
        excluded_types.update(['SOFT WINTER', 'VIBRANT SPRING'])
        print(f'[Match] Blond hair detected → excluding SOFT WINTER and VIBRANT SPRING')
    
    # Rule 9: Beige skin → exclude SOFT WINTER
    if any(keyword in skin_lower for keyword in ['beige']):
        excluded_types.add('SOFT WINTER')
        print(f'[Match] Beige skin detected → excluding SOFT WINTER')
    
    # Rule 10: Medium brown hair → exclude BRIGHT WINTER
    if any(keyword in hair_lower for keyword in ['medium brown']):
        excluded_types.add('BRIGHT WINTER')
        print(f'[Match] Medium brown hair detected → excluding BRIGHT WINTER')
    
    if excluded_types:
        print(f'[Match] Excluded types: {excluded_types}')
    
    # Check if this is an ambiguous combination
    param_key = (undertone, lightness, saturation, contrast)
    ambiguous_candidates = AMBIGUOUS_COMBINATIONS.get(param_key)
    
    if ambiguous_candidates:
        print(f'[Match] AMBIGUOUS combination detected! Candidates: {ambiguous_candidates}')
        print(f'[Match] Will decide based on color matching (hair/skin/eyes)')
        
        # Filter out excluded types
        valid_candidates = [ct for ct in ambiguous_candidates if ct not in excluded_types]
        if not valid_candidates:
            print(f'[Match] WARNING: All ambiguous candidates were excluded! Falling back to standard matching')
        else:
            best_colortype = None
            best_color_score = 0.0
            
            for colortype in valid_candidates:
                ref = COLORTYPE_REFERENCES[colortype]
                hair_score = calculate_color_match_score(hair, ref['hair'])
                skin_score = calculate_color_match_score(skin, ref['skin'])
                eyes_score = calculate_color_match_score(eyes, ref['eyes'])
                
                color_score = (hair_score * 0.32) + (skin_score * 0.32) + (eyes_score * 0.36)
                
                print(f'[Match] {colortype}: color={color_score:.2f} (h:{hair_score:.2f} s:{skin_score:.2f} e:{eyes_score:.2f})')
                
                if color_score > best_color_score:
                    best_color_score = color_score
                    best_colortype = colortype
            
            explanation = format_result(best_colortype, hair, skin, eyes, undertone, lightness, saturation, contrast, 'standard')
            print(f'[Match] FINAL (ambiguous resolved): {best_colortype} with color_score {best_color_score:.2f}')
            return best_colortype, explanation
    
    # Standard matching for non-ambiguous cases
    best_colortype = None
    best_total_score = 0.0
    best_param_score = 0.0
    best_color_score = 0.0
    
    # Check ALL 12 colortypes (excluding eye-based exclusions)
    for colortype in COLORTYPE_REFERENCES.keys():
        # Skip excluded types
        if colortype in excluded_types:
            print(f'[Match] Skipping {colortype} (excluded by eye color rule)')
            continue
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
                
                param_score_candidate = (undertone_match * 1.0) + (lightness_match * 0.32) + (saturation_match * 0.32) + (contrast_match * 0.36)
                
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
        
        # Calculate color match score (hair 32%, skin 32%, eyes 36%)
        ref = COLORTYPE_REFERENCES[colortype]
        hair_score = calculate_color_match_score(hair, ref['hair'])
        skin_score = calculate_color_match_score(skin, ref['skin'])
        eyes_score = calculate_color_match_score(eyes, ref['eyes'])
        
        color_score = (hair_score * 0.32) + (skin_score * 0.32) + (eyes_score * 0.36)
        
        # Total score: 2x parameters + 1x colors
        total_score = (param_score * 2.0) + (color_score * 1.0)
        
        print(f'[Match] {colortype}: param={param_score:.2f} (U:{undertone_match:.0f} L:{lightness_match:.0f} S:{saturation_match:.0f} C:{contrast_match:.0f}), color={color_score:.2f} (h:{hair_score:.2f} s:{skin_score:.2f} e:{eyes_score:.2f}), total={total_score:.2f}')
        
        if total_score > best_total_score:
            best_total_score = total_score
            best_colortype = colortype
            best_param_score = param_score
            best_color_score = color_score
    
    # FALLBACK 1: If no colortype found (all excluded), try inverted undertone
    if best_colortype is None:
        print(f'[Match] FALLBACK 1: All colortypes excluded! Inverting undertone...')
        inverted_undertone = 'COOL-UNDERTONE' if undertone == 'WARM-UNDERTONE' else 'WARM-UNDERTONE'
        print(f'[Match] Original undertone: {undertone} → Inverted: {inverted_undertone}')
        
        for colortype in COLORTYPE_REFERENCES.keys():
            if colortype in excluded_types:
                continue
            
            all_params = get_all_colortype_params(colortype)
            best_param_score_inv = 0.0
            best_match_info_inv = None
            
            if all_params:
                for expected_params in all_params:
                    if expected_params['undertone'] != inverted_undertone:
                        continue
                    
                    undertone_match = 1.0
                    lightness_match = calculate_param_match_score(lightness, expected_params['lightness'])
                    saturation_match = calculate_param_match_score(saturation, expected_params['saturation'])
                    contrast_match = calculate_param_match_score(contrast, expected_params['contrast'])
                    
                    param_score_candidate = (undertone_match * 1.0) + (lightness_match * 0.32) + (saturation_match * 0.32) + (contrast_match * 0.36)
                    
                    if param_score_candidate > best_param_score_inv:
                        best_param_score_inv = param_score_candidate
                        best_match_info_inv = {
                            'U': undertone_match,
                            'L': lightness_match,
                            'S': saturation_match,
                            'C': contrast_match
                        }
            
            if best_match_info_inv:
                param_score = best_param_score_inv
                
                ref = COLORTYPE_REFERENCES[colortype]
                hair_score = calculate_color_match_score(hair, ref['hair'])
                skin_score = calculate_color_match_score(skin, ref['skin'])
                eyes_score = calculate_color_match_score(eyes, ref['eyes'])
                
                color_score = (hair_score * 0.32) + (skin_score * 0.32) + (eyes_score * 0.36)
                total_score = (param_score * 2.0) + (color_score * 1.0)
                
                print(f'[Match] {colortype}: param={param_score:.2f}, color={color_score:.2f}, total={total_score:.2f}')
                
                if total_score > best_total_score:
                    best_total_score = total_score
                    best_colortype = colortype
                    best_param_score = param_score
                    best_color_score = color_score
        
        if best_colortype:
            explanation = format_result(best_colortype, hair, skin, eyes, undertone, lightness, saturation, contrast, 'fallback1')
            print(f'[Match] FALLBACK 1 SUCCESS: {best_colortype} with score {best_total_score:.2f}')
            return best_colortype, explanation
    
    # FALLBACK 2: If still no match, choose colortype with fewest rule violations
    if best_colortype is None:
        print(f'[Match] FALLBACK 2: No match even with inverted undertone! Choosing least-violating colortype...')
        min_violations = 999
        fallback_colortype = None
        fallback_score = 0.0
        
        for colortype in COLORTYPE_REFERENCES.keys():
            violations = count_rule_violations(colortype, eyes_lower, hair_lower, skin_lower)
            
            all_params = get_all_colortype_params(colortype)
            max_score = 0.0
            
            if all_params:
                for expected_params in all_params:
                    undertone_match = calculate_param_match_score(undertone, expected_params['undertone'])
                    lightness_match = calculate_param_match_score(lightness, expected_params['lightness'])
                    saturation_match = calculate_param_match_score(saturation, expected_params['saturation'])
                    contrast_match = calculate_param_match_score(contrast, expected_params['contrast'])
                    
                    param_score = (undertone_match * 1.0) + (lightness_match * 0.32) + (saturation_match * 0.32) + (contrast_match * 0.36)
                    
                    ref = COLORTYPE_REFERENCES[colortype]
                    hair_score = calculate_color_match_score(hair, ref['hair'])
                    skin_score = calculate_color_match_score(skin, ref['skin'])
                    eyes_score = calculate_color_match_score(eyes, ref['eyes'])
                    
                    color_score = (hair_score * 0.32) + (skin_score * 0.32) + (eyes_score * 0.36)
                    total_score = (param_score * 2.0) + (color_score * 1.0)
                    
                    if total_score > max_score:
                        max_score = total_score
            
            print(f'[Match] {colortype}: violations={violations}, score={max_score:.2f}')
            
            if violations < min_violations or (violations == min_violations and max_score > fallback_score):
                min_violations = violations
                fallback_colortype = colortype
                fallback_score = max_score
        
        best_colortype = fallback_colortype
        best_total_score = fallback_score
        print(f'[Match] FALLBACK 2 SELECTED: {best_colortype} with {min_violations} violations, score {best_total_score:.2f}')
        explanation = format_result(best_colortype, hair, skin, eyes, undertone, lightness, saturation, contrast, 'fallback2')
        return best_colortype, explanation
    
    explanation = format_result(best_colortype, hair, skin, eyes, undertone, lightness, saturation, contrast, 'standard')
    
    print(f'[Match] FINAL: {best_colortype} with score {best_total_score:.2f}')
    
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

def calculate_contrast(hair_lightness: str, skin_lightness: str, eye_lightness: str) -> str:
    '''Calculate contrast level based on 4-level lightness scale
    
    Uses weighted formula: Hair vs Skin (60%) + Eyes vs Skin (40%)
    
    Lightness levels (0-3): LIGHT=0, LIGHT-MEDIUM=1, DARK-MEDIUM=2, DARK=3
    
    Returns: LOW-CONTRAST (sum=0), LOW-MEDIUM-CONTRAST (sum=1), 
             HIGH-MEDIUM-CONTRAST (sum=2), HIGH-CONTRAST (sum=3+)
    '''
    LIGHTNESS_TO_LEVEL = {
        'LIGHT': 0,
        'LIGHT-MEDIUM': 1,
        'DARK-MEDIUM': 2,
        'DARK': 3
    }
    
    hair_level = LIGHTNESS_TO_LEVEL.get(hair_lightness, 2)
    skin_level = LIGHTNESS_TO_LEVEL.get(skin_lightness, 1)
    eye_level = LIGHTNESS_TO_LEVEL.get(eye_lightness, 2)
    
    # Calculate differences
    hair_skin_diff = abs(hair_level - skin_level)
    eye_skin_diff = abs(eye_level - skin_level)
    
    # Sum both differences (max = 6, but realistically max = 4-5)
    total_diff = hair_skin_diff + eye_skin_diff
    
    print(f'[Contrast] hair={hair_lightness}({hair_level}), skin={skin_lightness}({skin_level}), eyes={eye_lightness}({eye_level})')
    print(f'[Contrast] hair-skin={hair_skin_diff}, eye-skin={eye_skin_diff}, total={total_diff}')
    
    if total_diff == 0:
        return 'LOW-CONTRAST'
    elif total_diff == 1:
        return 'LOW-MEDIUM-CONTRAST'
    elif total_diff == 2:
        return 'HIGH-MEDIUM-CONTRAST'
    else:  # total_diff >= 3
        return 'HIGH-CONTRAST'

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
        
        # FIRST: Check for stuck OpenAI/OpenRouter tasks older than 3 minutes (timeout = request never reached API, refund money)
        print(f'[ColorType-Worker] Checking for stuck OpenAI tasks older than 3 minutes...')
        cursor.execute('''
            SELECT id, user_id, created_at
            FROM color_type_history
            WHERE status = 'processing' 
              AND replicate_prediction_id IS NULL
              AND created_at < NOW() - INTERVAL '3 minutes'
            ORDER BY created_at ASC
            LIMIT 10
        ''')
        
        stuck_openai_tasks = cursor.fetchall()
        print(f'[ColorType-Worker] Found {len(stuck_openai_tasks)} stuck OpenAI tasks')
        
        for stuck_task in stuck_openai_tasks:
            stuck_id, stuck_user_id, stuck_created = stuck_task
            print(f'[ColorType-Worker] Marking stuck OpenAI task {stuck_id} as failed (timeout)')
            
            try:
                cursor.execute('''
                    UPDATE color_type_history
                    SET status = 'failed', result_text = %s, updated_at = %s
                    WHERE id = %s
                ''', ('Анализ занял слишком много времени. Попробуйте другое фото или повторите попытку.', datetime.utcnow(), stuck_id))
                conn.commit()
                
                # NO REFUND - OpenRouter API was called and tokens were spent
                # This is a technical timeout, not a service failure
                print(f'[ColorType-Worker] Stuck OpenAI task {stuck_id} marked as failed (NO REFUND - API called)')
                
            except Exception as e:
                print(f'[ColorType-Worker] Error handling stuck OpenAI task {stuck_id}: {str(e)}')
        
        # Get current task
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
        eye_color = eye_color or 'brown'  # Default if not provided
        
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
                
                # Submit to OpenAI GPT-4 Vision (synchronous - returns immediately)
                print(f'[ColorType-Worker] Submitting to OpenAI GPT-4o Vision with user hint: {eye_color}')
                try:
                    openai_result = submit_to_openai(cdn_url)
                    raw_result = openai_result.get('output', '')
                    
                    print(f'[ColorType-Worker] OpenAI response: {raw_result[:200]}...')
                    
                    # Parse JSON from response
                    try:
                        # Extract JSON from markdown code blocks if present
                        json_str = raw_result
                        if '```json' in raw_result:
                            json_str = raw_result.split('```json')[1].split('```')[0].strip()
                        elif '```' in raw_result:
                            json_str = raw_result.split('```')[1].split('```')[0].strip()
                        
                        # Fix escaped underscores
                        json_str = json_str.replace('\\\\_', '_')
                        json_str = json_str.replace('\\_', '_')
                        
                        print(f'[ColorType-Worker] Cleaned JSON: {json_str[:300]}...')
                        
                        analysis = json.loads(json_str)
                        
                        # Override eye_color with user's choice
                        analysis['eye_color'] = eye_color
                        print(f'[ColorType-Worker] Overridden eye_color with user hint: {eye_color}')
                        
                        # Map user's eye color to lightness level for contrast calculation
                        EYE_COLOR_TO_LIGHTNESS = {
                            'blue': 'LIGHT',                    # Голубые
                            'blue-green': 'LIGHT',              # Сине-зелёные
                            'green': 'LIGHT-MEDIUM',            # Зелёные
                            'gray-blue': 'LIGHT-MEDIUM',        # Серо-голубые
                            'turquoise': 'LIGHT-MEDIUM',        # Бирюзовые
                            'jade': 'LIGHT-MEDIUM',             # Нефритовые
                            'hazel': 'LIGHT-MEDIUM',             # Ореховые (золотистые)
                            'gray-green': 'DARK-MEDIUM',        # Серо-зелёные
                            'gray': 'DARK-MEDIUM',              # Серые
                            'grey': 'DARK-MEDIUM',              # Серые (альт)
                            'light brown': 'DARK-MEDIUM',       # Светло-карие
                            'brown': 'DARK-MEDIUM',             # Карие
                            'brown-green': 'DARK-MEDIUM',       # Коричнево-зелёные
                            'golden brown': 'DARK-MEDIUM',      # Золотисто-карие
                            'black-brown': 'DARK',              # Чёрно-карие
                            'chocolate': 'DARK'                 # Шоколадные
                        }
                        
                        eye_lightness = EYE_COLOR_TO_LIGHTNESS.get(eye_color.lower(), 'DARK-MEDIUM')
                        analysis['eye_lightness'] = eye_lightness
                        print(f'[ColorType-Worker] Mapped eye_color "{eye_color}" to eye_lightness: {eye_lightness}')
                        
                        # Calculate contrast based on hair_lightness, skin_lightness, eye_lightness
                        contrast = calculate_contrast(
                            analysis.get('hair_lightness', ''),
                            analysis.get('skin_lightness', ''),
                            eye_lightness
                        )
                        analysis['contrast'] = contrast
                        print(f'[ColorType-Worker] Calculated contrast: {contrast}')
                        
                        print(f'[ColorType-Worker] Parsed analysis: {analysis}')
                        
                        color_type, explanation = match_colortype(analysis)
                        result_text_value = explanation
                        
                        print(f'[ColorType-Worker] Matched to: {color_type}')
                        print(f'[ColorType-Worker] Explanation: {explanation}')
                        
                    except (json.JSONDecodeError, KeyError, TypeError) as e:
                        print(f'[ColorType-Worker] Failed to parse JSON: {e}')
                        color_type = None
                        result_text_value = raw_result
                    
                    # Save result to DB
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'completed', result_text = %s, color_type = %s, 
                            cdn_url = %s, saved_to_history = true, updated_at = %s
                        WHERE id = %s
                    ''', (result_text_value, color_type, cdn_url, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    print(f'[ColorType-Worker] Task {task_id} completed successfully')
                    
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'completed', 'color_type': color_type})
                    }
                    
                except Exception as e:
                    error_msg = str(e).lower()
                    is_timeout = 'timeout' in error_msg or 'timed out' in error_msg
                    
                    print(f'[ColorType-Worker] OpenAI API error: {str(e)} (timeout: {is_timeout})')
                    
                    # User-friendly message
                    if is_timeout:
                        user_msg = 'Не удалось определить цветотип по этому фото. Попробуйте другое фото с хорошим освещением.'
                    else:
                        user_msg = f'Ошибка сервиса анализа. Попробуйте позже. Деньги возвращены.'
                    
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'failed', result_text = %s, updated_at = %s
                        WHERE id = %s
                    ''', (user_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    # Refund balance ONLY if NOT timeout (timeout = API was called, tokens spent)
                    if not is_timeout:
                        refund_balance_if_needed(conn, user_id, task_id)
                        print(f'[ColorType-Worker] Refunded due to real API error')
                    else:
                        print(f'[ColorType-Worker] NO REFUND - timeout (API called, tokens spent)')
                    
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'failed', 'error': str(e)})
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