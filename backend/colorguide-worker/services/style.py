"""Сервис 'Стилевой анализ одежды' для картиночной инфографики.

Конвейер: Gemini анализирует фото -> компактный русский JSON ->
данные подставляются в промпт для nano-banana-2 -> одна картинка-инфографика.
"""

# Картинка-образец инфографики (референс лайаута) — пока не используем,
# чтобы модель не копировала чужие фото с шаблона. Можем вернуть позже.
# TEMPLATE_IMAGE_URL = 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/627be02b-4c57-49f8-9df7-337fb254d238.png'

# Логотип больше не нужен: картинка теперь — чистая сетка 2x2 из образов без шапки.
LOGO_IMAGE_URL = None

# Текстовая модель: переключаем стилевой анализ на Qwen3-VL Thinking (как в outfit).
QWEN_MODEL = 'qwen/qwen3-vl-235b-a22b-thinking'
# Флаг для worker: использовать Qwen (без strict json_schema, с парсингом JSON из ответа).
# Если Qwen вернёт неполный JSON — worker автоматически откатится на strict-Gemini.
USE_QWEN = True

# Соотношение сторон итоговой картинки (широкий ряд из 4 образов)
ASPECT_RATIO = '16:9'

# Промпт для Gemini: глубокий профессиональный анализ стиля. Все тексты на русском.
GEMINI_PROMPT = '''Ты — топовый персональный стилист-имиджмейкер с 15-летним опытом. К тебе пришёл клиент за индивидуальным стилевым разбором. Работай как настоящий профессионал: сначала ВНИМАТЕЛЬНО изучи самого человека на фото, а потом выстрой рекомендации, вытекающие из его природных данных.

КРИТИЧЕСКИ ВАЖНО про одежду на фото: НЕ ориентируйся на ту одежду, цвета, фасоны, ткани и СТЕПЕНЬ НАРЯДНОСТИ, что СЕЙЧАС надеты на человеке. Это случайный наряд для фотосессии, а НЕ показатель того, что ему идёт и не указание на уместный уровень образов. Не подстраивай результат под текущий лук: если человек снят в простой повседневной одежде — это НЕ значит, что нужно предлагать только casual; если снят в нарядном платье — это НЕ значит, что все образы должны быть праздничными. Пример: человек снят в льняном платье — это не значит, что ему нужно рекомендовать лён; возможно, по фигуре и колориту ему гораздо больше идут струящиеся ткани, трикотаж или плотные структурные материалы. В ПЕРВУЮ ОЧЕРЕДЬ смотри на САМОГО ЧЕЛОВЕКА: его лицо, колорит, фигуру, пропорции, рост, энергетику — и подмечай, что именно ему пойдёт, независимо от того, во что он одет на фото. Только из этого выводи рекомендации и предлагай НОВЫЕ варианты, а не повтор текущего лука.

ПОРЯДОК АНАЛИЗА (рассуждай как стилист):
1) ВНЕШНОСТЬ И КОЛОРИТ: определи подтон кожи (тёплый/холодный/нейтральный), цвет и тон волос, цвет глаз, общую контрастность внешности (высокая/средняя/низкая), яркость и глубину. Опиши это конкретно по тому, что видишь.
2) ФИГУРА И ПРОПОРЦИИ: проанализируй фигуру ОЧЕНЬ ВНИМАТЕЛЬНО, как профессионал. Оцени костяк (тонкий/средний/широкий, острые или мягкие линии), форму плеч, баланс верха и низа, талию, грудь и бёдра, длину и пропорции тела, общий масштаб. Определи тип фигуры и соотнеси внешность с системой типажей Дэвида Кибби (Dramatic, Soft Dramatic, Flamboyant/Soft Natural, Dramatic/Soft Classic, Flamboyant/Soft Gamine, Theatrical Romantic, Romantic) — какой типаж ближе всего по сочетанию вертикали/ширины, угловатости/мягкости, масштаба и наличия изгибов. Именно из этого выводи, какие силуэты, линии, длины, объём и крой будут гармоничны этой фигуре, а какие её "ломают". Реши, что стоит подчеркнуть, а что — уравновесить.
   Используй самую новую версию системы типажей Кибби. Подсказки по росту: рост 168 см и выше — только Dramatic, Soft Dramatic или Flamboyant Natural; рост 167 см и ниже — НЕ может быть Dramatic, Soft Dramatic или Flamboyant Natural; рост 166 см и выше — НЕ может быть Soft Gamine. У Натурала бёдра и талия без выраженного изгиба, сильнее всего выражены плечи. Если уверенно определить типаж не получается — НЕ называй типаж, а составляй образы по индивидуальным линиям фигуры: у высоких подчёркивай вертикаль, у фигуристых подчёркивай изгибы подходящими фасонами.
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
- looks: массив РОВНО из 4 объектов {title, description}. Это 4 готовых полноценных образа для этого человека, основанных на твоих рекомендациях (стили, силуэты, ключевые вещи, палитра). title — короткое название образа на русском (например, "Деловой кэжуал", "Романтический вечер"). description — ДЕТАЛЬНОЕ описание образа на русском в 2-3 предложения: что именно надето сверху и снизу, верхняя одежда, обувь, сумка, аксессуары и украшения (с конкретными фасонами и цветами из рекомендованной палитры).
  ОЧЕНЬ ВАЖНО ПРО АКТУАЛЬНОСТЬ: образы должны выглядеть как мода 2025–2026 года, НЕ как 2010-е. Подбирай вещи и особенно обувь из новых коллекций ЭТОГО сезона — актуальное, что сейчас есть в магазинах и в свежих поступлениях. Никаких устаревших или прошлосезонных вещей, но и без экстремальных подиумных образов — это носибельная, реальная современная одежда. Вместо размытых формулировок ("платье-футляр", "прямые джинсы", "классические туфли-лодочки") описывай КОНКРЕТНЫЕ современные признаки фасона: актуальный силуэт и посадку (свободный/relaxed/прямой/oversize крой, высокая посадка), объём и длину (например, широкие или прямые брюки полной длины, удлинённый жакет с мягкими плечами, юбка-миди или макси), актуальную обувь сезона (лоферы, балетки, обувь на низком ходу, актуальные босоножки — а НЕ узкие шпильки-лодочки из 2010-х), современные сумки и украшения. Избегай примет 2010-х: скинни-джинсы, очень короткие приталенные пиджаки, узкие лодочки на тонкой шпильке, мини с прямыми лодочками.
  ВАЖНО ПРО ЦВЕТ В КАЖДОМ ОБРАЗЕ: в одном образе используй НЕ БОЛЕЕ 3 цветов, распределённых в пропорции 60% + 30% + 10% (основной цвет занимает ~60% образа, дополнительный ~30%, акцентный ~10%). Эти 3 цвета обязаны сочетаться между собой и относиться к рекомендованной палитре цветотипа человека с фото (из palette_best). НЕ используй цвета из palette_avoid. В описании образа указывай, какой цвет основной, какой дополнительный и какой акцентный.
  ВАЖНО ПРО ФИГУРУ: фасон, силуэт, крой, длину и посадку КАЖДОЙ вещи в образах подбирай строго по результату анализа фигуры из пункта 2 (тип фигуры и ближайший типаж Кибби) — линии и пропорции должны быть гармоничны именно этому телу, а не абстрактному. Образы должны быть РАЗНЫМИ между собой и подобранными под фигуру человека, и желательно перекрывать разные ситуации (повседневный, деловой/смарт, и обязательно нарядный). ОБЯЗАТЕЛЬНО: как минимум ОДИН из 4 образов сделай эффектным, по-настоящему красивым и нарядным — образ для особого случая (например, для свидания, романтического вечера или выхода в свет). Это НЕ должна быть простая база "юбка + блузка": продумай его как стилист для красивого выхода — выразительное платье или эффектное сочетание верха и низа, благородные ткани (шёлк, атлас, бархат, кружево, струящиеся материалы), красивый крой и драпировка, изящные акценты, нарядная обувь и украшения, чтобы человек выглядел восхитительно. Остальные образы оставь более практичными для повседневной жизни. Описывай так, чтобы по тексту можно было точно нарисовать актуальный образ на человеке.

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
    """Промпт для nano-banana-2: горизонтальный ряд из 4 фотореалистичных образов по описаниям looks."""
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

    prompt = f'''Create ONE wide photorealistic image: a single horizontal ROW of EXACTLY 4 cells side by side (1 row x 4 columns), showing FOUR full-body fashion looks of the SAME real woman.

