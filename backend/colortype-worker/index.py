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


# Updated with 5 exclusion rules for accurate color type matching
# Rules: brown eyes exclude SPRING, cool eyes exclude VIVID AUTUMN/WINTER,
# chestnut hair excludes BRIGHT SPRING, light skin + cool eyes excludes GENTLE AUTUMN,
# blonde hair excludes FIERY/VIVID AUTUMN
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

=== STEP 1: REFERENCE COMPARISON (Do this FIRST!) ===

You will be shown reference schemes for all 12 color types. Each scheme is divided into two parts:

LEFT SIDE - Example person:
- Shows ONE representative example of this color type
- This is just one possible appearance, not the only variant
- Use it to understand the overall harmony and visual impression of this color type

RIGHT SIDE - Color characteristics:
- Top section: Eye color examples most suitable for this color type
- Middle section: Skin tone examples most suitable for this color type  
- Lower-middle section: Hair color examples most suitable for this color type
- Bottom section: Contrast level example for this color type (shows typical lightness difference between features)

⚠️ IMPORTANT: Each scheme has TEXT LABELS in ENGLISH - READ THESE TEXTS carefully! They provide:
- Color type name in English (e.g., "Bright Spring", "Cool Summer", "Dark Autumn")
- Descriptions of color characteristics (undertone, lightness, saturation, contrast)
- Specific color names for hair, skin, and eyes
- Russian translation of the color type name (ignore this - use English name for JSON)

⚠️ CRITICAL NAME MAPPING: The English names you SEE on scheme images are just TITLES on the schemes. 
We use DIFFERENT official names for each color type in our system. You MUST use OUR names in JSON output!

WHEN YOU READ this name on scheme → RETURN this name in JSON `suggested_colortype`:
- "Bright Spring" on scheme → return "VIBRANT SPRING"
- "Warm Spring" on scheme → return "BRIGHT SPRING"  
- "Light Spring" on scheme → return "GENTLE SPRING"
- "Light Summer" on scheme → return "SOFT SUMMER"
- "Cool Summer" on scheme → return "VIVID SUMMER"
- "Soft Summer" on scheme → return "DUSTY SUMMER"
- "Soft Autumn" on scheme → return "GENTLE AUTUMN"
- "Warm Autumn" on scheme → return "FIERY AUTUMN"
- "Dark Autumn" on scheme → return "VIVID AUTUMN"
- "Dark Winter" on scheme → return "VIVID WINTER"
- "Cool Winter" on scheme → return "SOFT WINTER"
- "Bright Winter" on scheme → return "BRIGHT WINTER" (same name)

Example: If you see "Bright Spring" text on the scheme, you MUST write "VIBRANT SPRING" in JSON.
The scheme titles are just labels - our official color type names are different.

TASK FOR STEP 1:
1. Look at the ANALYZED PHOTO carefully
2. Compare it with ALL 12 reference schemes
3. Read the ENGLISH text labels on each scheme to understand:
   - Which color type it represents (but remember to convert the name using the mapping above!)
   - What characteristics define this type (warm/cool, light/deep, muted/bright)
   - What hair/skin/eye colors are typical for this type
4. Determine which scheme's COLOR CHARACTERISTICS (right side) best match the analyzed photo
5. Use the left side example person to assess overall color harmony
6. Pay attention to the contrast level shown at the bottom right of each scheme
7. The analyzed person does NOT need to look identical to the example person - focus on matching the COLOR CHARACTERISTICS (right side)
8. Select the MOST LIKELY color type based on visual comparison
9. Convert the scheme title to OUR official name using the mapping table above

Remember your choice - you will use it as `suggested_colortype` in the final JSON.

=== REFERENCE IMAGE WITH ALL 12 COLOR TYPES ===

You will also be shown a reference image with visual examples of all 12 color types:
https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/8439e7f6-1b4d-4d8f-bf8c-4ff173f0fdf1.webp

This image shows multiple person examples for each color type. Use it to compare with the analyzed photo and understand the visual diversity within each type.

⚠️ CRITICAL COLOR TYPE DISTINCTIONS (use these rules when comparing the analyzed photo):

VIBRANT SPRING - WARM, CLEAR, HIGH-CONTRAST, VIBRANT
Eyes can be brown, but in combination with light hair shades. Eyes are usually bright shades: blue, green, hazel, blue. This color type is similar to BRIGHT WINTER but it does NOT have deep dark hair colors like BRIGHT WINTER has.

BRIGHT WINTER - COLD, SPARKLING EYES, CLEAR SKIN, HIGH-CONTRAST
Differs from other winters by bright eye colors, clear skin colors, deep dark hair colors.

SOFT WINTER - COLD, ICY, BLUE, HIGH-CONTRAST
Skin is pale with bluish undertone, eyes are cool colors, skin has clean shades. Hair is dark colors. Differs from BRIGHT WINTER in that skin is lighter and cooler. Differs from VIVID SUMMER in that skin is paler, hair is darker, contrast is higher.

