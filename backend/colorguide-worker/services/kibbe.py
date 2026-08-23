"""Сервис 'Определение типажа по Кибби по фото'.

Конвейер: Gemini анализирует фото в полный рост -> русский JSON
с определением типажа Дэвида Кибби и рекомендациями ->
nano-banana-2 рисует 3 образа, раскрывающих типаж.
"""

from datetime import datetime

LOGO_IMAGE_URL = None

# Справочная схема линий фигуры по 10 типажам Кибби — уходит ВТОРЫМ изображением в анализ.
REFERENCE_IMAGE_URL = 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/f69513de-b296-46fc-8a7f-9c0c24441f9d.png'


def _season_years() -> str:
    """Текущий и следующий год — чтобы промпт не устаревал (например, '2026-2027')."""
    y = datetime.now().year
    return f'{y}-{y + 1}'

QWEN_MODEL = 'qwen/qwen3-vl-235b-a22b-thinking'
USE_QWEN = True
GEMINI_MODEL = QWEN_MODEL

# Три образа в полный рост
ASPECT_RATIO = '16:9'

GEMINI_PROMPT = '''Ты — эксперт по системе типажей Дэвида Кибби с 15-летним опытом. К тебе пришёл клиент за определением своего типажа по фото в полный рост. Работай как настоящий профессионал: сначала ВНИМАТЕЛЬНО изучи костяк, пропорции и черты, а потом определи типаж и выведи рекомендации.

КРИТИЧЕСКИ ВАЖНО про одежду на фото: НЕ ориентируйся на ту одежду, что СЕЙЧАС надета на человеке — это случайный наряд, а не показатель типажа. Одежда может искажать восприятие силуэта. Смотри СКВОЗЬ одежду на реальный костяк, ширину плеч, пропорции и линии тела.

ТЕБЕ ДАНЫ ДВА ИЗОБРАЖЕНИЯ. ПЕРВОЕ — фото КЛИЕНТА в полный рост, только его внешность и фигуру ты анализируешь. ВТОРОЕ — справочная схема линий фигуры по типажам Кибби; это учебная таблица, а НЕ человек. Схема — ВСПОМОГАТЕЛЬНОЕ дополнение для сверки линий фигуры; опирайся В ПЕРВУЮ ОЧЕРЕДЬ на собственные знания системы Кибби, а схему используй как проверку своего вывода. СТРОГО ЗАПРЕЩЕНО анализировать внешность, лицо или колорит фигур со схемы, считать их клиентом и описывать их одежду в ответе.

10 ТИПАЖЕЙ КИББИ:
Dramatic, Soft Dramatic, Flamboyant Natural, Soft Natural, Dramatic Classic, Soft Classic, Flamboyant Gamine, Soft Gamine, Theatrical Romantic, Romantic.

ПОРЯДОК РАБОТЫ (строго в таком порядке, не перескакивай):
1) ВЫДЕЛИ ХАРАКТЕРНЫЕ ЧЕРТЫ ФИГУРЫ по фото. Пройдись по каждому пункту и зафиксируй, что именно ты видишь: рост и общее впечатление вертикали; ширина и форма плеч; грудная клетка; линия талии и степень её выраженности; бёдра; изгибы — есть они или нет и насколько выражены; худоба или мягкость и полнота тела; ширина костяка; длина рук и ног; кисти, стопы, запястья; шея; линия челюсти; масштаб и характер черт лица. На этом шаге НЕ называй типаж и не подгоняй описание под какой-либо типаж — просто честно опиши то, что видишь.
2) СРАВНИ выделенные черты СО ВСЕМИ 10 ТИПАЖАМИ по очереди. Мысленно пройди весь список сверху вниз и по каждому типажу оцени, насколько он совпадает с реальными чертами этого человека и что именно НЕ совпадает. Не останавливайся на первом подходящем — проверь все десять.
3) СВЕРЬСЯ СО СХЕМОЙ: сопоставь линии фигуры клиента с силуэтами на справочной схеме и проверь, поддерживает ли она твой вывод.
4) ВЫБЕРИ типаж с наибольшим совпадением по совокупности черт.
Опирайся на собственную экспертизу в системе Кибби. Рассматривай все 10 типажей на равных, без типажа по умолчанию. Если два типажа совпадают почти одинаково — честно назови оба в поле confidence.

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
  ОЧЕНЬ ВАЖНО ПРО АКТУАЛЬНОСТЬ: образы должны выглядеть как мода текущего и следующего сезона — актуальные силуэты, посадка, обувь и сумки из новых коллекций. Мысленно сверься со свежими коллекциями и street style этого сезона и одевай человека так, как одел бы его ведущий стилист сегодня.
  ДЛИНА И ФАСОН — ОБЯЗАТЕЛЬНО КОНКРЕТНО: у каждой вещи указывай, до какой точки на теле она доходит, и называй конкретный фасон. Расплывчатые слова про длину и объём ("удлинённый", "укороченный", "свободный", "средний") сами по себе не годятся — художник трактует их произвольно и рисует крайность. Всегда привязывай длину к ориентиру на теле и добавляй название фасона. У каждой вещи указывай, к какому стилю одежды она относится, чтобы крой и детали соответствовали ситуации, для которой собран образ. Фасон описывай так, чтобы по этому описанию вещь можно было изобразить правильно и однозначно.
  ВАЖНО ПРО ЦВЕТ: в каждом образе используй РОВНО 3 цвета в пропорции 60% + 30% + 10% (основной ~60%, дополнительный ~30%, акцентный ~10%). Эти 3 цвета обязаны складываться в гармоничную цветовую гамму и подходить колориту человека с фото. Каждая вещь, включая обувь, сумку, аксессуары и украшения, описывается одним из этих трёх цветов. У золота и серебра свой собственный цвет: пиши просто "золотые серьги", "серебряный браслет" — не приписывай металлу название оттенка из тройки. Назови тройку в начале описания образа, а затем описывай вещи, указывая у каждой её цвет.
  РАЗНООБРАЗИЕ ЦВЕТА: сначала определи по фото, какие цвета идут этому человеку — его колорит, тон кожи, цвет глаз и волос. Бери цвета ТОЛЬКО из тех, что ему действительно к лицу, а не любые понравившиеся. Из этих подходящих цветов составь ТРИ РАЗНЫЕ цветовые гаммы — по одной на образ. Внутри каждой гаммы три цвета обязаны сочетаться между собой и выглядеть гармонично как единое целое. Гаммы между собой должны быть непохожими: разные основные цвета, разные сочетания, один и тот же основной цвет дважды не используй. Не строй все три образа вокруг одного цвета и не ограничивайся самыми предсказуемыми оттенками. НЕ используй ЧЁРНЫЙ цвет ни в одном из трёх образов — ни как основной, ни как дополнительный, ни как акцентный, ни в обуви, сумках и аксессуарах. Вместо чёрного бери более интересные глубокие оттенки, идущие человеку.

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
    years = _season_years()
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

    prompt = f'''Create ONE wide photorealistic image: a single horizontal ROW of EXACTLY 3 cells side by side (1 row x 3 columns), showing THREE different full-body fashion looks of the SAME real woman — ONE outfit per cell, ONE frontal full-body photo per cell, 3 photos in total. Not a grid, no second row, no two angles of the same outfit. No gaps, no borders, no text.