CRITICAL COMPOSITION: exactly 4 cells in ONE horizontal row, ONE outfit per cell, ONE single frontal full-body photo per cell. Do NOT make a 2x2 grid, do NOT add a second row, do NOT show two angles or two photos of the same outfit in one cell — strictly 4 photos total, one per look. No gaps, no borders, no text.

PERSON — MOST IMPORTANT: take the woman STRICTLY from the provided photo and keep her EXACT real face, facial features, face shape, hair color and texture, skin tone and body proportions in all four cells. Use her real appearance from the uploaded photo as the single source of truth — do NOT invent a new face, do NOT change her ethnicity, age, facial features or hairstyle. It must clearly and recognizably be the SAME real person in every cell, photorealistic, not illustrated. You MAY only gently enhance her so she looks her best: fresh, rested, healthy and well-groomed (clear glowing skin, tidy hair, light tasteful makeup) — but keep her identity and natural features 100% intact, no beautification that changes who she is. {height_line}Each cell is a separate full-body studio fashion photo on a soft neutral light-grey/beige seamless background, natural soft lighting, modern editorial lookbook style, the woman standing facing the camera.

Dress her in these FOUR DIFFERENT complete outfits, one per cell, in order from left to right, exactly as described (modern current-year fashion, flattering cuts for her figure). Render every garment, shoes, bag, accessories and JEWELRY described, in realistic detail:

{looks_block}FASHION ERA — VERY IMPORTANT: style every outfit to look like CURRENT 2025-2026 fashion, NOT 2010s. Every garment, shoe, bag and accessory MUST look like it comes from the NEWEST current-season collections — the newest in-store pieces of THIS season that are trending RIGHT NOW, but still REAL, WEARABLE everyday fashion (NOT extreme avant-garde runway looks). Footwear especially must be the newest current-season models, not classic dated styles. Use contemporary silhouettes and proportions: relaxed/structured tailoring, soft natural shoulders, high-waisted wide or straight full-length trousers, longline jackets and coats, midi/maxi lengths, modern footwear (loafers, ballet flats, low-heel or block-heel shoes, contemporary sandals). AVOID anything that looks like an old or past-season item, and AVOID dated 2010s markers: skinny jeans, very short tight blazers, thin stiletto pumps, overly fitted bodycon shapes. Hair, makeup and styling should also read as modern and current.

COLOR RULE — IMPORTANT: each outfit must use NO MORE THAN 3 colors, balanced in a 60-30-10 proportion (one dominant color ~60%, a secondary ~30%, an accent ~10%), all harmonized and matching the person's color type.

REQUIREMENTS: four DISTINCT outfits (do not repeat the same look), each shown head-to-toe once, contemporary 2025-2026 style, fit and silhouette flattering to her body. Photorealistic fashion photography quality. NO text, NO captions, NO labels, NO logos, NO color swatches anywhere on the image — only the four outfit photos in one horizontal row.'''

    return prompt