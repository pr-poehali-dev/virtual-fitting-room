"""Сервис 'Подбор причёсок по фото'.

Конвейер: Gemini анализирует портрет как стилист-парикмахер ->
русский JSON с разбором формы лица, типа волос и рекомендациями ->
nano-banana-2 рисует 3 примера причёсок на клиенте.
"""

LOGO_IMAGE_URL = None

USE_QWEN = False

# Три портрета в ряд
ASPECT_RATIO = '16:9'

GEMINI_PROMPT = '''Ты — топовый стилист-парикмахер и колорист с 20-летним опытом. К тебе пришёл клиент за индивидуальным подбором причёски по фото. Работай как настоящий профессионал: сначала ВНИМАТЕЛЬНО изучи форму лица, тип и состояние волос, а потом выведи рекомендации, вытекающие из реальных данных.

КРИТИЧЕСКИ ВАЖНО: НЕ ориентируйся на ту причёску и укладку, что СЕЙЧАС на человеке. Это случайное состояние волос на момент съёмки, а НЕ показатель того, что ему идёт. Если волосы собраны — это не значит, что нужны только собранные причёски; если сейчас длинные — это не значит, что длина оптимальна. Смотри на само лицо и природные данные волос, и предлагай НОВЫЕ варианты.

ПОРЯДОК АНАЛИЗА (рассуждай как парикмахер):
1) ФОРМА ЛИЦА И ЧЕРЕП: определи форму лица (овальное, круглое, квадратное, прямоугольное, сердцевидное, ромбовидное, треугольное). Оцени ширину лба, скул и челюсти, длину лица, линию роста волос, высоту лба, форму подбородка, посадку и длину шеи, форму затылка. Обоснуй по тому, что видишь.
2) ВОЛОСЫ: определи тип и структуру (прямые, волнистые, кудрявые, курчавые), плотность и густоту (тонкие/средние/плотные), объём у корней, пористость и состояние (блеск, сухость, пушистость, секущиеся концы), природный цвет и тон, наличие седины.
3) КОЛОРИТ: подтон кожи, цвет глаз, контрастность внешности — из этого выводи подходящие оттенки окрашивания.
4) ВЫВОДЫ: подбери длину, форму стрижки, слои, чёлку и укладки, которые уравновешивают лицо и работают с реальной структурой волос. Главные принципы: стрижка должна балансировать пропорции лица; форма должна поддерживаться реальной плотностью и структурой волос (нельзя рекомендовать причёску, которая требует густоты, если волосы тонкие); укладка должна быть выполнимой в домашних условиях.

Верни СТРОГО JSON по схеме. Все тексты — на русском языке, конкретно и обоснованно, без воды.

Требования к полям:
- face_shape: 1-3 слова — форма лица.
- hair_type: 2-5 слов — тип и состояние волос (например, "Тонкие волнистые, средней густоты").
- face_analysis: 3-5 предложений — детальный разбор формы лица и пропорций по фото: лоб, скулы, челюсть, длина лица, линия роста волос, шея. Что нужно уравновесить.
- hair_analysis: 3-5 предложений — детальный разбор волос: структура, густота, объём, состояние, природный цвет, что с ними реально возможно, а что нет.
- best_cuts: массив из 3-5 объектов {name, reason}. name — стрижка или форма на русском (например, "Каскад до плеч с мягкими слоями", "Удлинённый боб"); reason — почему идёт этому лицу и этим волосам (1-2 предложения).
- avoid_cuts: массив из 2-4 объектов {name, reason}. name — неподходящая стрижка; reason — что она сделает с этим лицом или этими волосами.
- bangs: 2-4 предложения — подходит ли этому человеку чёлка, какая именно (форма, длина, плотность) и почему; если не подходит — честно объясни почему.
- length_advice: 2-3 предложения — оптимальная длина волос для этого лица и структуры, и где именно должен заканчиваться срез.
- hair_colors: массив из 4-6 объектов {name, hex, reason}. name — оттенок окрашивания на русском; hex — точный HEX-код; reason — почему идёт колориту (1 короткая фраза).
- colors_avoid: массив из 2-4 объектов {name, hex, reason}. name — оттенок, которого избегать; hex — HEX-код; reason — почему не идёт.
- coloring_techniques: массив из 2-4 объектов {name, reason}. name — техника окрашивания (например, "Air touch", "Мягкое балаяж-растяжение"); reason — почему подходит этим волосам и колориту.
- styling_tips: массив из 4-6 объектов {name, reason}. name — приём укладки (например, "Прикорневой объём брашингом", "Сушка диффузором для волны"); reason — зачем именно этим волосам.
- care: массив из 4-5 объектов {name, reason}. name — шаг ухода или тип средства; reason — почему нужен этому типу и состоянию волос.
- tips: 4-5 коротких практических советов на русском (строки).
- hair_looks: массив РОВНО из 3 объектов {title, description}. Это 3 конкретные причёски для этого человека. title — короткое название на русском (например, "Мягкий каскад с объёмом", "Собранный низкий пучок"). description — ДЕТАЛЬНОЕ описание в 2-3 предложения: точная форма и длина стрижки, слои, наличие и форма чёлки, характер укладки (прямые/волны/локоны/собранные), объём и его расположение, пробор, цвет и техника окрашивания. Три варианта должны заметно отличаться друг от друга (например, распущенные, собранные, другая длина или форма), но все — подходить этому лицу и реально выполнимы на этих волосах.

Опирайся на реальные данные человека с фото и профессиональный опыт. Будь точным и честным.'''