VIVID WINTER - COLD, ASH OR NEUTRAL HAIR, COOL EYES, SKIN NEUTRAL OR COOL OR OLIVE
Dark hair and dark eyes. Unlike BRIGHT WINTER, skin is less bright, hair is dark colors with ashy shade.

VIVID AUTUMN - WARM, DEEP HAIR, DEEP EYES
Brown hair tones are warm and saturated and dark. Eyes are dark shades. Differs from VIBRANT SPRING in that eyes are brown in combination with brown eyes.

FIERY AUTUMN - TOTAL WARM, RICH COLORS
FIERY AUTUMN is darker than BRIGHT SPRING in skin and hair tone and less bright.

GENTLE AUTUMN - WARM, DUSTY, MUTED HAIR, LOW-CONTRAST
Differs from DUSTY SUMMER in that colors are warmer and more similar to FIERY AUTUMN than to DUSTY SUMMER, but with the same dusty shades.

DUSTY SUMMER - COLD, DUSTY, MUTED HAIR, LOW-CONTRAST
Differs from VIVID SUMMER in that colors are slightly lighter and more dusty, as if there's more gray in them, less saturation. And colder than GENTLE AUTUMN.

VIVID SUMMER - COLD
Differs from winter in that hair is less dark, less bright, skin is more tanned, eyes are not as bright.

SOFT SUMMER - COLD, LOW-CONTRAST
Differs from DUSTY SUMMER and GENTLE AUTUMN in that colors are lighter. Differs from GENTLE SPRING in that colors are cooler.

GENTLE SPRING - WARM, LOW-CONTRAST
Differs from BRIGHT SPRING in that colors are lighter. Differs from SOFT SUMMER in that colors are warmer.

BRIGHT SPRING - WARM
Hair and skin are warm, there is no doubt that colors are warm. Hair colors are medium-light and light but darker than GENTLE SPRING and lighter than VIBRANT SPRING and FIERY AUTUMN.

🎯 YOUR TASK NOW:
1. Compare the ANALYZED PHOTO with the reference image showing all 12 color types
2. Compare the ANALYZED PHOTO with the 12 reference schemes you saw earlier
3. Use the CRITICAL COLOR TYPE DISTINCTIONS above to identify key differences between similar types
4. Determine which color type BEST MATCHES the person in the analyzed photo
5. Make your decision and remember it - you will use it as `suggested_colortype` in the final JSON

⚠️ IMPORTANT: Focus on the OVERALL COLOR HARMONY, not just individual features. The person doesn't need to look identical to examples - focus on matching the color characteristics (warm/cool, light/deep, muted/bright, contrast level).

=== STEP 2: DETAILED ANALYSIS (Do this AFTER step 1) ===

Now that you've identified the most likely color type from reference schemes, analyze the photo in detail to confirm and document the specific characteristics.

Analyze the colors visible in this image and determine:

1. UNDERTONE - The invisible base that creates visible color (CRITICAL: analyze carefully!)
   PRIORITY: Hair color (51%) → Skin tone (44%) → Eyes (5%)
   
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (50% weight), then length (50% weight)
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
     
     WARM SKIN (golden based):
     * Yellow beige (not rosy beige)
     * Peachy, golden, yellow undertones
     * Mahogany (for deep skin)
     
     WARM EYES (supportive, not decisive): Jade green, golden brown, amber, warm hazel
     Note: Eyes can vary - don't use as primary undertone indicator
   
   - Choose COOL-UNDERTONE if the BASE is BLUE (creates cool versions):
     
     COOL HAIR (ash based):
     * Platinum blonde
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
   Step 1: Look at HAIR - does it have ANY honey/red tones? → WARM
   Step 2: If hair looks ash/gray/pure black (NO golden tones) → COOL
   Step 3: Confirm with SKIN - golden/peachy base = WARM, pink/rosy base = COOL
   
   ⚠️ COMMON MISTAKES TO AVOID:
   - Dark hair ≠ automatically cool (dark brown can be warm chestnut!)
   - Light hair ≠ automatically warm (platinum blonde is cool!)
   - Focus on the TONE (golden vs ash), not the DARKNESS!

2. HAIR LIGHTNESS - Darkness level of HAIR ONLY:
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (50% weight), then length (50% weight)
   * Assess darkness at SCALP/ROOTS - natural color shows true lightness level
   
   - Choose LIGHT-HAIR-COLORS if: very light hair (platinum, light blond, golden blond, light strawberry blond)
   - Choose MEDIUM-HAIR-COLORS if: medium hair (medium brown, dark blond, chestnut, light auburn, strawberry blond)
   - Choose DEEP-HAIR-COLORS if: dark hair (auburn, copper, bright auburn, dark brown, black, deep auburn, dark chestnut, espresso)
   
   ⚠️ IMPORTANT: Auburn/copper/bright red hair is visually DEEP/DARK even if it has warm tones!

