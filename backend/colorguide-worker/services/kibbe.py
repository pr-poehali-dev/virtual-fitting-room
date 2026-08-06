"""Сервис 'Определение типажа по Кибби по фото'.

Конвейер: Gemini анализирует фото в полный рост -> русский JSON
с определением типажа Дэвида Кибби и рекомендациями ->
nano-banana-2 рисует 3 образа, раскрывающих типаж.
"""

LOGO_IMAGE_URL = None

USE_QWEN = False

# Три образа в полный рост
ASPECT_RATIO = '16:9'

GEMINI_PROMPT = '''Ты — эксперт по системе типажей Дэвида Кибби с 15-летним опытом. К тебе пришёл клиент за определением своего типажа по фото в полный рост. Работай как настоящий профессионал: сначала ВНИМАТЕЛЬНО изучи костяк, пропорции и черты, а потом определи типаж и выведи рекомендации.

КРИТИЧЕСКИ ВАЖНО про одежду на фото: НЕ ориентируйся на ту одежду, что СЕЙЧАС надета на человеке — это случайный наряд, а не показатель типажа. Одежда может искажать восприятие силуэта. Смотри СКВОЗЬ одежду на реальный костяк, ширину плеч, пропорции и линии тела.

СИСТЕМА КИББИ — определи типаж из 10 (используй САМУЮ НОВУЮ версию системы):
Dramatic, Soft Dramatic, Flamboyant Natural, Soft Natural, Dramatic Classic, Soft Classic, Flamboyant Gamine, Soft Gamine, Theatrical Romantic, Romantic.

ПОРЯДОК АНАЛИЗА (рассуждай как эксперт):
1) КОСТЯК: оцени ширину и форму плеч (узкие/средние/широкие, покатые/прямые/острые), выраженность ключиц, размер и форму кистей и стоп, ширину грудной клетки и бёдер, тонкость или массивность костей запястья, длину и форму шеи, линию челюсти.
2) ВЕРТИКАЛЬ: оцени рост и общее впечатление вертикали (вытянутая/сбалансированная/компактная), длину конечностей относительно корпуса, длину шеи.
3) ПЛОТЬ: оцени наличие и характер изгибов (грудь, талия, бёдра), мягкость или подтянутость мягких тканей, полноту рук и ног, форму лица (мягкое округлое или чёткое угловатое).
4) ЧЕРТЫ ЛИЦА: масштаб черт (мелкие/средние/крупные), угловатость или мягкость линий, форма глаз, губ, скул, носа.
5) ЯН И ИНЬ БАЛАНС: определи преобладание — ян (вертикаль, угловатость, ширина, острота) или инь (округлость, мягкость, изгибы, компактность), и в какой именно комбинации.

ПОДСКАЗКИ ПО РОСТУ (соблюдай строго):
- Рост 168 см и выше — только Dramatic, Soft Dramatic или Flamboyant Natural.
- Рост 167 см и ниже — НЕ может быть Dramatic, Soft Dramatic или Flamboyant Natural.
- Рост 166 см и выше — НЕ может быть Soft Gamine.
- У Натурала бёдра и талия без выраженного изгиба, сильнее всего выражены плечи.
Если уверенно определить типаж не получается — честно скажи об этом в поле confidence и дай рекомендации по индивидуальным линиям фигуры, а не по типажу.

Верни СТРОГО JSON по схеме. Все тексты — на русском языке, конкретно и обоснованно, без воды.

Требования к полям:
- kibbe_type: название типажа на русском и английском (например, "Мягкий натурал (Soft Natural)").
- confidence: 1-2 предложения — насколько уверенно определён типаж и почему; если есть сомнение между двумя типажами, честно назови оба.
- essence: 2-4 слова — суть образа этого типажа (например, "Мягкая природная естественность").
- bone_structure: 3-5 предложений — детальный разбор костяка по фото: плечи, ключицы, грудная клетка, бёдра, кисти и стопы, запястья, шея, челюсть.
- vertical_flesh: 3-5 предложений — разбор вертикали и плоти: рост и впечатление вертикали, длина конечностей, наличие и характер изгибов, мягкость тканей.
- facial_features: 2-4 предложения — масштаб и характер черт лица, как они поддерживают типаж.
- yin_yang: 2-3 предложения — баланс ян и инь у этого человека и как он формирует типаж.
- best_lines: массив из 4-6 объектов {name, reason}. name — выигрышная линия или силуэт (например, "Мягкие струящиеся вертикали", "Свободный неструктурированный крой"); reason — почему работает на этом типаже и этом теле.
- avoid_lines: массив из 3-5 объектов {name, reason}. name — линия или крой, который ломает типаж; reason — что именно происходит с образом.
- fabrics: массив из 3-5 объектов {name, reason}. name — подходящая ткань; reason — почему она поддерживает линии этого типажа.
- key_items: массив из 5-6 объектов {name, reason}. name — ключевая вещь гардероба для этого типажа; reason — почему она идёт. Предлагай СОВРЕМЕННЫЕ актуальные фасоны этого года.
- accessories: массив из 3-4 объектов {name, reason}. name — аксессуар или украшение (форма, масштаб, материал); reason — почему подходит масштабу и линиям.
- hair_makeup: 2-4 предложения — какие причёски и характер макияжа поддерживают этот типаж.
- celebrities: массив из 3-4 строк — известные женщины с таким же типажом по Кибби (для наглядности).
- tips: 5 коротких практических советов по одеванию этого типажа на русском (строки).
- kibbe_looks: массив РОВНО из 3 объектов {title, description}. Это 3 готовых образа, максимально раскрывающих типаж этого человека. title — короткое название на русском (например, "Повседневный природный", "Деловой мягкий", "Вечерний выход"). description — ДЕТАЛЬНОЕ описание образа в 2-3 предложения: что надето сверху и снизу, верхняя одежда, обувь, сумка, аксессуары и украшения, с конкретными фасонами, тканями и цветами. Образы должны перекрывать разные ситуации: повседневный, деловой или смарт-кэжуал, и обязательно один нарядный для особого случая.
  ОЧЕНЬ ВАЖНО ПРО АКТУАЛЬНОСТЬ: образы должны выглядеть как мода 2025-2026 года, НЕ как 2010-е. Актуальные силуэты и посадка (свободный, relaxed, прямой крой, высокая посадка), современная обувь (лоферы, балетки, низкий ход, актуальные босоножки), современные сумки. Избегай примет 2010-х: скинни-джинсы, короткие приталенные пиджаки, узкие лодочки на шпильке.
  ВАЖНО ПРО ЦВЕТ: в одном образе не более 3 цветов в пропорции 60-30-10, сочетающихся между собой и подходящих колориту человека с фото.

Опирайся на реальные данные человека с фото и на систему Кибби. Будь точным и честным.'''

