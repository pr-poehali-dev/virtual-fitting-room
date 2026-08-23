"""Сервис 'Подбор очков по фото'.

Конвейер: Gemini анализирует портрет -> русский JSON с разбором формы лица
и рекомендациями оправ -> nano-banana-2 рисует 3 примера очков на лице клиента.
"""

LOGO_IMAGE_URL = None

# Стабильный валидный JSON по строгой схеме
USE_QWEN = False

# Три портрета в ряд
ASPECT_RATIO = '16:9'

GEMINI_PROMPT = '''Ты — профессиональный оптик-стилист с 15-летним опытом подбора оправ. К тебе пришёл клиент за индивидуальным подбором очков по фото. Работай как настоящий эксперт: сначала ВНИМАТЕЛЬНО изучи лицо человека, а потом выведи рекомендации, вытекающие из его реальных черт.

КРИТИЧЕСКИ ВАЖНО: если на фото человек уже в очках — НЕ ориентируйся на них. Это случайная оправа, а не показатель того, что ему идёт. Смотри на само лицо: его форму, пропорции, черты, колорит — и подбирай оправы под них.

ПОРЯДОК АНАЛИЗА (рассуждай как оптик-стилист):
1) ФОРМА ЛИЦА: определи форму лица (овальное, круглое, квадратное, прямоугольное, сердцевидное, ромбовидное, треугольное, грушевидное). Оцени ширину лба, скул и подбородка, длину лица, линию челюсти, форму подбородка. Обоснуй вывод тем, что реально видишь.
2) ЧЕРТЫ И ПРОПОРЦИИ: оцени размер и посадку глаз, расстояние между глазами (близко/средне/широко посаженные), форму и высоту бровей, длину и ширину носа, высоту переносицы, выраженность скул, общий масштаб черт (мелкие/средние/крупные).
3) КОЛОРИТ: подтон кожи (тёплый/холодный/нейтральный), цвет волос, цвет глаз, контрастность внешности. Из этого выводи цвета оправ.
4) ВЫВОДЫ: подбери формы оправ, которые уравновешивают лицо. Главный принцип — контраст и баланс: круглому лицу идут угловатые оправы, угловатому — смягчённые и округлые, длинному — широкие оправы, добавляющие горизонталь. Ширина оправы должна примерно совпадать с шириной лица в самой широкой части. Верхняя линия оправы не должна перекрывать брови и не должна их дублировать. Учитывай посадку глаз: широкая перемычка визуально сближает глаза, узкая — раздвигает.

Верни СТРОГО JSON по схеме. Все тексты — на русском языке, конкретно и обоснованно, без воды.

Требования к полям:
- face_shape: 1-3 слова — форма лица (например, "Овальное с мягкой челюстью").
- face_analysis: 3-5 предложений — детальный разбор формы лица, пропорций и черт по фото. Конкретно: ширина лба и скул, линия челюсти, длина лица, посадка и размер глаз, брови, нос.
- color_analysis: 2-3 предложения — подтон кожи, волосы, глаза, контрастность, и какие цвета оправ из этого следуют.
- best_shapes: массив из 3-5 объектов {name, reason}. name — форма оправы на русском (например, "Кошачий глаз", "Прямоугольная с мягкими углами", "Авиатор"); reason — почему эта форма идёт именно этому лицу (1-2 предложения с опорой на конкретные черты).
- avoid_shapes: массив из 2-4 объектов {name, reason}. name — неподходящая форма; reason — почему она не работает на этом лице.
- frame_colors: массив из 4-6 объектов {name, hex, reason}. name — цвет оправы на русском; hex — точный HEX-код (например "#4A3B2A"); reason — почему цвет идёт колориту (1 короткая фраза).
- materials: массив из 2-4 объектов {name, reason}. name — материал и тип оправы на русском (например, "Тонкий металл", "Ацетат средней плотности", "Безободковая"); reason — почему подходит этому лицу и образу жизни.
- sizing_tips: 4-5 коротких практических советов по посадке и размеру оправы на русском (строки): ширина оправы относительно лица, положение верхней линии относительно бровей, ширина перемычки, высота линзы, положение центра глаза в линзе.
- sunglasses_tip: 1-2 предложения — рекомендация именно по солнцезащитным очкам для этого лица (форма и оттенок линз).
- tips: 4-5 коротких практических советов по подбору и ношению очков на русском (строки).
- glasses_looks: массив РОВНО из 3 объектов {title, description}. Это 3 конкретных варианта очков для этого человека, основанных на твоих рекомендациях. title — короткое название на русском (например, "Классика на каждый день", "Мягкий кошачий глаз", "Лёгкая безободковая"). description — ДЕТАЛЬНОЕ описание очков на русском в 2-3 предложения: точная форма оправы, материал, толщина, цвет (конкретный, из рекомендованных), форма перемычки и дужек, тип линз. Три варианта должны заметно отличаться друг от друга по форме и характеру, но все — подходить этому лицу.

Опирайся на реальные черты человека с фото и профессиональный опыт. Будь точным и конкретным.'''

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
        'face_analysis': {'type': 'string'},
        'color_analysis': {'type': 'string'},
        'best_shapes': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 5},
        'avoid_shapes': {'type': 'array', 'items': _NAME_REASON, 'minItems': 2, 'maxItems': 4},
        'frame_colors': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 4, 'maxItems': 6},
        'materials': {'type': 'array', 'items': _NAME_REASON, 'minItems': 2, 'maxItems': 4},
        'sizing_tips': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 4, 'maxItems': 5},
        'sunglasses_tip': {'type': 'string'},
        'tips': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 4, 'maxItems': 5},
        'glasses_looks': {'type': 'array', 'items': _LOOK_ITEM, 'minItems': 3, 'maxItems': 3},
    },
    'required': [
        'face_shape', 'face_analysis', 'color_analysis', 'best_shapes', 'avoid_shapes',
        'frame_colors', 'materials', 'sizing_tips', 'sunglasses_tip', 'tips', 'glasses_looks'
    ],
    'additionalProperties': False
}