3. SKIN LIGHTNESS - Darkness level of SKIN ONLY:
   
   - Choose LIGHT-SKIN-COLORS if: very light skin (porcelain, ivory, alabaster, pale, fair)
   - Choose MEDIUM-SKIN-COLORS if: medium skin (beige, medium beige, warm beige, olive, café au lait)
   - Choose DEEP-SKIN-COLORS if: dark skin (deep brown, mahogany, ebony, chestnut)

4. EYES LIGHTNESS - Darkness level of EYES ONLY:
   
   - Choose LIGHT-EYES-COLORS if: light eyes (light blue, bright blue, light green, light gray, jade)
   - Choose MEDIUM-EYES-COLORS if: medium eyes (hazel, green, amber, medium brown, golden brown)
   - Choose DEEP-EYES-COLORS if: dark eyes (dark brown, black-brown, deep brown, chocolate)

5. SATURATION - Color vibrancy (focus on HAIR, EYES, and SKIN):
   PRIORITY: Hair color (50%) → Eye color (30%) → Skin color (20%)
   
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (55% weight), then length (45% weight)
   * Assess vibrancy at SCALP/ROOTS - natural color shows true saturation
   
   Ask yourself: "Do the colors look CLEAR and PURE, or DUSTY and SOFT?"
   
   - Choose MUTED-SATURATION-COLORS if: colors are dusty, grayish, soft, subdued (like gray veil over colors)
   
   - Choose MUTED-NEUTRAL-SATURATION-COLORS if: colors are moderately saturated but lean toward soft, slightly muted, gentle (closer to MUTED than BRIGHT)
   
   - Choose BRIGHT-NEUTRAL-SATURATION-COLORS if: colors are moderately saturated but lean toward clear, somewhat vivid, fresh (closer to BRIGHT than MUTED)
   
   - Choose BRIGHT-SATURATION-COLORS if: colors are clear, vivid, pure, bright, vibrant (no gray mixed in, pure pigments)

6. CONTRAST LEVEL - Difference in visual darkness between features:
   PRIORITY: Hair vs Skin (60%) + Eyes vs Skin (40%)
   
   ⚠️ CRITICAL: Assess VISUAL DARKNESS as if this photo were BLACK-AND-WHITE!
   Ignore color hue (golden/ash/red) - focus ONLY on how DARK each area appears.
   
   🎯 BLACK-AND-WHITE TEST:
   Imagine converting this photo to grayscale (black and white).
   - How DARK does the hair area look? (Light gray, medium gray, or dark gray/black?)
   - How DARK does the skin area look? (Light tone, medium tone, or dark tone?)
   - How DARK do the eyes look? (Light, medium, or dark?)
   
   ⚠️ HAIR ANALYSIS: Look at ROOTS first (55% weight), then length (45% weight)
   * Assess visual darkness at ROOTS - natural root color shows true tonal contrast
   
   === STEP 1: Assess VISUAL DARKNESS of each zone ===
   
   For HAIR (at roots):
   Ask: "If this were a black-and-white photo, how DARK would the hair appear?"
   
   - LIGHT tone = Hair looks like LIGHT GRAY or almost white
     (Very light, pale, bright area - minimal darkness)
   
   - MEDIUM tone = Hair looks like MEDIUM GRAY
     (Moderate darkness - clearly visible but not very dark)
   
   - DARK tone = Hair looks like DARK GRAY or BLACK
     (High darkness - very dark area, strong visual weight)
   
   For SKIN:
   Ask: "If this were a black-and-white photo, how DARK would the skin appear?"
   
   - LIGHT tone = Skin looks like LIGHT GRAY or almost white
     (Very bright, minimal darkness)
   
   - MEDIUM tone = Skin looks like MEDIUM GRAY
     (Moderate darkness level)
   
   - DARK tone = Skin looks like DARK GRAY
     (High darkness level)
   
   For EYES:
   Ask: "If this were a black-and-white photo, how DARK would the eyes appear?"
   
   - LIGHT tone = Eyes look like LIGHT GRAY
     (Bright eyes, low darkness)
   
   - MEDIUM tone = Eyes look like MEDIUM GRAY
     (Moderate darkness)
   
   - DARK tone = Eyes look like DARK GRAY or BLACK
     (Very dark eyes, high darkness)
   
   === STEP 2: Determine CONTRAST level ===
   
   Now compare the VISUAL DARKNESS between zones:
   
   Assign darkness levels:
   * LIGHT tone → level 0
   * MEDIUM tone → level 1
   * DARK tone → level 2
   
   Calculate: |hair_level - skin_level| + |eyes_level - skin_level|
   
   - Choose LOW-CONTRAST if: total difference = 0
     (All zones have similar visual darkness)
     Example: Light hair + Light skin + Light eyes = 0
   
   - Choose LOW-MEDIUM-CONTRAST if: total difference = 1
     (Small difference in visual darkness)
     Example: Light hair + Light skin + Medium eyes = 1
   
   - Choose HIGH-MEDIUM-CONTRAST if: total difference = 2
     (Noticeable difference in visual darkness)
     Example: Dark hair + Medium skin + Light eyes = |2-1| + |0-1| = 2
   
   - Choose HIGH-CONTRAST if: total difference ≥ 3
     (Strong difference - almost white areas next to almost black areas)
     Example: Dark hair + Light skin + Dark eyes = |2-0| + |2-0| = 4

