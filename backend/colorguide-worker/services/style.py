"""Сервис 'Стилевой анализ одежды' для картиночной инфографики.

Конвейер: Gemini анализирует фото -> компактный русский JSON ->
данные подставляются в промпт для nano-banana-2 -> одна картинка-инфографика.
"""

# Картинка-образец инфографики (референс лайаута для nano-banana-2)
TEMPLATE_IMAGE_URL = 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/627be02b-4c57-49f8-9df7-337fb254d238.png'

# Соотношение сторон итоговой картинки (вертикальный постер)
ASPECT_RATIO = '3:4'

# Промпт для Gemini: анализ стиля. Все тексты строго на русском, компактно.
GEMINI_PROMPT = '''Ты профессиональный стилист-имиджмейкер.
Проанализируй внешность человека на фото (телосложение, черты, пропорции, колорит) и составь персональный стилевой анализ.

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

Опирайся только на то, что видно на фото и на свои знания. Не выдумывай.'''

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

    prompt = f'''Create a vertical fashion-magazine style infographic poster titled "СТИЛЕВОЙ АНАЛИЗ ВНЕШНОСТИ".

CRITICAL: ALL text on the image MUST be in RUSSIAN language (Cyrillic only). NO English words anywhere.

Use the SECOND reference image as the exact LAYOUT TEMPLATE — copy its structure, blocks, grid, soft beige/cream background and clean editorial typography.
Use the FIRST reference image as the PERSON — keep the real face, body and proportions of this person in the central large portrait and in the outfit photos. {height_line}

Fill the poster with these blocks and EXACTLY this Russian text:

ШАПКА: слева логотип "fitting-room", справа "fitting-room.ru", по центру заголовок "СТИЛЕВОЙ АНАЛИЗ ВНЕШНОСТИ".

ТВОЙ ВАЙБ: {lst('vibe')}.

ТВОИ ЛУЧШИЕ СТИЛИ: {lst('best_styles')}.

МЕНЕЕ ПОДХОДИТ: {lst('avoid_styles')}.

ТВОЯ ПАЛИТРА — лучшие цвета: {lst('palette_best')}; цвета, которых избегать: {lst('palette_avoid')}. Покажи их образцами-квадратиками с подписями.

ВЫИГРЫШНЫЕ СИЛУЭТЫ: {lst('silhouettes')}.

КЛЮЧЕВЫЕ ВЕЩИ: {lst('key_items')}. Покажи аккуратными иконками одежды.

АКСЕССУАРЫ: {lst('accessories')}. Покажи иконками.

ТЫ В СВОИХ СТИЛЯХ: 4 фото этого человека в разных рекомендованных образах.

СТИЛЕВЫЕ ЗАМЕТКИ: {lst('tips')}.

ВНИЗУ крупно по центру: "{data.get('identity', '')}".

Style: minimalism, high readability, professional fashion typography, clean modular grid, neutral beige palette. Photorealistic outfit photos of the same person. Remember: every text label is in RUSSIAN.'''

    return prompt
