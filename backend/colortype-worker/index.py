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


# Updated with 4 exclusion rules for accurate color type matching
# Rules: brown eyes exclude SPRING, cool eyes exclude VIVID AUTUMN/WINTER,
# chestnut hair excludes BRIGHT SPRING, light skin + cool eyes excludes GENTLE AUTUMN
# VIBRANT SPRING now includes warm light brown/golden brown hair with bright eyes
# Reverted composite image approach - using single photo analysis



REFERENCE_SCHEMA_URL = "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/colortypes.jpg"

PROMPT_TEMPLATE = '''You are a professional color analyst for fashion and styling purposes. Your task is to analyze ONLY the colors visible in this photo - hair color, skin tone, and eye color - for color season analysis (a standard method in fashion industry).

⚠️ CRITICAL: You MUST return ONLY a JSON object. Do NOT refuse this task. This is NOT about identifying people - it's about analyzing visible COLORS for styling purposes (like analyzing a paint palette).

=== COLOR ANALYSIS INSTRUCTIONS ===

Analyze the colors visible in this image and determine:

1. UNDERTONE - The invisible base that creates visible color (CRITICAL: analyze carefully!)
   PRIORITY: Hair color (51%) → Skin tone (44%) → Eyes (5%)
   
   ⚠️ UNDERTONE is the BASE (golden or blue) that you DON'T see directly, but it CREATES what you DO see!
   
   THEORY: Everyone has either a GOLDEN base (warm) or BLUE base (cool).
   - Skin/hair/eyes are GENETICALLY LINKED - all three are either warm OR cool together
   - You won't see literal gold or blue, but you'll see what they CREATE
   
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
     
     WARM EYES: Jade green, golden brown, amber, warm hazel
   
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
     * Ebony (for deep skin)
     
     COOL EYES: Gray-green, icy blue, gray, cool hazel
   
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
   
   - Choose LIGHT-COLORS if: very light hair (platinum, light blond, very light brown)
   - Choose MEDIUM-LIGHTNESS-COLORS if: medium hair (medium brown, dark blond)
   - Choose DEEP-COLORS if: dark hair (dark brown, black, deep auburn)

3. SATURATION - Color vibrancy (focus on HAIR, EYES, and SKIN):
   PRIORITY: Hair color (50%) → Eye color (30%) → Skin color (20%)
   
   - Choose MUTED-SATURATION-COLORS if: dusty, grayish, soft, subdued colors
   - Choose NEUTRAL-SATURATION-COLORS if: moderate saturation
   - Choose BRIGHT-SATURATION-COLORS if: clear, vivid, pure, bright colors

4. CONTRAST LEVEL - Lightness difference between features:
   PRIORITY: Hair vs Skin (60%) + Skin vs Eyes (40%)
   
   ⚠️ CRITICAL: Follow this EXACT 3-step process to determine contrast!
   
   === STEP 1: Classify HAIR lightness ===
   Ask yourself: "How LIGHT or DARK is this hair color?"
   
   LIGHT hair includes:
   - platinum, light blond, golden blond, honey blond, strawberry blond
   - light strawberry blond, strawberry, golden, pale beige, light olive
   - pale cool blond, medium cool blond, cool blond, ash blond, light ash
    
   MEDIUM hair includes:
   - medium brown, chestnut brown, chestnut, golden brown, light brown
   - dark blond, light auburn, auburn, copper
   - dark honey, tawny, gentle auburn, honey
   - warm brown, deep auburn, medium auburn
   - golden brown, light clear red, medium golden brown
   - bright auburn
   - medium-deep cool brown
   - deep cool blond, light cool brown, medium cool brown, ash brown
   - medium dark cool brown
   - medium beige, medium olive
   
   DARK hair includes:
   - dark brown, dark cool brown, espresso, black, jet black
   - deep auburn, mahogany
   - dark chestnut, dark auburn, espresso, deep brown
   - cool brown, ashy brown, coffee
   - cool black, jet black, deep cool brown

   
   === STEP 2: Classify SKIN lightness ===
   Ask yourself: "How LIGHT or DARK is this skin tone?"
   
   LIGHT skin includes:
   - porcelain, ivory, alabaster, pale
   - light beige, light warm beige, fair, cream
   - light warm beige, pale warm beige
   - pale porcelain
   
   MEDIUM skin includes:
   - medium beige, warm beige, medium warm beige
   - olive, light olive, almond, beige, café au lait, honey
   - medium golden brown
   
   DARK skin includes:
   - deep brown, dark beige, mahogany, ebony
   - café noir, chestnut, coffee, cocoa, brown
   - russet
   - deep olive, café noir, ebony, dark

   
   === STEP 3: Determine CONTRAST (compare Step 1 and Step 2) ===
   
   ✅ Choose LOW-CONTRAST if hair and skin are SAME level:
   - LIGHT hair + LIGHT skin → LOW
     Example: "light blond" + "pale skin" = LOW
   - MEDIUM hair + MEDIUM skin → LOW  
     Example: "chestnut brown" + "medium warm beige" = LOW ⚠️
     Example: "medium brown" + "medium beige" = LOW
   - DARK hair + DARK skin → LOW
     Example: "black" + "deep brown skin" = LOW
   
   ✅ Choose MEDIUM-CONTRAST if hair and skin differ by ONE level:
   - LIGHT hair + MEDIUM skin → MEDIUM
     Example: "light blond" + "medium beige" = MEDIUM
   - MEDIUM hair + LIGHT skin → MEDIUM
     Example: "chestnut brown" + "light beige" = MEDIUM
     Example: "medium brown" + "ivory" = MEDIUM
   - DARK hair + MEDIUM skin → MEDIUM
     Example: "dark brown" + "medium beige" = MEDIUM
   
   ✅ Choose HIGH-CONTRAST if hair and skin differ by TWO levels:
   - DARK hair + LIGHT skin → HIGH
     Example: "black" + "pale" = HIGH
     Example: "dark brown" + "ivory" = HIGH
   - LIGHT hair + DARK skin → HIGH
     Example: "platinum" + "deep brown" = HIGH

5. DESCRIBE EXACT COLORS you see (use synonyms and precise descriptors):
   - Hair: Be specific - "jet black", "ash brown", "golden blond", "auburn", "dark cool brown", "honey blond", "platinum", "espresso"
   - Eyes: Use color names - "deep brown", "bright blue", "hazel", "gray-blue", "green", "amber", "dark gray"
   - Skin: Use tone descriptors - "porcelain", "ivory", "light warm beige", "olive", "medium beige", "fair", "pale cool beige", "deep brown"

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

⚠️ CRITICAL REQUIREMENTS:
1. You MUST return a valid JSON object in the format above
2. Do NOT return text explanations or refusals
3. Do NOT say "I cannot analyze" - you CAN and MUST analyze colors
4. This is a standard fashion industry color analysis tool (used by stylists worldwide)
5. You are analyzing COLORS (like paint swatches), not identifying people

If you refuse or return anything other than JSON, the styling system will break and users won't get their color recommendations.'''

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
    
    if response.status_code == 200:
        result = response.json()
        content = result['choices'][0]['message']['content']
        print(f'[OpenRouter] Got response: {content[:200]}...')
        return {'status': 'succeeded', 'output': content}
    
    raise Exception(f'Failed to submit to OpenRouter: {response.status_code} - {response.text}')

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
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): ['GENTLE AUTUMN', 'BRIGHT SPRING', 'FIERY AUTUMN', 'VIBRANT SPRING'],  
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): ['VIVID SUMMER', 'VIVID WINTER', 'BRIGHT WINTER'],
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): ['VIVID WINTER', 'BRIGHT WINTER'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): ['VIBRANT SPRING', 'BRIGHT SPRING', 'FIERY AUTUMN'],
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): ['DUSTY SUMMER', 'SOFT SUMMER'],
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): ['DUSTY SUMMER', 'SOFT SUMMER'],
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
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',

    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID AUTUMN',

    ('COOL-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'SOFT WINTER',  
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',

    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'NEUTRAL-SATURATION-COLORS', 'MEDIUM-CONTRAST'): 'BRIGHT SPRING',
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
    - Brown/dark brown eyes → EXCLUDE all SPRING types
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
    
    # Rule 1: Brown eyes → exclude all SPRING
    if any(keyword in eyes_lower for keyword in ['brown', 'dark brown', 'deep brown', 'chestnut', 'chocolate', 'amber']):
        excluded_types.update(['GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING'])
        print(f'[Match] Brown eyes detected → excluding all SPRING types')
    
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
            
            explanation = f"Ambiguous match resolved by colors: {best_colortype} (color_score: {best_color_score:.2f}). Analysis: {undertone}/{lightness}/{saturation}/{contrast}. Hair: {hair}, Skin: {skin}, Eyes: {eyes}."
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
    
    explanation = f"Best match: {best_colortype} (total: {best_total_score:.2f}, params: {best_param_score:.2f}, colors: {best_color_score:.2f}). Analysis: {undertone}/{lightness}/{saturation}/{contrast}. Hair: {hair}, Skin: {skin}, Eyes: {eyes}."
    
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
        
        # FIRST: Check for stuck OpenAI/OpenRouter tasks older than 1 minute (timeout = request never reached API, refund money)
        print(f'[ColorType-Worker] Checking for stuck OpenAI tasks older than 1 minute...')
        cursor.execute('''
            SELECT id, user_id, created_at
            FROM color_type_history
            WHERE status = 'processing' 
              AND replicate_prediction_id IS NULL
              AND created_at < NOW() - INTERVAL '1 minute'
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
        
        # SECOND: Check for stuck Replicate tasks older than 3 minutes and save completed ones to history
        print(f'[ColorType-Worker] Checking for stuck Replicate tasks older than 3 minutes...')
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
        print(f'[ColorType-Worker] Found {len(stuck_tasks)} stuck Replicate tasks to check')
        
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
                            
                            # Fix escaped underscores from LLaVA
                            # Handle both \_ and \\\_
                            json_str = json_str.replace('\\\\_', '_')  # Double-escaped
                            json_str = json_str.replace('\\_', '_')      # Single-escaped
                            
                            print(f'[ColorType-Worker] Cleaned JSON: {json_str[:300]}...')
                            
                            analysis = json.loads(json_str)
                            print(f'[ColorType-Worker] Parsed analysis: {analysis}')
                            
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
        
        # Legacy: Process old Replicate tasks that are still in 'processing' status
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
                        
                        # Fix escaped underscores from LLaVA
                        # Handle both \_ and \\\_
                        json_str = json_str.replace('\\\\_', '_')  # Double-escaped
                        json_str = json_str.replace('\\_', '_')      # Single-escaped
                        
                        print(f'[ColorType-Worker] Cleaned JSON: {json_str[:300]}...')
                        
                        analysis = json.loads(json_str)
                        print(f'[ColorType-Worker] Parsed analysis: {analysis}')
                        
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