_NAME_REASON = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'reason': {'type': 'string'},
    },
    'required': ['name', 'reason'],
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
        'kibbe_type': {'type': 'string'},
        'confidence': {'type': 'string'},
        'essence': {'type': 'string'},
        'bone_structure': {'type': 'string'},
        'vertical_flesh': {'type': 'string'},
        'facial_features': {'type': 'string'},
        'yin_yang': {'type': 'string'},
        'best_lines': {'type': 'array', 'items': _NAME_REASON, 'minItems': 4, 'maxItems': 6},
        'avoid_lines': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 5},
        'fabrics': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 5},
        'key_items': {'type': 'array', 'items': _NAME_REASON, 'minItems': 5, 'maxItems': 6},
        'accessories': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 4},
        'hair_makeup': {'type': 'string'},
        'celebrities': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 4},
        'tips': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 5},
        'kibbe_looks': {'type': 'array', 'items': _LOOK_ITEM, 'minItems': 3, 'maxItems': 3},
    },
    'required': [
        'kibbe_type', 'confidence', 'essence', 'bone_structure', 'vertical_flesh',
        'facial_features', 'yin_yang', 'best_lines', 'avoid_lines', 'fabrics',
        'key_items', 'accessories', 'hair_makeup', 'celebrities', 'tips', 'kibbe_looks'
    ],
    'additionalProperties': False
}

