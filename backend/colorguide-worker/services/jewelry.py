"""Сервис 'Подбор украшений' (service_type='jewelry').

Пользователь загружает любое фото (портрет / по пояс / в полный рост) и анкету:
поводы, металл, камни, какие украшения носит, бюджет, плюс данные о себе
(типаж по Кибби, архетип, цветотип и т.д.).

Нейросеть разбирает масштаб черт и колорит, подбирает 3 набора украшений под
разные поводы. Картинка 3:2 — ТОЛЬКО предметная раскладка трёх наборов, без людей:
фото клиента используется лишь для анализа и в генерацию не передаётся.
"""

from services.outfit import QWEN_MODEL, _is_male

USE_QWEN = True
GEMINI_MODEL = QWEN_MODEL
LOGO_IMAGE_URL = None
ASPECT_RATIO = '3:2'
PARAMS_FIRST = True
TEMPERATURE = 0.8
# Картинка рисуется без фото клиента — только раскладка украшений
IMAGE_WITHOUT_PERSON = True

DEFAULT_OCCASIONS = ['Повседневный', 'Деловой', 'Вечерний']


def _occasions(form_params) -> list:
    if isinstance(form_params, dict):
        occ = form_params.get('occasions')
        if isinstance(occ, list):
            vals = [str(v).strip() for v in occ if str(v or '').strip()]
            if vals:
                return vals[:3]
    return DEFAULT_OCCASIONS


PARAMS_READING_RULES = '''КАК ЧИТАТЬ АНКЕТУ:
- ТИПАЖ ПО КИББИ — главный ориентир по МАСШТАБУ, ФОРМАМ и ЛИНИЯМ украшений (крупные/мелкие, угловатые/округлые, графичные/плавные, гладкие/фактурные).
- ЦВЕТОТИП — оттенок металла и цвета камней.
- АРХЕТИП(Ы) — характер украшений: смелость, декоративность, символика.
- ЛЮБИМЫЙ МЕТАЛЛ, КАМНИ, ВИДЫ УКРАШЕНИЙ, БЮДЖЕТ И КОММЕНТАРИЙ — прямые пожелания, учитывай в первую очередь. Если уши не проколоты — только клипсы или каффы. Чего клиент не носит — не предлагай.
Наборы должны быть явно персональными, а не универсальными.'''


def build_params_block(form_params: dict) -> str:
    """Анкета клиента — только заполненные поля."""
    if not form_params or not isinstance(form_params, dict):
        return ''

    lines = []

    def add(label, key):
        value = form_params.get(key)
        if value is None:
            return
        if isinstance(value, (list, tuple)):
            vals = [str(v).strip() for v in value if str(v or '').strip()]
            if vals:
                lines.append(f'- {label}: {", ".join(vals)}')
        else:
            s = str(value).strip()
            if s:
                lines.append(f'- {label}: {s}')

    add('Пол', 'gender')
    add('Поводы для наборов', 'occasions')
    add('Любимый металл', 'metal')
    add('Камни', 'stones')
    add('Какие украшения носит', 'jewelry_types')
    add('Проколоты ли уши', 'ears_pierced')
    add('Бюджет', 'budget')
    add('Чего НЕ носит / не любит', 'jewelry_dislikes')
    add('Типаж по Дэвиду Кибби', 'kibbe')
    add('Архетип(ы) по Карлу Юнгу', 'archetypes')
    add('Цветотип внешности', 'colortypes')
    add('Цвет волос', 'hair_color')
    add('Цвет глаз', 'eye_color')
    add('Желаемые акценты', 'tags')
    add('Цвета, которые НРАВЯТСЯ', 'favorite_colors')
    add('Цвета, которые НЕ НРАВЯТСЯ', 'disliked_colors')
    add('Примерный возраст', 'style_age')
    add('Комментарий клиента', 'comment')

    occ = ', '.join(_occasions(form_params))
    head = ('ЭТО ГЛАВНОЕ В ЗАДАЧЕ — ДАННЫЕ КЛИЕНТА. Они важнее общих правил ниже. '
            'Не указанные параметры — не выдумывай.\n'
            f'ТРИ НАБОРА СОБИРАЙ ПОД ПОВОДЫ: {occ}.')
    body = '\n'.join(lines)
    return head + ('\n\n' + body if body else '') + '\n\n' + PARAMS_READING_RULES


