"""Сервис 'Подбор макияжа по фото'.

Конвейер: Gemini анализирует портрет как профессиональный визажист ->
русский JSON с разбором кожи, колорита, черт и подбором конкретных средств ->
nano-banana-2 рисует 2 образа: дневной и вечерний макияж.
"""

LOGO_IMAGE_URL = None

USE_QWEN = False

# Два портрета в ряд
ASPECT_RATIO = '3:2'

GEMINI_PROMPT = '''Ты — топовый визажист-имиджмейкер с 20-летним опытом работы на съёмках и с частными клиентами. Ты одинаково хорошо разбираешься в колористике, в текстурах косметики и в возрастных особенностях кожи. К тебе пришёл клиент за индивидуальным разбором макияжа по фото. Работай как настоящий профессионал: сначала ВНИМАТЕЛЬНО изучи кожу и черты лица, а потом подбирай средства, вытекающие из реального состояния кожи.

КРИТИЧЕСКИ ВАЖНО про макияж на фото: НЕ ориентируйся на тот макияж, что СЕЙЧАС на человеке. Это случайный вариант, а НЕ показатель того, что ему идёт. Если человек накрашен ярко — это не значит, что нужны яркие схемы; если без макияжа — это не значит, что нужен только нюд. Смотри на само лицо: кожу, колорит, черты — и из этого выводи рекомендации.

САМОЕ ГЛАВНОЕ — ПОДБОР ТЕКСТУР И СРЕДСТВ ПОД КОЖУ. Это ядро твоей работы, отнесись к нему максимально внимательно:
- Определи ТИП КОЖИ по фото: сухая, нормальная, комбинированная, жирная. Смотри на блеск в Т-зоне, видимые поры, шелушения, матовость щёк.
- Определи СОСТОЯНИЕ и ВОЗРАСТНЫЕ особенности: тонкость кожи, плотность, тургор, наличие и глубина мимических морщин (лоб, межбровье, носогубные, «гусиные лапки»), заломы, обезвоженность, потеря чёткости овала, купероз, покраснения, пигментация, круги и мешки под глазами, текстура и рельеф.
- ИЗ ЭТОГО выведи, какие текстуры МОЖНО, а какие КАТЕГОРИЧЕСКИ НЕЛЬЗЯ. Это разное для разных людей, и ошибка здесь портит весь макияж:
  * Плотные, матовые, стойкие тональные средства и сухие пудровые текстуры на тонкой, сухой, обезвоженной или возрастной коже — ЗАБИВАЮТСЯ в морщины и заломы, подчёркивают рельеф и сухость, визуально добавляют возраст. Такой коже нужны лёгкие увлажняющие флюиды, тональные сыворотки, ВВ/СС-средства, кремовые и сатиновые текстуры, кремовые румяна и тени, минимум сухой пудры (только точечно в Т-зону).
  * Плотное покрытие уместно и оправдано на плотной, жирной, пористой коже, при выраженных высыпаниях, куперозе или пигментации, где нужна перекрывающая способность и стойкость. Там же работают матирующие основы и пудровые текстуры.
  * Учитывай и обратное: слишком лёгкие сияющие средства на жирной коже поплывут и подчеркнут поры.
  * Отдельно про зону под глазами: если кожа тонкая и есть сеточка морщин — плотный сухой консилер и обильная пудра дадут заломы; нужен лёгкий увлажняющий консилер и минимальная фиксация.
  * Отдельно про сияние: хайлайтер с крупным шиммером на пористой или рельефной коже подчеркнёт неровности; там нужен деликатный сатиновый финиш.
Формулируй эти выводы КОНКРЕТНО ПОД ЭТОГО ЧЕЛОВЕКА, с объяснением «почему именно вам это подойдёт / не подойдёт», а не общими правилами.

ОСТАЛЬНОЙ ПОРЯДОК АНАЛИЗА:
1) КОЛОРИТ: подтон кожи (тёплый/холодный/нейтральный/оливковый), глубина тона, цвет и тон волос, цвет и рисунок радужки глаз, контрастность внешности (высокая/средняя/низкая). Из этого выводи палитру теней, румян и помад.
2) ЧЕРТЫ ЛИЦА: форма лица, пропорции, форма и посадка глаз (миндалевидные/круглые, глубоко посаженные, с нависшим веком, опущенные внешние уголки), высота и подвижность века, форма и густота бровей, форма губ и их объём, скулы, нос, овал. Из этого выводи технику: где растушёвывать, куда ставить акцент, как корректировать.
3) ВЫВОДЫ: собери схему макияжа. Каждая рекомендация ДОЛЖНА вытекать из кожи/колорита/черт, а не быть общим списком.

Верни СТРОГО JSON по схеме. Все тексты — на русском языке, конкретно и обоснованно, без воды и общих фраз.

Требования к полям:
- skin_type: 2-5 слов — тип и состояние кожи (например, "Сухая, тонкая, обезвоженная").
- skin_analysis: 4-6 предложений — ДЕТАЛЬНЫЙ разбор кожи по фото: тип, плотность, тургор, рельеф и текстура, поры, морщины и заломы (где именно), сухость или жирность, покраснения, пигментация, зона под глазами. Пиши конкретно по тому, что видишь на фото.
- color_analysis: 3-4 предложения — подтон кожи, глубина тона, волосы, глаза, контрастность, и какая палитра из этого следует.
- features_analysis: 3-5 предложений — форма лица, форма и посадка глаз, веко, брови, губы, скулы. Что стоит подчеркнуть, что скорректировать.
- textures_yes: массив из 4-6 объектов {name, reason}. name — текстура или тип средства, который ПОДХОДИТ (например, "Увлажняющий тональный флюид лёгкого покрытия", "Кремовые румяна"); reason — почему подходит ИМЕННО этой коже (1-2 предложения, с опорой на тип и состояние кожи).
- textures_no: массив из 3-5 объектов {name, reason}. name — текстура или средство, которого стоит ИЗБЕГАТЬ (например, "Плотный матовый тональный крем", "Рассыпчатая пудра под глаза"); reason — что конкретно произойдёт на этой коже (забьётся в морщины, подчеркнёт сухость, поплывёт, добавит возраста и т.п.).
- base_routine: массив из 4-6 объектов {name, reason}. name — шаг подготовки и базы (уход перед макияжем, праймер, тон, консилер, фиксация); reason — какое средство и текстуру брать и почему именно для этой кожи.
- palette_eyes: массив из 4-6 объектов {name, hex, reason}. name — оттенок теней на русском; hex — точный HEX-код; reason — почему идёт этому колориту и цвету глаз.
- palette_lips: массив из 4-6 объектов {name, hex, reason}. name — оттенок помады на русском; hex — HEX-код; reason — почему подходит.
- palette_blush: массив из 2-4 объектов {name, hex, reason}. name — оттенок румян; hex — HEX-код; reason — почему подходит подтону и типу кожи.
- palette_avoid: массив из 3-5 объектов {name, hex, reason}. name — оттенок, которого избегать; hex — HEX-код; reason — почему не идёт.
- brows: 2-3 предложения — форма, плотность и оттенок бровей для этого лица, чем красить (текстура средства) и почему.
- techniques: массив из 4-6 объектов {name, reason}. name — техника или приём (например, "Растушёвка в складку для нависшего века", "Драпировка румянами вверх к вискам"); reason — зачем именно этому лицу.
- tips: 5 коротких практических советов визажиста для этого человека на русском (строки). Пиши прикладные вещи: как наносить, чем растушёвывать, чего избегать, как продлить стойкость с учётом типа кожи.
- makeup_looks: массив РОВНО из 2 объектов {title, description}. Это 2 готовых макияжа: ПЕРВЫЙ — повседневный дневной, ВТОРОЙ — вечерний нарядный. title — короткое название на русском (например, "Дневной свежий", "Вечерний с акцентом на глаза"). description — ДЕТАЛЬНОЕ описание в 3-4 предложения: какая база и покрытие, тон и консилер, оформление бровей, конкретные оттенки и расположение теней, стрелка или её отсутствие, тушь, румяна и их расположение, скульптурирование, хайлайтер и его финиш, оттенок и текстура губ. Указывай КОНКРЕТНЫЕ оттенки из рекомендованной палитры и КОНКРЕТНЫЕ текстуры, подходящие этой коже. Дневной — лёгкий, свежий, естественный, «кожа как кожа». Вечерний — выразительный и праздничный, но БЕЗ перегруза текстурами, которые этой коже противопоказаны.

Опирайся на реальное состояние кожи и черты человека с фото и на профессиональный опыт. Будь точным, честным и конкретным.'''

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
        'skin_type': {'type': 'string'},
        'skin_analysis': {'type': 'string'},
        'color_analysis': {'type': 'string'},
        'features_analysis': {'type': 'string'},
        'textures_yes': {'type': 'array', 'items': _NAME_REASON, 'minItems': 4, 'maxItems': 6},
        'textures_no': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 5},
        'base_routine': {'type': 'array', 'items': _NAME_REASON, 'minItems': 4, 'maxItems': 6},
        'palette_eyes': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 4, 'maxItems': 6},
        'palette_lips': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 4, 'maxItems': 6},
        'palette_blush': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 2, 'maxItems': 4},
        'palette_avoid': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 3, 'maxItems': 5},
        'brows': {'type': 'string'},
        'techniques': {'type': 'array', 'items': _NAME_REASON, 'minItems': 4, 'maxItems': 6},
        'tips': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 5},
        'makeup_looks': {'type': 'array', 'items': _LOOK_ITEM, 'minItems': 2, 'maxItems': 2},
    },
    'required': [
        'skin_type', 'skin_analysis', 'color_analysis', 'features_analysis',
        'textures_yes', 'textures_no', 'base_routine', 'palette_eyes', 'palette_lips',
        'palette_blush', 'palette_avoid', 'brows', 'techniques', 'tips', 'makeup_looks'
    ],
    'additionalProperties': False
}

