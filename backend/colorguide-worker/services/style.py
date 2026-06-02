"""Сервис 'Стилевой анализ одежды' для картиночной инфографики.

Конвейер: Gemini анализирует фото -> компактный русский JSON ->
данные подставляются в промпт для nano-banana-2 -> одна картинка-инфографика.
"""

# Картинка-образец инфографики (референс лайаута) — пока не используем,
# чтобы модель не копировала чужие фото с шаблона. Можем вернуть позже.
# TEMPLATE_IMAGE_URL = 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/627be02b-4c57-49f8-9df7-337fb254d238.png'

# Логотип больше не нужен: картинка теперь — чистая сетка 2x2 из образов без шапки.
LOGO_IMAGE_URL = None

# Соотношение сторон итоговой картинки (квадрат под сетку 2x2 образов)
ASPECT_RATIO = '1:1'

# Промпт для Gemini: глубокий профессиональный анализ стиля. Все тексты на русском.
GEMINI_PROMPT = '''Ты — топовый персональный стилист-имиджмейкер с 15-летним опытом. К тебе пришёл клиент за индивидуальным стилевым разбором. Работай как настоящий профессионал: сначала ВНИМАТЕЛЬНО изучи самого человека на фото, а потом выстрой рекомендации, вытекающие из его природных данных.

КРИТИЧЕСКИ ВАЖНО про одежду на фото: НЕ ориентируйся на ту одежду, цвета, фасоны и ткани, что СЕЙЧАС надеты на человеке. Это случайный наряд для фотосессии, а НЕ показатель того, что ему идёт. Пример: человек снят в льняном платье — это не значит, что ему нужно рекомендовать лён; возможно, по фигуре и колориту ему гораздо больше идут струящиеся ткани, трикотаж или плотные структурные материалы. Анализируй САМОГО ЧЕЛОВЕКА: его лицо, колорит, фигуру, пропорции, энергетику — и только из этого выводи рекомендации. Предлагай НОВЫЕ варианты, а не повтор текущего лука.

ПОРЯДОК АНАЛИЗА (рассуждай как стилист):
1) ВНЕШНОСТЬ И КОЛОРИТ: определи подтон кожи (тёплый/холодный/нейтральный), цвет и тон волос, цвет глаз, общую контрастность внешности (высокая/средняя/низкая), яркость и глубину. Опиши это конкретно по тому, что видишь.
2) ФИГУРА И ПРОПОРЦИИ: оцени тип фигуры, длину и баланс пропорций, что стоит подчеркнуть, а что — уравновесить.
3) ВАЙБ: какую энергетику и характер транслирует человек — это влияет на выбор стилей.
4) ВЫВОДЫ: на основе пунктов 1–3 подбери стили, силуэты, ткани, вещи, аксессуары и цветовую палитру. Каждая рекомендация ДОЛЖНА вытекать из внешности/фигуры/вайба, а не быть общим списком. Объясняй "почему именно этому человеку это идёт".

Верни СТРОГО JSON по схеме. Все тексты — на русском языке, конкретно и обоснованно (без воды и общих фраз).

Требования к полям:
- identity: 2-4 слова, итоговая стилевая идентичность (например, "Мягкий гламур и элегантность").
- color_analysis: 2-4 предложения — разбор природного колорита (подтон кожи, волосы, глаза, контрастность) с конкретикой по фото.
- body_analysis: 2-4 предложения — тип фигуры, пропорции, что подчёркивать и что балансировать.
- vibe: 5-7 прилагательных-характеристик вайба (например, "Уверенная", "Женственная").
- best_styles: массив из 3-5 объектов {name, reason}. name — название стиля; reason — почему он подходит этой внешности/фигуре/вайбу (1 предложение).
- avoid_styles: 2-3 названия менее подходящих стилей (строки).
- silhouettes: массив из 3-4 объектов {name, reason}. name — выигрышный силуэт; reason — почему он работает на этой фигуре. Силуэты должны быть СОВРЕМЕННЫМИ и актуальными в этом году. Подбирай крой именно под фигуру: если фигуре выгоднее широкий/прямой/oversize крой — рекомендуй его, а не узкий по умолчанию.
- key_items: массив из 5-6 объектов {name, reason}. name — ключевая вещь гардероба; reason — почему она идёт (фигура/колорит/вайб). ВАЖНО: предлагай только СОВРЕМЕННЫЕ, актуальные в этом году фасоны (по текущим модным тенденциям), без устаревших кроёв прошлых десятилетий. Фасон каждой вещи подбирай под тип фигуры человека (например, ширину и посадку брюк — широкие/прямые/зауженные — выбирай по тому, что реально выгоднее этой фигуре, а не ставь узкие "по инерции"). Учитывай подходящие ткани, не копируй ткани с фото.
- accessories: 3 подходящих аксессуара на русском (строки).
- palette_best: массив из 6 объектов {name, hex, reason}. name — название цвета; hex — точный HEX-код (например "#7C6A4E"); reason — почему этот цвет идёт колориту (1 короткая фраза).
- palette_avoid: массив из 6 объектов {name, hex, reason}. name — цвет, которого избегать; hex — HEX-код; reason — почему не идёт.
- tips: 5 коротких практических советов стилиста на русском (строки).
- looks: массив РОВНО из 4 объектов {title, description}. Это 4 готовых полноценных образа для этого человека, основанных на твоих рекомендациях (стили, силуэты, ключевые вещи, палитра). title — короткое название образа на русском (например, "Деловой кэжуал", "Романтический вечер"). description — ДЕТАЛЬНОЕ описание образа на русском в 2-3 предложения: что именно надето сверху и снизу (с конкретными фасонами и цветами из рекомендованной палитры), верхняя одежда, обувь, сумка, аксессуары и украшения. Образы должны быть СОВРЕМЕННЫМИ (актуальная мода этого года), РАЗНЫМИ между собой и подобранными под фигуру человека. Описывай так, чтобы по тексту можно было точно нарисовать образ на человеке.

Опирайся на реальные природные данные человека и профессиональный опыт. Будь точным и конкретным.'''