GEMINI_PROMPT = '''Ты — опытный стилист по украшениям. Клиент просит подобрать украшения, которые идут именно ему. Внимательно изучи человека на фото: черты лица и их масштаб (мелкие/средние/крупные), форму лица, линию шеи и плеч, костяк (если виден), колорит (подтон кожи, волосы, глаза, контрастность). НЕ ориентируйся на украшения, которые сейчас на человеке. Учти анкету.

ЧТО СДЕЛАТЬ:
1) Определи, какой масштаб, формы, фактуры, металлы и камни идут этому человеку, и чего лучше избегать.
2) Собери РОВНО 3 набора украшений под указанные поводы. В наборе — серьги, украшение на шею, кольцо, браслет (или часы), и при желании брошь/пирсинг-каффа; учитывай, что клиент носит и чего не носит. Наборы заметно отличаются по характеру, но все в единой логике типажа и колорита.
3) Для каждого набора укажи, с какой одеждой и вырезом его носить.

ПРАВИЛА:
- Для мужчины — только мужские лаконичные украшения (часы, кольцо-печатка без камня, цепочка, браслет, запонки, зажим для галстука), без камней и серёг, если не указано иное.
- Актуальные современные украшения текущего сезона, без конкретных годов.
- В описаниях предметов только видимое: металл и его оттенок, камень и его цвет, форма, размер словами (миниатюрный/средний/крупный), фактура. Без обоснований — их место в разборе.
- ПИШИ КРАТКО, без воды, но не упуская сути.

Верни СТРОГО валидный JSON (без markdown-обёртки ```), на русском:

{
  "title": "короткое название подборки, 2-5 слов",
  "summary": "2-3 предложения — главная идея: какие украшения ваши и почему",
  "scale_analysis": "2-3 предложения — масштаб черт, форма лица, шея и что из этого следует для размера и формы украшений (с опорой на типаж по Кибби, если указан)",
  "color_analysis": "2-3 предложения — колорит, какие металлы и цвета камней идут",
  "personal_fit": "1-3 предложения — как учтены архетип и пожелания клиента",
  "metals": [ {"name":"металл/оттенок","hex":"#RRGGBB"} ],  // 2-3 лучших металла
  "stones": [ {"name":"камень","hex":"#RRGGBB"} ],  // 3-5 подходящих камней/цветов вставок (пусто, если камни не нужны)
  "best": ["коротко: что идёт — форма/размер/фактура"],  // 4-6 пунктов
  "avoid": ["коротко: чего избегать и почему"],  // 3-4 пункта
  "sets": [
    {"title":"название набора","occasion":"повод","description":"1-2 предложения — настроение набора",
     "items":[ {"name":"предмет","description":"металл, камень, форма, размер — 1 короткое предложение"} ],  // 3-5 предметов
     "wear_with":"1 предложение — с какой одеждой и вырезом носить"}
  ],  // РОВНО 3 набора
  "tips": ["короткий совет по сочетанию, ношению или уходу"]  // 3-5 советов
}'''


REQUIRED_FIELDS = ['title', 'summary', 'sets']


def _items_desc(items) -> str:
    out = []
    for it in items or []:
        if isinstance(it, dict):
            name = str(it.get('name', '')).strip()
            desc = str(it.get('description', '')).strip()
            if name and desc:
                out.append(f'{name} ({desc})')
            elif name or desc:
                out.append(name or desc)
        elif it:
            out.append(str(it))
    return '; '.join(out)


def build_image_prompt(data: dict, height: int = None, gender=None, form_params=None) -> str:
    """Картинка 3:2 — предметная раскладка трёх наборов украшений, без людей."""
    sets = [s for s in (data.get('sets') or []) if isinstance(s, dict)][:3]
    positions = ['LEFT', 'CENTER', 'RIGHT']
    groups = []
    for idx, st in enumerate(sets):
        groups.append(f'{positions[idx]} group: {_items_desc(st.get("items"))}')
    groups_block = '\n'.join(groups) or str(data.get('summary') or '')
    style = 'men\'s jewelry and accessories' if _is_male(gender) else 'jewelry'

    return f'''Create ONE photorealistic luxury product still-life photograph with aspect ratio 3:2 (wide): three separate {style} sets laid out flat.

ABSOLUTELY NO PEOPLE: no person, no face, no hands, no body parts, no mannequins, no busts. IGNORE any person in the reference image completely — it is NOT to be shown. Only the jewelry objects.

LAYOUT: THREE clearly separated groups side by side (left, center, right) with generous empty space between them, each group is one complete set arranged neatly and elegantly, items not overlapping, every item appears exactly once. Render each item exactly as described — metal and its tone, gemstone and its colour, shape, size and texture; do not add or swap items:
{groups_block}

BACKGROUND: one single continuous seamless surface in a soft neutral light-beige tone (fine matte paper or smooth stone), the same tone across the whole image, no panels or seams. Soft diffused natural light, subtle soft shadows, realistic metal reflections and gemstone sparkle, high-end jewelry catalogue look. Modern current-season jewelry design. No text, no captions, no labels, no logos, no boxes or packaging.'''
