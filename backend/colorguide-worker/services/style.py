"""Сервис 'Стилевой анализ одежды' для картиночной инфографики.

Конвейер: Gemini анализирует фото -> компактный русский JSON ->
данные подставляются в промпт для nano-banana-2 -> одна картинка-инфографика.
"""

# Картинка-образец инфографики (референс лайаута) — пока не используем,
# чтобы модель не копировала чужие фото с шаблона. Можем вернуть позже.
# TEMPLATE_IMAGE_URL = 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/627be02b-4c57-49f8-9df7-337fb254d238.png'

# Логотип fitting-room для вставки в шапку постера (вход-картинка для nano-banana-2). PNG.
LOGO_IMAGE_URL = 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/3347378c-362c-486f-bc47-39edb5beb913.png'

# Соотношение сторон итоговой картинки (вертикальный постер)
ASPECT_RATIO = '3:4'

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
    },
    'required': [
        'identity', 'color_analysis', 'body_analysis', 'vibe', 'best_styles', 'avoid_styles',
        'palette_best', 'palette_avoid', 'silhouettes', 'key_items', 'accessories', 'tips'
    ],
    'additionalProperties': False
}

# Обязательные поля результата (для валидации полноты ответа)
REQUIRED_FIELDS = [
    'identity', 'vibe', 'best_styles', 'palette_best', 'silhouettes',
    'key_items', 'accessories', 'tips'
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
    """Собрать промпт для nano-banana-2 из данных анализа Gemini."""
    def lst(key):
        return ', '.join(_names(data.get(key)))

    def palette_with_hex(key):
        parts = []
        for it in data.get(key) or []:
            if isinstance(it, dict):
                name = it.get('name', '')
                hx = it.get('hex', '')
                parts.append(f'{name} ({hx})' if hx else name)
            elif it:
                parts.append(str(it))
        return ', '.join(parts)

    height_line = f'Рост модели: {height} см. ' if height else ''

    if LOGO_IMAGE_URL:
        logo_instruction = 'LOGO: place the logo from the SECOND image into the top-left of the header, keep it undistorted.\n\n'
        logo_header = 'слева логотип (со второго изображения)'
    else:
        logo_instruction = ''
        logo_header = 'слева логотип-надпись "fitting-room" аккуратным тонким шрифтом'

    prompt = f'''CRITICAL: EVERY text label on the image MUST be written in RUSSIAN (Cyrillic letters only). NO English/Latin letters anywhere, and NEVER mix Latin and Cyrillic inside one word — copy the Russian words below EXACTLY, letter by letter, without inventing or transliterating anything.

Create a vertical fashion-magazine infographic poster titled "СТИЛЕВОЙ АНАЛИЗ ВНЕШНОСТИ".

LAYOUT: soft beige/cream background, refined modern editorial typography, modular grid. Top header bar; left column with text blocks; a compact central photo of the person (moderate size, do NOT make it dominate the poster); right column with palette and items; a row of full-body outfit photos near the bottom; a big centered title at the very bottom.

TYPOGRAPHY & COLOR: make the design look more elegant and premium. Section HEADINGS use an elegant high-fashion serif font (like Vogue/Harper's Bazaar magazine titles); body text uses a clean modern sans-serif. Do NOT use pure black (#000000) for any text — use a soft warm dark tone (deep taupe / warm charcoal brown, around #4A3F35) for body and headings, and a refined muted accent (dusty terracotta / soft mauve) for section titles. Keep everything harmonious with the warm beige palette, high contrast for readability.

PERSON: in the central block place the FIRST image EXACTLY AS IS — same crop, same pose, same outfit, same real face. Do NOT redraw, retouch, restyle, re-crop or regenerate this photo, do NOT turn it into a studio portrait. Keep the identical real face and proportions in every outfit photo below. Do NOT invent or add any other people or faces. {height_line}

{logo_instruction}Fill the poster with EXACTLY this Russian text:

ШАПКА: {logo_header}, справа надпись "fitting-room.ru", по центру заголовок "СТИЛЕВОЙ АНАЛИЗ ВНЕШНОСТИ".

ТВОЙ ВАЙБ: {lst('vibe')}.

ТВОИ ЛУЧШИЕ СТИЛИ: {lst('best_styles')}.

МЕНЕЕ ПОДХОДИТ: {lst('avoid_styles')}.

ТВОЯ ПАЛИТРА — лучшие цвета: {lst('palette_best')}; цвета, которых избегать: {lst('palette_avoid')}. Покажи цветными образцами-квадратиками, под каждым — ТОЛЬКО русское название цвета. КРИТИЧНО: НЕ подписывай никакие коды, цифры, HEX или буквенно-цифровые обозначения цвета — под образцом строго только название словами.

ВЫИГРЫШНЫЕ СИЛУЭТЫ: {lst('silhouettes')}.

КЛЮЧЕВЫЕ ВЕЩИ: {lst('key_items')}. Покажи как фотореалистичные предметы ОДЕЖДЫ на нейтральном фоне (не иконки, не рисунки). Это блок про одежду — НЕ добавляй сюда украшения, сумки, обувь. Каждую вещь показывай ОДИН раз и НЕ дублируй (не повторяй одинаковые предметы). Текстовый список под предметами НЕ добавляй — только сами фотографии вещей.

АКСЕССУАРЫ: {lst('accessories')}. Покажи как фотореалистичные предметы на нейтральном фоне. КРИТИЧНО: в этом блоке показывай ТОЛЬКО аксессуары — украшения, сумку, ремень, обувь, очки, шарф/платок, шляпу. НИКАКОЙ одежды (никаких пальто, тренчей, плащей, курток, джинсов, брюк, платьев, рубашек) в блоке аксессуаров быть НЕ должно. Текстовый список под предметами НЕ добавляй — только сами фотографии аксессуаров.

ТЫ В СВОИХ СТИЛЯХ: 4 фотореалистичных снимка ЭТОГО ЖЕ человека (с первого изображения) в разных рекомендованных образах. Образы должны быть СОВРЕМЕННЫМИ и актуальными по моде ИМЕННО ЭТОГО ГОДА (текущие модные тенденции) — категорически никаких устаревших фасонов прошлых десятилетий (например, узких брюк "из 2010-х"). Крой и посадку каждой вещи подбирай под фигуру человека так, чтобы она смотрелась максимально выгодно (если фигуре идут широкие/прямые брюки — показывай именно их, а не зауженные). Современный крой, актуальные пропорции и стилизация.

СТИЛЕВЫЕ ЗАМЕТКИ: {lst('tips')}.

ВНИЗУ крупно по центру одна фраза — стилевая идентичность: "{data.get('identity', '')}". НЕ повторяй внизу заголовок "СТИЛЕВОЙ АНАЛИЗ ВНЕШНОСТИ" — он есть только в шапке.

КРИТИЧНО ПРО ТЕКСТ: каждую надпись, заголовок и название показывай РОВНО ОДИН раз. НЕ дублируй текст, не повторяй один и тот же заголовок или название в двух местах, не подписывай предметы повторно.

Style: elegant premium fashion-magazine aesthetic, minimalism, high readability, refined serif headings + clean sans-serif body, warm beige palette, NO pure black text (use warm dark taupe + muted terracotta/mauve accents), photorealistic and MODERN clothing and outfit photos (current-year fashion, not outdated cuts). Reminder: every text label is in RUSSIAN (Cyrillic only).'''

    return prompt