# JSON-схема ответа Gemini (strict)
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
        'identity': {'type': 'string'},
        'color_analysis': {'type': 'string'},
        'body_analysis': {'type': 'string'},
        'vibe': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 7},
        'best_styles': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 5},
        'avoid_styles': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 2, 'maxItems': 3},
        'palette_best': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 6, 'maxItems': 6},
        'palette_avoid': {'type': 'array', 'items': _COLOR_ITEM, 'minItems': 6, 'maxItems': 6},
        'silhouettes': {'type': 'array', 'items': _NAME_REASON, 'minItems': 3, 'maxItems': 4},
        'key_items': {'type': 'array', 'items': _NAME_REASON, 'minItems': 5, 'maxItems': 6},
        'accessories': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 3},
        'tips': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 5},
        'looks': {'type': 'array', 'items': _LOOK_ITEM, 'minItems': 4, 'maxItems': 4},
    },
    'required': [
        'identity', 'color_analysis', 'body_analysis', 'vibe', 'best_styles', 'avoid_styles',
        'palette_best', 'palette_avoid', 'silhouettes', 'key_items', 'accessories', 'tips', 'looks'
    ],
    'additionalProperties': False
}

# Обязательные поля результата (для валидации полноты ответа)
REQUIRED_FIELDS = [
    'identity', 'vibe', 'best_styles', 'palette_best', 'silhouettes',
    'key_items', 'accessories', 'tips', 'looks'
]


def _names(items):
    """Достать названия из списка строк или списка объектов {name, ...}."""
    out = []
    for it in items or []:
        if isinstance(it, dict):
            name = it.get('name', '')
            if name:
                out.append(str(name))
        elif it:
            out.append(str(it))
    return out


def build_image_prompt(data: dict, height: int = None) -> str:
    """Промпт для nano-banana-2: сетка 2x2 из 4 фотореалистичных образов человека по описаниям looks."""
    height_line = f'The person height is about {height} cm. ' if height else ''

    looks = data.get('looks') or []
    looks_block = ''
    for i, look in enumerate(looks[:4], start=1):
        if isinstance(look, dict):
            title = look.get('title', '')
            desc = look.get('description', '')
        else:
            title, desc = '', str(look)
        looks_block += f'OUTFIT {i} ("{title}"): {desc}\n\n'

    prompt = f'''Create ONE photorealistic image that is a clean 2x2 grid (four equal cells, no gaps text or borders) showing FOUR full-body fashion looks of the SAME real woman.

PERSON: take the woman from the provided photo and keep her EXACT real face, hair, skin tone and body proportions in all four cells. It must clearly be the same real person, photorealistic, not illustrated, not a different face. {height_line}Each cell is a separate full-body studio fashion photo on a soft neutral light-grey/beige seamless background, natural soft lighting, modern editorial lookbook style.

Dress her in these FOUR DIFFERENT complete outfits, one per cell, exactly as described (modern current-year fashion, flattering cuts for her figure). Render every garment, shoes, bag, accessories and JEWELRY described, in realistic detail:

{looks_block}REQUIREMENTS: four DISTINCT outfits (do not repeat the same look), each shown head-to-toe, contemporary and stylish, fit and silhouette flattering to her body. Photorealistic fashion photography quality. NO text, NO captions, NO labels, NO logos, NO color swatches anywhere on the image — only the four outfit photos in a 2x2 grid.'''

    return prompt