7. DESCRIBE EXACT COLORS you see (use synonyms and precise descriptors):
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

=== STEP 3: FINAL JSON OUTPUT ===

Combine your visual assessment (STEP 1) with detailed analysis (STEP 2) to produce the final result.

=== OUTPUT FORMAT ===

Return ONLY a valid JSON object with your analysis of THIS SPECIFIC PHOTO:

{{
  "suggested_colortype": "[MOST IMPORTANT! Your choice from STEP 1 based on visual reference comparison: VIBRANT SPRING, BRIGHT SPRING, GENTLE SPRING, SOFT SUMMER, VIVID SUMMER, DUSTY SUMMER, GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, VIVID WINTER, SOFT WINTER, or BRIGHT WINTER]",
  "undertone": "[From STEP 2: WARM-UNDERTONE or COOL-UNDERTONE]",
  "hair_lightness": "[From STEP 2: LIGHT-HAIR-COLORS, MEDIUM-HAIR-COLORS, or DEEP-HAIR-COLORS]",
  "skin_lightness": "[From STEP 2: LIGHT-SKIN-COLORS, MEDIUM-SKIN-COLORS, or DEEP-SKIN-COLORS]",
  "eyes_lightness": "[From STEP 2: LIGHT-EYES-COLORS, MEDIUM-EYES-COLORS, or DEEP-EYES-COLORS]",
  "saturation": "[From STEP 2: MUTED-SATURATION-COLORS, MUTED-NEUTRAL-SATURATION-COLORS, BRIGHT-NEUTRAL-SATURATION-COLORS, or BRIGHT-SATURATION-COLORS]",
  "contrast": "[From STEP 2: LOW-CONTRAST, LOW-MEDIUM-CONTRAST, HIGH-MEDIUM-CONTRAST, or HIGH-CONTRAST]",
  "hair_color": "[From STEP 2: exact description of hair color YOU SEE]",
  "eye_color": "[From STEP 2: exact description of eye color YOU SEE]",
  "skin_color": "[From STEP 2: exact description of skin tone YOU SEE]"
}}

⚠️ CRITICAL REQUIREMENTS:
1. You MUST return a valid JSON object in the format above
2. Do NOT return text explanations or refusals
3. Do NOT say "I cannot analyze" - you CAN and MUST analyze colors
4. This is a standard fashion industry color analysis tool (used by stylists worldwide)
5. You are analyzing COLORS (like paint swatches), not identifying people

If you refuse or return anything other than JSON, the styling system will break and users won't get their color recommendations.'''

