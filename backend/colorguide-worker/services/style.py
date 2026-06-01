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

# Промпт для Gemini: анализ стиля. Все тексты строго на русском, компактно.
GEMINI_PROMPT = '''Ты профессиональный стилист-имиджмейкер.
Проанализируй ПРИРОДНЫЕ данные внешности человека на фото: природный колорит (тон кожи, цвет волос, глаз, контрастность), телосложение, пропорции и черты лица. На их основе составь персональный стилевой анализ.

ВАЖНО: полностью игнорируй ту одежду, цвета и аксессуары, что СЕЙЧАС надеты на человеке — это случайный наряд, а не часть анализа. НЕ описывай и НЕ рекомендуй то, что уже на фото. Палитру подбирай под природный колорит (а не под цвет текущего наряда), а вещи и образы — под тип фигуры и вайб, предлагая НОВЫЕ варианты, а не повтор текущего лука.

Верни СТРОГО JSON по схеме. Все тексты — на русском языке, кратко и по делу.

Требования к полям:
- identity: 2-4 слова, итоговая стилевая идентичность (например, "Мягкий гламур и элегантность").
- vibe: 5-7 прилагательных-характеристик вайба (например, "Уверенная", "Женственная").
- best_styles: 3-5 названий подходящих стилей одежды на русском (например, "Тихая роскошь", "Классическая элегантность").
- avoid_styles: 2-3 названия менее подходящих стилей.
- palette_best: 6 названий лучших цветов одежды на русском (например, "Тёплый беж", "Глубокий бордо").
- palette_avoid: 6 названий цветов, которых лучше избегать.
- silhouettes: 3-4 выигрышных силуэта на русском (например, "Приталенный силуэт", "Струящиеся линии").
- key_items: 5-6 ключевых вещей гардероба на русском (например, "Блейзер", "Шёлковая блуза").
- accessories: 3 подходящих аксессуара на русском (например, "Тонкие золотые украшения").
- tips: 5 коротких советов стилиста на русском.

Опирайся на природные данные внешности и свой профессиональный опыт. Не выдумывай лишнего.'''

# JSON-схема ответа Gemini (strict)
RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'identity': {'type': 'string'},
        'vibe': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 7},
        'best_styles': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 5},
        'avoid_styles': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 2, 'maxItems': 3},
        'palette_best': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 6, 'maxItems': 6},
        'palette_avoid': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 6, 'maxItems': 6},
        'silhouettes': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 4},
        'key_items': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 6},
        'accessories': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 3},
        'tips': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 5},
    },
    'required': [
        'identity', 'vibe', 'best_styles', 'avoid_styles', 'palette_best',
        'palette_avoid', 'silhouettes', 'key_items', 'accessories', 'tips'
    ],
    'additionalProperties': False
}

# Обязательные поля результата (для валидации полноты ответа)
REQUIRED_FIELDS = [
    'identity', 'vibe', 'best_styles', 'palette_best', 'silhouettes',
    'key_items', 'accessories', 'tips'
]


def build_image_prompt(data: dict, height: int = None) -> str:
    """Собрать промпт для nano-banana-2 из данных анализа Gemini."""
    def lst(key):
        return ', '.join(data.get(key, []) or [])

    height_line = f'Рост модели: {height} см. ' if height else ''

    if LOGO_IMAGE_URL:
        logo_instruction = 'LOGO: place the logo from the SECOND image into the top-left of the header, keep it undistorted.\n\n'
        logo_header = 'слева логотип (со второго изображения)'
    else:
        logo_instruction = ''
        logo_header = 'слева логотип-надпись "fitting-room" аккуратным тонким шрифтом'

    prompt = f'''CRITICAL: EVERY text label on the image MUST be written in RUSSIAN (Cyrillic letters only). NO English words anywhere — only the exact Russian text given below.

Create a vertical fashion-magazine infographic poster titled "СТИЛЕВОЙ АНАЛИЗ ВНЕШНОСТИ".

LAYOUT: soft beige/cream background, clean editorial typography, modular grid. Top header bar; left column with text blocks; a compact central photo of the person (moderate size, do NOT make it dominate the poster); right column with palette and items; a row of full-body outfit photos near the bottom; a big centered title at the very bottom.

PERSON: in the central block place the FIRST image EXACTLY AS IS — same crop, same pose, same outfit, same real face. Do NOT redraw, retouch, restyle, re-crop or regenerate this photo, do NOT turn it into a studio portrait. Keep the identical real face and proportions in every outfit photo below. Do NOT invent or add any other people or faces. {height_line}

{logo_instruction}Fill the poster with EXACTLY this Russian text:

ШАПКА: {logo_header}, справа надпись "fitting-room.ru", по центру заголовок "СТИЛЕВОЙ АНАЛИЗ ВНЕШНОСТИ".

ТВОЙ ВАЙБ: {lst('vibe')}.

ТВОИ ЛУЧШИЕ СТИЛИ: {lst('best_styles')}.

МЕНЕЕ ПОДХОДИТ: {lst('avoid_styles')}.

ТВОЯ ПАЛИТРА — лучшие цвета: {lst('palette_best')}; цвета, которых избегать: {lst('palette_avoid')}. Покажи цветными образцами-квадратиками с подписями.

ВЫИГРЫШНЫЕ СИЛУЭТЫ: {lst('silhouettes')}.

КЛЮЧЕВЫЕ ВЕЩИ: {lst('key_items')}. Покажи как фотореалистичные предметы одежды на нейтральном фоне (не иконки, не рисунки).

АКСЕССУАРЫ: {lst('accessories')}. Покажи как фотореалистичные предметы на нейтральном фоне.

ТЫ В СВОИХ СТИЛЯХ: 4 фотореалистичных снимка ЭТОГО ЖЕ человека (с первого изображения) в разных рекомендованных образах.

СТИЛЕВЫЕ ЗАМЕТКИ: {lst('tips')}.

ВНИЗУ крупно по центру: "{data.get('identity', '')}".

Style: minimalism, high readability, professional fashion typography, neutral beige palette, photorealistic clothing and outfit photos. Reminder: every text label is in RUSSIAN.'''

    return prompt