_NAME_REASON = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'reason': {'type': 'string'},
    },
    'required': ['name', 'reason'],
    'additionalProperties': False,
}
_COLOR_ITEM = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'hex': {'type': 'string'},
        'reason': {'type': 'string'},
    },
    'required': ['name', 'hex', 'reason'],
    'additionalProperties': False,
}
_LOOK_ITEM = {
    'type': 'object',
    'properties': {
        'title': {'type': 'string'},
        'description': {'type': 'string'},
    },
    'required': ['title', 'description'],
    'additionalProperties': False,
}

RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'face_shape': {'type': 'string'},
        'hair_type': {'type': 'string'},
        'face_analysis': {'type': 'string'},
        'hair_analysis': {'type': 'string'},
        'best_cuts': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 5},
        'avoid_cuts': {'type': 'array', 'items': _NAME_REASON, 'minItems': 2, 'maxItems': 4},
        'bangs': {'type': 'string'},
        'length_advice': {'type': 'string'},
        'hair_colors': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 4, 'maxItems': 6},
        'colors_avoid': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 2, 'maxItems': 4},
        'coloring_techniques': {'type': 'array', 'items': _NAME_REASON, 'minItems': 2, 'maxItems': 4},
        'styling_tips': {'type': 'array', 'items': _NAME_REASON, 'minItems': 4, 'maxItems': 6},
        'care': {'type': 'array', 'items': _NAME_REASON, 'minItems': 4, 'maxItems': 5},
        'tips': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 4, 'maxItems': 5},
        'hair_looks': {'type': 'array', 'items': _LOOK_ITEM, 'minItems': 3, 'maxItems': 3},
    },
    'required': [
        'face_shape', 'hair_type', 'face_analysis', 'hair_analysis', 'best_cuts', 'avoid_cuts',
        'bangs', 'length_advice', 'hair_colors', 'colors_avoid', 'coloring_techniques',
        'styling_tips', 'care', 'tips', 'hair_looks'
    ],
    'additionalProperties': False
}

REQUIRED_FIELDS = [
    'face_shape', 'hair_type', 'face_analysis', 'hair_analysis',
    'best_cuts', 'hair_colors', 'tips', 'hair_looks'
]


def build_image_prompt(data: dict, height: int = None) -> str:
    """Промпт для nano-banana-2: ряд из 3 портретов с разными причёсками."""
    looks = data.get('hair_looks') or []
    looks_block = ''
    for i, look in enumerate(looks[:3], start=1):
        if isinstance(look, dict):
            title = look.get('title', '')
            desc = look.get('description', '')
        else:
            title, desc = '', str(look)
        looks_block += f'HAIRSTYLE {i} ("{title}"): {desc}\n\n'

    prompt = f'''Create ONE wide photorealistic image: a single horizontal ROW of EXACTLY 3 cells side by side (1 row x 3 columns), showing THREE portraits of the SAME real person with THREE DIFFERENT hairstyles.

CRITICAL COMPOSITION: exactly 3 cells in ONE horizontal row, ONE hairstyle per cell, ONE single frontal portrait per cell. Do NOT make a grid, do NOT add a second row, do NOT show two angles in one cell — strictly 3 portraits total. No gaps, no borders, no text.

PERSON — MOST IMPORTANT: take the person STRICTLY from the provided photo and keep their EXACT real face, facial features, face shape, eyes, nose, lips, eyebrows and skin tone in all three cells. Use their real appearance from the uploaded photo as the single source of truth — do NOT invent a new face, do NOT change ethnicity, do NOT reshape their features. It must clearly and recognizably be the SAME real person in every cell, photorealistic, not illustrated. Show them at their very best: YOUNGER and FRESHER than in the photo, rested and radiant, smooth glowing firm skin, bright open eyes, healthy glow, well-groomed, light tasteful makeup — a flattering beauty-editorial rendering of the same person, with their identity 100% intact. ONLY the HAIR changes between cells.

FRAMING: each cell is a clean head-and-shoulders studio portrait on a soft neutral light-grey seamless background, soft natural lighting, sharp focus, the person facing the camera directly. The hairstyle must be fully visible including its shape, length and volume — do not crop the top of the hair. Identical framing, angle, lighting and expression across all three cells so the hairstyles can be compared.

Give the person these THREE DIFFERENT hairstyles, one per cell, in order from left to right, exactly as described. Render the cut shape, length, layers, fringe, texture, volume, parting and hair color in realistic detail:

{looks_block}HAIR REALISM — VERY IMPORTANT: the hair must look like REAL human hair with natural texture, movement, individual strands and realistic shine — not a smooth plastic wig. The styling must look achievable in real life on this person's natural hair type and density.

REQUIREMENTS: three clearly DISTINCT hairstyles (different in shape, length or styling — do not repeat), each shown once, modern current-year hairdressing, flattering to this person's face shape. Photorealistic portrait photography quality. NO text, NO captions, NO labels, NO logos, NO watermarks anywhere on the image — only the three portraits in one horizontal row.'''

    return prompt