def format_result(colortype: str, hair: str, skin: str, eyes: str, 
                  undertone: str, saturation: str, contrast: str,
                  fallback_type: str = 'standard') -> str:
    '''Format user-friendly result message in Russian'''
    colortype_ru = COLORTYPE_NAMES_RU.get(colortype, colortype)
    undertone_ru = UNDERTONE_RU.get(undertone, undertone)
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
    
    # Generate filename: images/colortypes/{user_id}/{task_id}.jpg
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
    from urllib.parse import quote
    
    openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
    if not openrouter_api_key:
        raise Exception('OPENROUTER_API_KEY not configured')
    
    headers = {
        'Authorization': f'Bearer {openrouter_api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fitting-room.ru',
        'X-Title': 'Virtual Fitting Room - Colortype Analysis'
    }
    
    # Load reference schemes from Python module (better for Cloud Functions deployment)
    from colortype_data import COLORTYPE_REFERENCES_DATA
    colortype_refs = COLORTYPE_REFERENCES_DATA
    print(f'[OpenRouter] Loaded {len(colortype_refs)} colortype references')
    
    # Helper function to encode URL (replace spaces with %20)
    def encode_url(url: str) -> str:
        '''Encode URL by replacing spaces and special characters'''
        # Split URL into base and path
        if '://' in url:
            protocol, rest = url.split('://', 1)
            if '/' in rest:
                domain, path = rest.split('/', 1)
                # Encode only the path part (after domain)
                encoded_path = quote(path, safe='/:')
                return f'{protocol}://{domain}/{encoded_path}'
        return url
    
    # Build content array: prompt + analyzed photo + reference schemes + 2 examples per type
    content = [
        {
            'type': 'text',
            'text': 'ANALYZED PHOTO (determine color type for THIS person):'
        },
        {
            'type': 'image_url',
            'image_url': {'url': image_url}
        },
        {
            'type': 'text',
            'text': '\n=== REFERENCE SCHEMES (compare analyzed photo with these) ===\n'
        }
    ]
    
    # Add reference schemes ONLY (without examples) - 12 schemes total
    for colortype_name, ref_data in colortype_refs.items():
        # Always add scheme for each colortype
        scheme_url = encode_url(ref_data['scheme_url'])
        content.append({
            'type': 'text',
            'text': f'\n{colortype_name} scheme:'
        })
        content.append({
            'type': 'image_url',
            'image_url': {'url': scheme_url}
        })
    
    # Add reference image with all 12 color type examples
    content.append({
        'type': 'text',
        'text': '\n=== ALL 12 COLOR TYPES EXAMPLES (visual reference) ===\n'
    })
    content.append({
        'type': 'image_url',
        'image_url': {'url': 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/8439e7f6-1b4d-4d8f-bf8c-4ff173f0fdf1.webp'}
    })
    
    # Add analysis instructions
    content.append({
        'type': 'text',
        'text': f'\n\n{PROMPT_TEMPLATE}'
    })
    
    payload = {
        'model': 'openai/gpt-4o',  # OpenRouter format: provider/model
        'messages': [
            {
                'role': 'user',
                'content': content
            }
        ],
        'max_tokens': 600,
        'temperature': 0.3  # Lower temperature for more consistent analysis
    }
    
    # Debug: count images in request
    image_count = sum(1 for item in content if item.get('type') == 'image_url')
    print(f'[OpenRouter] Request contains {image_count} images')
    print(f'[OpenRouter] User photo URL: {image_url}')
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

# Lightness combinations allowed for each colortype (hair, skin, eyes)
COLORTYPE_LIGHTNESS_COMBINATIONS = {
    'VIBRANT SPRING': [
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
    ],
    'BRIGHT SPRING': [
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'GENTLE SPRING': [
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
    ],
    'SOFT SUMMER': [
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'VIVID SUMMER': [
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'DUSTY SUMMER': [
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'GENTLE AUTUMN': [
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'FIERY AUTUMN': [
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
    ],
    'VIVID AUTUMN': [
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
    ],
    'VIVID WINTER': [
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
    ],
    'SOFT WINTER': [
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
    ],
    'BRIGHT WINTER': [
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
    ],
}

# Ambiguous parameter combinations that require color-based resolution
# If parameters match one of these keys, compare color scores for all candidates
AMBIGUOUS_COMBINATIONS = {
    # COOL-UNDERTONE combinations
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER', 'SOFT WINTER'],
    
    # WARM-UNDERTONE combinations
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'BRIGHT SPRING', 'GENTLE AUTUMN'],
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'GENTLE AUTUMN', 'GENTLE SPRING'],
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

# Mapping table: (undertone, saturation, contrast) -> colortype
COLORTYPE_MAP = {
    # ============ SOFT SUMMER ============
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',

    # ============ VIVID SUMMER ============
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',

    # ============ DUSTY SUMMER ============
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'DUSTY SUMMER',

    # ============ GENTLE AUTUMN ============
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',

    # ============ FIERY AUTUMN ============
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'FIERY AUTUMN',

    # ============ VIVID AUTUMN ============
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID AUTUMN',

    # ============ VIVID WINTER ============
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',

    # ============ SOFT WINTER ============
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'SOFT WINTER',

    # ============ BRIGHT WINTER ============
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',

    # ============ VIBRANT SPRING ============
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',

    # ============ BRIGHT SPRING ============
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT SPRING',

    # ============ GENTLE SPRING ============
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',

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

def get_colortype_params(colortype: str) -> list:
    '''Get parameter combinations (undertone, saturation, contrast) for a colortype
    
    Returns: List of tuples with parameter combinations from COLORTYPE_MAP
    '''
    params_list = []
    for (undertone, saturation, contrast), ct in COLORTYPE_MAP.items():
        if ct == colortype:
            params_list.append((undertone, saturation, contrast))
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
    
    # Rule 1: Brown eyes → exclude GENTLE SPRING, BRIGHT SPRING (NOT VIBRANT SPRING - it can have brown eyes), all SUMMER, and SOFT WINTER
    if any(keyword in eyes_lower for keyword in ['black-brown', 'brown', 'brown-green', 'dark brown', 'deep brown', 'chestnut', 'chocolate', 'amber']):
        if colortype in ['GENTLE SPRING', 'BRIGHT SPRING', 'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER', 'SOFT WINTER']:
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
    '''Match analysis to best colortype using 3-stage filtering
    
    Stage 1: Filter by lightness combinations (hair, skin, eyes)
    Stage 2: Check (undertone, saturation, contrast) parameters
    Stage 3: Final selection by color keyword matching
    
    NEW SCORING:
    Parameters (weight x2):
    - Undertone: 100%
    - Saturation: 50%
    - Contrast: 50%
    
    Colors (weight x1) - DYNAMIC WEIGHTS:
    - WARM undertone: Hair 45%, Skin 25%, Eyes 30%
    - COOL undertone: Hair 32%, Skin 32%, Eyes 36%
    
    BONUSES:
    - Auburn/copper/red hair + VIBRANT SPRING: +0.15
    
    Total score = (param_score * 2.0) + (color_score * 1.0)
    
    Returns: (colortype, explanation)
    '''
    undertone = analysis.get('undertone', '')
    hair_lightness = analysis.get('hair_lightness', '')
    skin_lightness = analysis.get('skin_lightness', '')
    eyes_lightness = analysis.get('eyes_lightness', '')
    saturation = analysis.get('saturation', '')
    contrast = analysis.get('contrast', '')
    hair = analysis.get('hair_color', '')
    eyes = analysis.get('eye_color', '')
    skin = analysis.get('skin_color', '')
    
    print(f'[Match] Analyzing: {undertone}/{saturation}/{contrast}')
    print(f'[Match] Lightness: hair={hair_lightness}, skin={skin_lightness}, eyes={eyes_lightness}')
    print(f'[Match] Colors: hair="{hair}", skin="{skin}", eyes="{eyes}"')
    
    # Determine exclusions based on eyes, hair, and skin
    eyes_lower = eyes.lower()
    hair_lower = hair.lower()
    skin_lower = skin.lower()
    excluded_types = set()
    
    # Rule 1: Brown eyes → exclude GENTLE SPRING, BRIGHT SPRING (NOT VIBRANT SPRING - it can have brown eyes), all SUMMER, and SOFT WINTER
    if any(keyword in eyes_lower for keyword in ['black-brown', 'brown', 'brown-green', 'dark brown', 'deep brown', 'chestnut', 'chocolate', 'amber']):
        excluded_types.update(['GENTLE SPRING', 'BRIGHT SPRING', 'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER', 'SOFT WINTER'])
        print(f'[Match] Brown eyes detected → excluding GENTLE SPRING, BRIGHT SPRING (keeping VIBRANT SPRING), all SUMMER, and SOFT WINTER')
    
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
    
    if excluded_types:
        print(f'[Match] Excluded types: {excluded_types}')
    
    # ============ STAGE 1: Filter by lightness combinations ============
    lightness_key = (hair_lightness, skin_lightness, eyes_lightness)
    stage1_candidates = []
    
    for colortype, allowed_combinations in COLORTYPE_LIGHTNESS_COMBINATIONS.items():
        if lightness_key in allowed_combinations:
            stage1_candidates.append(colortype)
    
    print(f'[Match] STAGE 1: Lightness filter ({lightness_key}) → {len(stage1_candidates)} candidates: {stage1_candidates}')
    
    if not stage1_candidates:
        print(f'[Match] WARNING: No colortypes match lightness combination! Falling back to all colortypes')
        stage1_candidates = list(COLORTYPE_REFERENCES.keys())
    
    # Remove excluded types
    stage1_candidates = [ct for ct in stage1_candidates if ct not in excluded_types]
    print(f'[Match] After exclusion rules: {len(stage1_candidates)} candidates: {stage1_candidates}')
    
    if not stage1_candidates:
        print(f'[Match] WARNING: All candidates excluded! Using fallback')
        stage1_candidates = list(COLORTYPE_REFERENCES.keys())
    
    # ============ STAGE 2: Check (undertone, saturation, contrast) ============
    param_key = (undertone, saturation, contrast)
    ambiguous_candidates = AMBIGUOUS_COMBINATIONS.get(param_key)
    
    if ambiguous_candidates:
        # Intersect with stage1 candidates
        stage2_candidates = [ct for ct in ambiguous_candidates if ct in stage1_candidates]
        print(f'[Match] STAGE 2: AMBIGUOUS params ({param_key}) → {ambiguous_candidates}')
        print(f'[Match] After stage1 filter: {stage2_candidates}')
        
        if not stage2_candidates:
            print(f'[Match] No intersection with stage1! Using stage1 candidates')
            stage2_candidates = stage1_candidates
    else:
        # Check COLORTYPE_MAP for matching colortypes
        matching_colortypes = []
        for (u, s, c), ct in COLORTYPE_MAP.items():
            if (u, s, c) == param_key and ct in stage1_candidates:
                matching_colortypes.append(ct)
        
        if matching_colortypes:
            stage2_candidates = matching_colortypes
            print(f'[Match] STAGE 2: Exact params match → {stage2_candidates}')
        else:
            # No exact match - score all stage1 candidates by parameter closeness
            print(f'[Match] STAGE 2: No exact match. Scoring all stage1 candidates')
            stage2_candidates = stage1_candidates
    
    # ============ STAGE 3: Final selection by color keyword matching ============
    print(f'[Match] STAGE 3: Scoring {len(stage2_candidates)} candidates by color matching + params')
    
    # Detect characteristic warm hair colors
    has_auburn_hair = any(keyword in hair_lower for keyword in ['auburn', 'copper', 'red', 'bright auburn', 'ginger'])
    is_warm_undertone = undertone == 'WARM-UNDERTONE'
    
    print(f'[Match] Auburn/red hair detected: {has_auburn_hair}, Warm undertone: {is_warm_undertone}')
    
    best_colortype = None
    best_total_score = 0.0
    best_param_score = 0.0
    best_color_score = 0.0
    
    for colortype in stage2_candidates:
        # Check if this colortype's params match exactly
        params_list = get_colortype_params(colortype)
        
        # Calculate parameter match score (undertone, saturation, contrast)
        param_match = 0.0
        undertone_match = 0.0
        saturation_match = 0.0
        contrast_match = 0.0
        
        if param_key in params_list:
            # Exact match
            undertone_match = 1.0
            saturation_match = 1.0
            contrast_match = 1.0
            param_match = 1.0
        else:
            # Find closest match
            for (u, s, c) in params_list:
                u_match = 1.0 if u == undertone else 0.0
                s_match = 1.0 if s == saturation else 0.0
                c_match = 1.0 if c == contrast else 0.0
                
                candidate_score = ((u_match * 1.0) + (s_match * 0.5) + (c_match * 0.5)) / 2.0
                
                if candidate_score > param_match:
                    param_match = candidate_score
                    undertone_match = u_match
                    saturation_match = s_match
                    contrast_match = c_match
        
        # Calculate color match score with DYNAMIC WEIGHTS based on undertone
        ref = COLORTYPE_REFERENCES[colortype]
        hair_score = calculate_color_match_score(hair, ref['hair'])
        skin_score = calculate_color_match_score(skin, ref['skin'])
        eyes_score = calculate_color_match_score(eyes, ref['eyes'])
        
        # UPDATED WEIGHTS: For WARM undertone, hair is MORE important
        if is_warm_undertone:
            # Warm types: hair 45%, skin 25%, eyes 30%
            hair_weight = 0.45
            skin_weight = 0.25
            eyes_weight = 0.30
        else:
            # Cool types: hair 32%, skin 32%, eyes 36% (original)
            hair_weight = 0.32
            skin_weight = 0.32
            eyes_weight = 0.36
        
        color_score = (hair_score * hair_weight) + (skin_score * skin_weight) + (eyes_score * eyes_weight)
        
        # BONUS: Auburn/copper/red hair → +0.15 for VIBRANT SPRING
        if has_auburn_hair and colortype == 'VIBRANT SPRING':
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for auburn hair (characteristic color)')
        
        # Total score: 2x parameters + 1x colors
        total_score = (param_match * 2.0) + (color_score * 1.0)
        
        print(f'[Match] {colortype}: param={param_match:.2f} (U:{undertone_match:.0f} S:{saturation_match:.0f} C:{contrast_match:.0f}), color={color_score:.2f} (h:{hair_score:.2f}*{hair_weight:.2f} s:{skin_score:.2f}*{skin_weight:.2f} e:{eyes_score:.2f}*{eyes_weight:.2f}), total={total_score:.2f}')
        
        if total_score > best_total_score:
            best_total_score = total_score
            best_colortype = colortype
            best_param_score = param_match
            best_color_score = color_score
    
    # FALLBACK: If no colortype found, use color-only scoring
    if best_colortype is None:
        print(f'[Match] FALLBACK: No candidates! Scoring all colortypes by color only...')
        
        for colortype in COLORTYPE_REFERENCES.keys():
            ref = COLORTYPE_REFERENCES[colortype]
            hair_score = calculate_color_match_score(hair, ref['hair'])
            skin_score = calculate_color_match_score(skin, ref['skin'])
            eyes_score = calculate_color_match_score(eyes, ref['eyes'])
            
            color_score = (hair_score * 0.32) + (skin_score * 0.32) + (eyes_score * 0.36)
            
            print(f'[Match] {colortype}: color={color_score:.2f} (h:{hair_score:.2f} s:{skin_score:.2f} e:{eyes_score:.2f})')
            
            if color_score > best_color_score:
                best_color_score = color_score
                best_colortype = colortype
                best_total_score = color_score
        
        if best_colortype:
            explanation = format_result(best_colortype, hair, skin, eyes, undertone, saturation, contrast, 'fallback2')
            print(f'[Match] FALLBACK SUCCESS: {best_colortype} with color_score {best_color_score:.2f}')
            return best_colortype, explanation
    
    explanation = format_result(best_colortype, hair, skin, eyes, undertone, saturation, contrast, 'standard')
    
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

def calculate_contrast(hair_lightness: str, skin_lightness: str, eyes_lightness: str) -> str:
    '''Calculate contrast level based on NEW 3-level lightness scale
    
    Uses weighted formula: Hair vs Skin (60%) + Eyes vs Skin (40%)
    
    NEW Lightness levels (0-2): 
    - LIGHT-*-COLORS = 0
    - MEDIUM-*-COLORS = 1
    - DEEP-*-COLORS = 2
    
    Returns: LOW-CONTRAST (sum=0), LOW-MEDIUM-CONTRAST (sum=1), 
             HIGH-MEDIUM-CONTRAST (sum=2), HIGH-CONTRAST (sum=3+)
    '''
    LIGHTNESS_TO_LEVEL = {
        'LIGHT-HAIR-COLORS': 0,
        'MEDIUM-HAIR-COLORS': 1,
        'DEEP-HAIR-COLORS': 2,
        'LIGHT-SKIN-COLORS': 0,
        'MEDIUM-SKIN-COLORS': 1,
        'DEEP-SKIN-COLORS': 2,
        'LIGHT-EYES-COLORS': 0,
        'MEDIUM-EYES-COLORS': 1,
        'DEEP-EYES-COLORS': 2
    }
    
    hair_level = LIGHTNESS_TO_LEVEL.get(hair_lightness, 1)
    skin_level = LIGHTNESS_TO_LEVEL.get(skin_lightness, 1)
    eyes_level = LIGHTNESS_TO_LEVEL.get(eyes_lightness, 1)
    
    # Calculate differences
    hair_skin_diff = abs(hair_level - skin_level)
    eyes_skin_diff = abs(eyes_level - skin_level)
    
    # Sum both differences (max = 4)
    total_diff = hair_skin_diff + eyes_skin_diff
    
    print(f'[Contrast] hair={hair_lightness}({hair_level}), skin={skin_lightness}({skin_level}), eyes={eyes_lightness}({eyes_level})')
    print(f'[Contrast] hair-skin={hair_skin_diff}, eyes-skin={eyes_skin_diff}, total={total_diff}')
    
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
                        
                        # Map user's eye color to lightness level (NEW 3-level system: LIGHT/MEDIUM/DEEP)
                        EYE_COLOR_TO_LIGHTNESS = {
                            'blue': 'LIGHT-EYES-COLORS',                    # Голубые
                            'blue-green': 'LIGHT-EYES-COLORS',              # Сине-зелёные
                            'green': 'LIGHT-EYES-COLORS',                   # Зелёные
                            'gray-blue': 'LIGHT-EYES-COLORS',               # Серо-голубые
                            'turquoise': 'LIGHT-EYES-COLORS',               # Бирюзовые
                            'jade': 'LIGHT-EYES-COLORS',                    # Нефритовые
                            'hazel': 'MEDIUM-EYES-COLORS',                  # Ореховые (золотистые)
                            'gray-green': 'MEDIUM-EYES-COLORS',             # Серо-зелёные
                            'gray': 'MEDIUM-EYES-COLORS',                   # Серые
                            'grey': 'MEDIUM-EYES-COLORS',                   # Серые (альт)
                            'light brown': 'MEDIUM-EYES-COLORS',            # Светло-карие
                            'brown': 'MEDIUM-EYES-COLORS',                  # Карие
                            'brown-green': 'MEDIUM-EYES-COLORS',            # Коричнево-зелёные
                            'golden brown': 'MEDIUM-EYES-COLORS',           # Золотисто-карие
                            'black-brown': 'DEEP-EYES-COLORS',              # Чёрно-карие
                            'chocolate': 'DEEP-EYES-COLORS'                 # Шоколадные
                        }
                        
                        eyes_lightness = EYE_COLOR_TO_LIGHTNESS.get(eye_color.lower(), 'MEDIUM-EYES-COLORS')
                        analysis['eyes_lightness'] = eyes_lightness
                        print(f'[ColorType-Worker] Mapped eye_color "{eye_color}" to eyes_lightness: {eyes_lightness}')
                        
                        # Calculate contrast based on hair_lightness, skin_lightness, eyes_lightness
                        contrast = calculate_contrast(
                            analysis.get('hair_lightness', 'MEDIUM-HAIR-COLORS'),
                            analysis.get('skin_lightness', 'MEDIUM-SKIN-COLORS'),
                            eyes_lightness
                        )
                        analysis['contrast'] = contrast
                        print(f'[ColorType-Worker] Calculated contrast: {contrast}')
                        
                        print(f'[ColorType-Worker] Parsed analysis: {analysis}')
                        
                        # Extract GPT suggestion
                        gpt_suggested_type = analysis.get('suggested_colortype', '').strip().upper()
                        print(f'[ColorType-Worker] GPT suggested colortype: {gpt_suggested_type}')
                        
                        # Calculate colortype via formula (primary method)
                        color_type, explanation = match_colortype(analysis)
                        result_text_value = explanation
                        
                        print(f'[ColorType-Worker] Formula calculated: {color_type}')
                        print(f'[ColorType-Worker] Explanation: {explanation}')
                        
                        # Compare GPT suggestion with formula result
                        if gpt_suggested_type and gpt_suggested_type == color_type:
                            print(f'[ColorType-Worker] ✅ GPT and Formula MATCH: {color_type}')
                            result_text_value += f'\n\n✅ ИИ-анализ и формула совпадают: {color_type}'
                        elif gpt_suggested_type:
                            print(f'[ColorType-Worker] ⚠️ MISMATCH: GPT={gpt_suggested_type}, Formula={color_type}')
                            colortype_ru_gpt = COLORTYPE_NAMES_RU.get(gpt_suggested_type, gpt_suggested_type)
                            result_text_value += f'\n\n⚠️ Расхождение: ИИ предположил {colortype_ru_gpt}, формула определила {COLORTYPE_NAMES_RU.get(color_type, color_type)}'
                        
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