REQUIRED_FIELDS = [
    'kibbe_type', 'essence', 'bone_structure', 'vertical_flesh',
    'best_lines', 'key_items', 'tips', 'kibbe_looks'
]


def build_image_prompt(data: dict, height: int = None) -> str:
    """Промпт для nano-banana-2: ряд из 3 образов в полный рост под типаж."""
    height_line = f'The person height is about {height} cm. ' if height else ''
    kibbe_type = data.get('kibbe_type', '')

    looks = data.get('kibbe_looks') or []
    looks_block = ''
    for i, look in enumerate(looks[:3], start=1):
        if isinstance(look, dict):
            title = look.get('title', '')
            desc = look.get('description', '')
        else:
            title, desc = '', str(look)
        looks_block += f'OUTFIT {i} ("{title}"): {desc}\n\n'

    type_line = f'All three outfits follow the Kibbe body type "{kibbe_type}" — keep their lines, proportions and scale consistent with that type. ' if kibbe_type else ''

    prompt = f'''Create ONE wide photorealistic image: a single horizontal ROW of EXACTLY 3 cells side by side (1 row x 3 columns), showing THREE full-body fashion looks of the SAME real woman.

CRITICAL COMPOSITION: exactly 3 cells in ONE horizontal row, ONE outfit per cell, ONE single frontal full-body photo per cell. Do NOT make a grid, do NOT add a second row, do NOT show two angles or two photos of the same outfit in one cell — strictly 3 photos total, one per look. No gaps, no borders, no text.

PERSON — MOST IMPORTANT: take the woman STRICTLY from the provided photo and keep her EXACT real face, facial features, face shape, hair color and texture, skin tone and REAL BODY PROPORTIONS in all three cells. Her bone structure, shoulder width, waist, hips and overall body scale must match the uploaded photo exactly — do NOT slim her down, do NOT lengthen her legs, do NOT invent a different body. Do NOT invent a new face, do NOT change her ethnicity, age or hairstyle. It must clearly and recognizably be the SAME real person in every cell, photorealistic, not illustrated. You MAY only gently enhance her so she looks her best: fresh, rested, healthy and well-groomed (clear skin, tidy hair, light tasteful makeup) — but keep her identity and natural body 100% intact. {height_line}Each cell is a separate full-body studio fashion photo on a soft neutral light-grey seamless background, natural soft lighting, modern editorial lookbook style, the woman standing facing the camera, shown head to toe including shoes.

{type_line}Dress her in these THREE DIFFERENT complete outfits, one per cell, in order from left to right, exactly as described. Render every garment, shoes, bag, accessories and JEWELRY described, in realistic detail:

{looks_block}FASHION ERA — VERY IMPORTANT: style every outfit to look like CURRENT 2025-2026 fashion, NOT 2010s. Every garment, shoe, bag and accessory MUST look like it comes from the NEWEST current-season collections, but still REAL, WEARABLE everyday fashion (NOT extreme runway looks). Use contemporary silhouettes: relaxed or structured tailoring, soft natural shoulders, high-waisted wide or straight full-length trousers, longline jackets and coats, midi and maxi lengths, modern footwear (loafers, ballet flats, low-heel or block-heel shoes, contemporary sandals). AVOID dated 2010s markers: skinny jeans, very short tight blazers, thin stiletto pumps, overly fitted bodycon shapes.

COLOR RULE — IMPORTANT: each outfit must use NO MORE THAN 3 colors, balanced in a 60-30-10 proportion (one dominant color ~60%, a secondary ~30%, an accent ~10%), all harmonized and matching the person's coloring.

REQUIREMENTS: three DISTINCT outfits (do not repeat the same look), each shown head-to-toe once, contemporary 2025-2026 style, with lines and proportions that flatter this exact body type. Photorealistic fashion photography quality. Identical framing, lighting and background across all three cells. NO text, NO captions, NO labels, NO logos, NO watermarks anywhere on the image — only the three outfit photos in one horizontal row.'''

    return prompt
