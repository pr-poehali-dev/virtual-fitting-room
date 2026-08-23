"""Сервис 'Стилевой анализ одежды' для картиночной инфографики.

Конвейер: Gemini анализирует фото -> компактный русский JSON ->
данные подставляются в промпт для nano-banana-2 -> одна картинка-инфографика.
"""

from datetime import datetime

# Картинка-образец инфографики (референс лайаута) — пока не используем,
# чтобы модель не копировала чужие фото с шаблона. Можем вернуть позже.
# TEMPLATE_IMAGE_URL = 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/627be02b-4c57-49f8-9df7-337fb254d238.png'

# Логотип больше не нужен: картинка теперь — чистая сетка 2x2 из образов без шапки.
LOGO_IMAGE_URL = None

# Стилевой анализ работает на Gemini со строгой JSON-схемой (стабильный валидный JSON).
USE_QWEN = False

# Соотношение сторон итоговой картинки (широкий ряд из 4 образов)
ASPECT_RATIO = '16:9'


def _season_years() -> str:
    """Текущий и следующий год — чтобы промпт не устаревал (например, '2026-2027')."""
    y = datetime.now().year
    return f'{y}-{y + 1}'

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
- looks: массив РОВНО из 4 объектов {title, description}. Это 4 готовых полноценных образа для этого человека, основанных на твоих рекомендациях (стили, силуэты, ключевые вещи, палитра). title — короткое название образа на русском (например, "Деловой кэжуал", "Романтический вечер"). description — ДЕТАЛЬНОЕ описание образа на русском в 2-3 предложения: что именно надето сверху и снизу, верхняя одежда, обувь, сумка, аксессуары и украшения (с конкретными фасонами и цветами из рекомендованной палитры). Описывай ТОЛЬКО ВИДИМОЕ ГЛАЗОМ — материал, фактуру, цвет, форму, длину, посадку. НЕ пиши обоснования и отсылки ("подчёркивает цвет глаз", "выгодно смотрится на фигуре", "цвет совпадает с сумкой") — это не нарисовать; объяснения давай в других полях разбора.
  ОЧЕНЬ ВАЖНО ПРО АКТУАЛЬНОСТЬ: образы должны выглядеть как мода ТЕКУЩЕГО и следующего сезона. Не пиши в описаниях конкретные годы — пиши "текущий сезон", "актуально сейчас". Подбирай вещи и особенно обувь из новых коллекций ЭТОГО сезона — то, что сейчас есть в магазинах и в свежих поступлениях, носибельное и реальное, без экстремальных подиумных образов. Мысленно сверься со свежими коллекциями и street style этого сезона и одевай человека так, как одел бы его ведущий стилист сегодня. Вместо размытых формулировок описывай КОНКРЕТНЫЕ современные признаки фасона: силуэт и посадку, объём, длину, форму обуви и высоту каблука — так, как они выглядят в актуальных коллекциях этого сезона.
  ВАЖНО ПРО ЦВЕТ В КАЖДОМ ОБРАЗЕ: в одном образе используй РОВНО 3 цвета, распределённых в пропорции 60% + 30% + 10% (основной цвет занимает ~60% образа, дополнительный ~30%, акцентный ~10%). Эти 3 цвета обязаны складываться в гармоничную цветовую гамму, сочетаться между собой и относиться к рекомендованной палитре цветотипа человека с фото (из palette_best). НЕ используй цвета из palette_avoid.
  КРИТИЧЕСКИ ВАЖНО: каждая вещь в образе (включая обувь, сумку, аксессуары и украшения) должна быть описана ОДНИМ ИЗ ЭТИХ ТРЁХ ЦВЕТОВ — никаких четвёртых оттенков, никакого "светло-голубого денима", если голубого нет в тройке. У золота и серебра свой собственный цвет: пиши просто "золотые серьги", "серебряный браслет" — не приписывай металлу название оттенка из тройки (не "серьги из тёплого бежевого золота"). Сначала назови тройку в начале описания ("Основной цвет — ..., дополнительный — ..., акцентный — ..."), а затем описывай вещи, указывая у каждой её цвет строго из этой тройки. Перед выдачей проверь себя: пересчитай цвета всех вещей образа — их должно быть ровно три.
  КРИТИЧЕСКИ ВАЖНО ПРО РАЗНООБРАЗИЕ ЦВЕТА: у всех 4 образов цветовые гаммы должны быть РАЗНЫМИ — разные основные цвета и разные сочетания, чтобы получилось четыре непохожих цветовых решения из палитры человека. НЕ строй все образы вокруг одного и того же цвета и НЕ используй один и тот же основной цвет дважды. Бери из palette_best РАЗНЫЕ цвета, в том числе неочевидные и небанальные, а не только самые предсказуемые.
  ВАЖНО ПРО ФИГУРУ: фасон, силуэт, крой, длину и посадку КАЖДОЙ вещи в образах подбирай строго по результату анализа фигуры из пункта 2 (тип фигуры и ближайший типаж Кибби) — линии и пропорции должны быть гармоничны именно этому телу, а не абстрактному. Образы должны быть РАЗНЫМИ между собой и подобранными под фигуру человека, и желательно перекрывать разные ситуации (повседневный, деловой/смарт, и обязательно нарядный). ОБЯЗАТЕЛЬНО: как минимум ОДИН из 4 образов сделай эффектным, по-настоящему красивым и нарядным — образ для особого случая (например, для свидания, романтического вечера или выхода в свет). Это НЕ должна быть простая база "юбка + блузка": продумай его как стилист для красивого выхода — красивый крой и драпировка, изящные акценты, нарядная обувь и украшения, чтобы человек выглядел восхитительно. Нарядный образ — НЕ обязательно платье: это может быть костюм, комплект с юбкой или брюками, эффектное сочетание выразительного верха и низа, комбинезон. Выбирай форму под фигуру и типаж этого человека, а не по шаблону "вечер = длинное платье".
  ЗАПРЕТ НА ШТАМПЫ: не уходи в стандартные шаблоны вечернего образа. НЕ делай нарядный образ автоматически изумрудным, бордовым, винным или чёрным — эти цвета бери ТОЛЬКО если они действительно лучшие для этого конкретного цветотипа, и никогда по умолчанию. Не назначай бархат и атлас автоматически: ткань выбирай по сезону, поводу и типажу. Образы для разных людей обязаны получаться РАЗНЫМИ — веди подбор от внешности, палитры и фигуры конкретного человека с фото, а не от привычного представления о "нарядном образе". Остальные образы оставь более практичными для повседневной жизни. Описывай так, чтобы по тексту можно было точно нарисовать актуальный образ на человеке.

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
    years = _season_years()

    looks = data.get('looks') or []
    looks_block = ''
    for i, look in enumerate(looks[:4], start=1):
        if isinstance(look, dict):
            title = look.get('title', '')
            desc = look.get('description', '')
        else:
            title, desc = '', str(look)
        looks_block += f'OUTFIT {i} ("{title}"): {desc}\n\n'

    prompt = f'''Create ONE wide photorealistic image: a single horizontal ROW of EXACTLY 4 cells side by side (1 row x 4 columns), showing FOUR different full-body fashion looks of the SAME real woman — ONE outfit per cell, ONE frontal full-body photo per cell, 4 photos in total. Not a 2x2 grid, no second row, no two angles of the same outfit. No gaps, no borders, no text.

PERSON — MOST IMPORTANT: take the woman STRICTLY from the provided photo — her EXACT real face, facial features, face shape, hair colour and texture, skin tone and body proportions must stay 100% intact in all four cells, including her ethnicity; invent nothing, it must clearly and recognizably be the SAME real person in every cell, photorealistic, not illustrated. Show her at her very best: YOUNGER and FRESHER than in the photo, rested and radiant, smooth glowing firm skin, bright open eyes, healthy glow, well-groomed, light tasteful makeup — a flattering beauty-editorial rendering of the same person. Her hair keeps its real colour and length, styled in a modern, well-groomed way that suits each look. {height_line}Each cell is a separate full-body studio fashion photo on a soft neutral light-grey/beige seamless background, natural soft lighting, modern editorial lookbook style, the woman standing facing the camera.

Dress her in these FOUR outfits, one per cell, in order from left to right — FOLLOW EACH DESCRIPTION LITERALLY, item by item: render every garment, shoes, bag, accessories and JEWELRY exactly with the stated colour, fabric, texture, cut and length. Do not substitute, simplify, recolour or "interpret" anything, do not add items that are not described, do not swap an item for a different one:

{looks_block}FASHION ERA — VERY IMPORTANT: every outfit must look like the NEWEST {years} current-season collections, in stores and trending RIGHT NOW, with modern proportions, modern shoe shapes and heel heights and a modern finish. Real, wearable everyday fashion, NOT extreme avant-garde runway. Fit each garment exactly as described: fitted stays close to the body, loose stays loose. Paired parts (both sleeves, both trouser legs, both shoes) are always identical in length and volume — asymmetry ONLY where the description explicitly names it. Hair, makeup and styling must read as modern and current too.

Each outfit is shown head-to-toe once. Only the four outfit photos in one horizontal row, nothing else.'''

    return prompt