PERSON — MOST IMPORTANT: take the woman STRICTLY from the provided photo — her EXACT real face, facial features, face shape, hair colour and texture, skin tone and ethnicity must stay 100% intact in all three cells; invent nothing, it must clearly and recognizably be the SAME real person in every cell, photorealistic, not illustrated. Her REAL BODY PROPORTIONS matter just as much: bone structure, shoulder width, waist, hips and overall body scale must match the uploaded photo exactly — do NOT slim her down or lengthen her legs. Show her at her very best: YOUNGER and FRESHER than in the photo, rested and radiant, smooth glowing firm skin, bright open eyes, healthy glow, well-groomed, light tasteful makeup — a flattering beauty-editorial rendering of the same person, with her identity and natural body intact. {height_line}Each cell is a separate full-body studio fashion photo on a soft neutral light-grey seamless background, natural soft lighting, modern editorial lookbook style, the woman standing facing the camera, shown head to toe including shoes.

{type_line}Dress her in these THREE outfits, one per cell, in order from left to right, exactly as described. Render every garment, shoes, bag, accessories and JEWELRY described, in realistic detail:

{looks_block}FASHION ERA — VERY IMPORTANT: every garment, shoe, bag and accessory MUST look like it comes from the NEWEST {years} current-season collections, trending RIGHT NOW, with modern silhouettes, proportions, shoe shapes and finish — but still REAL, WEARABLE everyday fashion, NOT extreme runway looks.

Lines and proportions must flatter this exact body type. Photorealistic fashion photography quality, with identical framing, lighting and background across all three cells. NO text, NO captions, NO labels, NO logos, NO watermarks anywhere on the image — only the three outfit photos in one horizontal row.'''

    return prompt