REQUIRED_FIELDS = [
    'face_shape', 'face_analysis', 'best_shapes', 'frame_colors', 'tips', 'glasses_looks'
]


def build_image_prompt(data: dict, height: int = None) -> str:
    """Промпт для nano-banana-2: ряд из 3 портретов в разных оправах."""
    looks = data.get('glasses_looks') or []
    looks_block = ''
    for i, look in enumerate(looks[:3], start=1):
        if isinstance(look, dict):
            title = look.get('title', '')
            desc = look.get('description', '')
        else:
            title, desc = '', str(look)
        looks_block += f'GLASSES {i} ("{title}"): {desc}\n\n'

    prompt = f'''Create ONE wide photorealistic image: a single horizontal ROW of EXACTLY 3 cells side by side (1 row x 3 columns), showing THREE head-and-shoulders portraits of the SAME real person wearing THREE DIFFERENT eyeglasses.

CRITICAL COMPOSITION: exactly 3 cells in ONE horizontal row, ONE pair of glasses per cell, ONE single frontal portrait per cell. Do NOT make a grid, do NOT add a second row, do NOT show two angles in one cell — strictly 3 portraits total. No gaps, no borders, no text.

PERSON — MOST IMPORTANT: take the person STRICTLY from the provided photo and keep their EXACT real face, facial features, face shape, eyes, nose, lips, eyebrows, hair color and texture, skin tone in all three cells. Use their real appearance from the uploaded photo as the single source of truth — do NOT invent a new face, do NOT change ethnicity, facial features, hairstyle or face proportions. It must clearly and recognizably be the SAME real person in every cell, photorealistic, not illustrated. Show them at their very best: YOUNGER and FRESHER than in the photo, rested and radiant, smooth glowing firm skin, bright open eyes, healthy glow, well-groomed, tidy hair, light tasteful makeup — a flattering beauty-editorial rendering of the same person, with their identity and natural features 100% intact.

FRAMING: each cell is a clean head-and-shoulders studio portrait on a soft neutral light-grey seamless background, natural soft lighting, sharp focus on the face and glasses, the person facing the camera directly. The glasses must be clearly visible and in focus, correctly positioned on the nose, with realistic transparent lenses (no heavy reflections that hide the eyes — the eyes must be clearly visible through the lenses).

Put these THREE DIFFERENT pairs of eyeglasses on the person, one per cell, in order from left to right, exactly as described. Render frame shape, thickness, material, color, bridge and temples in realistic detail:

{looks_block}REQUIREMENTS: three DISTINCT pairs of glasses (clearly different shapes, do not repeat), each shown once, modern current-year eyewear design, correctly sized and proportioned to this person's face. Photorealistic portrait photography quality. Identical framing, lighting and expression across all three cells so they can be compared. NO text, NO captions, NO labels, NO logos, NO watermarks anywhere on the image — only the three portraits in one horizontal row.'''

    return prompt