REQUIRED_FIELDS = [
    'skin_type', 'skin_analysis', 'textures_yes', 'textures_no',
    'palette_eyes', 'palette_lips', 'tips', 'makeup_looks'
]


def build_image_prompt(data: dict, height: int = None) -> str:
    """Промпт для nano-banana-2: 2 портрета — дневной и вечерний макияж."""
    looks = data.get('makeup_looks') or []
    looks_block = ''
    for i, look in enumerate(looks[:2], start=1):
        if isinstance(look, dict):
            title = look.get('title', '')
            desc = look.get('description', '')
        else:
            title, desc = '', str(look)
        label = 'DAYTIME EVERYDAY MAKEUP' if i == 1 else 'EVENING GLAMOROUS MAKEUP'
        looks_block += f'CELL {i} — {label} ("{title}"): {desc}\n\n'

    prompt = f'''Create ONE photorealistic image: a single horizontal ROW of EXACTLY 2 cells side by side (1 row x 2 columns), showing TWO beauty portraits of the SAME real person with TWO DIFFERENT makeup looks.

CRITICAL COMPOSITION: exactly 2 cells in ONE horizontal row, ONE makeup look per cell, ONE single frontal close-up portrait per cell. Do NOT make a grid, do NOT add a second row, do NOT show two angles in one cell — strictly 2 portraits total. No gaps, no borders, no text.

PERSON — MOST IMPORTANT: take the person STRICTLY from the provided photo and keep their EXACT real face, facial features, face shape, eye shape and color, nose, lips shape, eyebrow shape, hair color and texture, skin tone and natural age in BOTH cells. Use their real appearance from the uploaded photo as the single source of truth — do NOT invent a new face, do NOT change ethnicity, do NOT make them look younger or older, do NOT reshape their features. It must clearly and recognizably be the SAME real person in both cells, photorealistic, not illustrated.

SKIN REALISM — VERY IMPORTANT: keep the skin looking like REAL human skin with its natural texture. Do NOT airbrush the face into plastic smoothness, do NOT erase natural skin texture, pores or fine lines. The makeup should look like real, professionally applied cosmetics on real skin — flattering and beautiful, but believable and wearable, not a digital filter.

FRAMING: each cell is a clean beauty close-up portrait (head and shoulders) on a soft neutral light-grey seamless background, soft natural studio lighting, sharp focus on the face, the person facing the camera directly with a calm neutral expression. Hair styled simply and identically in both cells so the makeup is the focus. Identical framing, angle, lighting and expression in both cells so the two looks can be compared side by side.

Apply these TWO DIFFERENT makeup looks, one per cell, in order from left to right, exactly as described. Render base finish, eye shadow placement and colors, liner, lashes, brows, blush placement, contour, highlighter finish and lip color and texture in realistic detail:

{looks_block}REQUIREMENTS: two clearly DISTINCT makeup looks — the left one soft, fresh and natural for daytime, the right one more expressive and glamorous for evening. Both must look professionally applied and flattering to this exact person. Makeup textures must sit beautifully on this person's real skin without caking or emphasizing texture. Photorealistic beauty photography quality. NO text, NO captions, NO labels, NO logos, NO color swatches, NO watermarks anywhere on the image — only the two portraits in one horizontal row.'''

    return prompt
