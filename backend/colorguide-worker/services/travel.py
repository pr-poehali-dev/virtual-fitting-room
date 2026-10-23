"""Сервис 'Капсула в путешествие' (service_type='travel').

Пользователь загружает фото в полный рост и заполняет анкету о себе (как в подборе
образа) плюс данные о поездке: куда, когда, на сколько дней, откуда летит и какая
там погода, как и сколько добирается, чем будет заниматься, какой багаж.

Нейросеть собирает капсульный гардероб в поездку: описание климата и идеи,
что надеть в дорогу, список вещей по категориям и 3 образа. Затем рисуется
одна картинка 3:2 — тот же человек в трёх образах рядом.

Ответ просим КРАТКИМ: он длиннее, чем у одного образа, а время работы функции
ограничено (оборванный ответ дописывается следующим заходом, но чем короче —
тем быстрее и надёжнее).
"""

from services.outfit import (
    QWEN_MODEL,
    _season_years,
    _is_male,
)

PARAMS_READING_RULES = '''КАК ЧИТАТЬ АНКЕТУ:
- АРХЕТИП(Ы) — характер и настроение капсулы: энергетика, смелость, уровень декоративности.
- ТИПАЖ ПО КИББИ — линии и крой: силуэты, длины, структурность или мягкость, масштаб деталей.
- ЛЮБИМЫЕ ТКАНИ, ЦВЕТА, ОРНАМЕНТЫ — используй реально (если ткань не по климату — найди сезонный аналог). Нелюбимое — исключай.
- ТЕГИ И КОММЕНТАРИЙ — прямые пожелания, учитывай в первую очередь.
Капсула должна быть цельной и явно персональной, а не универсальной.'''

USE_QWEN = True
GEMINI_MODEL = QWEN_MODEL
LOGO_IMAGE_URL = None
ASPECT_RATIO = '3:2'
PARAMS_FIRST = True
TEMPERATURE = 0.8


def build_params_block(form_params: dict) -> str:
    """Анкета клиента и данные о поездке — только заполненные поля."""
    if not form_params or not isinstance(form_params, dict):
        return ''

    def collect(pairs):
        out = []
        for label, key in pairs:
            value = form_params.get(key)
            if value is None:
                continue
            if isinstance(value, (list, tuple)):
                vals = [str(v).strip() for v in value if str(v or '').strip()]
                if vals:
                    out.append(f'- {label}: {", ".join(vals)}')
            else:
                s = str(value).strip()
                if s:
                    out.append(f'- {label}: {s}')
        return out

    trip = collect([
        ('Куда едет', 'destination'),
        ('Когда (месяц / сезон поездки)', 'trip_season'),
        ('Сколько дней', 'trip_days'),
        ('Откуда выезжает', 'departure_city'),
        ('Погода в месте вылета сейчас', 'departure_weather'),
        ('Как добирается', 'transport'),
        ('Сколько времени в дороге', 'travel_time'),
        ('Чем будет заниматься', 'activities'),
        ('Багаж', 'luggage'),
    ])
    person = collect([
        ('Пол', 'gender'),
        ('Рост (см)', 'height'),
        ('Типаж по Дэвиду Кибби', 'kibbe'),
        ('Архетип(ы) по Карлу Юнгу', 'archetypes'),
        ('Цветотип внешности', 'colortypes'),
        ('Длина волос', 'hair_length'),
        ('Цвет волос', 'hair_color'),
        ('Цвет глаз', 'eye_color'),
        ('Желаемые акценты (теги)', 'tags'),
        ('Цвета, которые НРАВЯТСЯ', 'favorite_colors'),
        ('Цвета, которые НЕ НРАВЯТСЯ (не используй)', 'disliked_colors'),
        ('Ткани, которые НРАВЯТСЯ', 'favorite_fabrics'),
        ('Ткани, которые НЕ НРАВЯТСЯ (избегай)', 'disliked_fabrics'),
        ('Орнаменты, которые НРАВЯТСЯ', 'favorite_patterns'),
        ('Орнаменты, которые НЕ НРАВЯТСЯ (избегай)', 'disliked_patterns'),
        ('Предпочтения по длине юбок', 'skirt_length'),
        ('Примерный возраст для образа', 'style_age'),
        ('Комментарий клиента', 'comment'),
    ])

    if not trip and not person:
        return ''

    parts = ['ЭТО ГЛАВНОЕ В ЗАДАЧЕ — ДАННЫЕ О ПОЕЗДКЕ И О КЛИЕНТЕ. '
             'Они важнее общих правил ниже. Не указанные параметры — не выдумывай.']
    if trip:
        parts.append('ПОЕЗДКА:\n' + '\n'.join(trip))
    if person:
        parts.append('КЛИЕНТ:\n' + '\n'.join(person))
    parts.append(PARAMS_READING_RULES)
    return '\n\n'.join(parts)


GEMINI_PROMPT = '''Ты — опытный персональный стилист. Клиент едет в поездку и просит собрать ему КАПСУЛЬНЫЙ ГАРДЕРОБ: что взять с собой, что надеть в дорогу и какие образы из этого собрать. Изучи человека на фото (колорит, фигуру, пропорции; НЕ ориентируйся на одежду, которая сейчас на нём), учти анкету и данные о поездке.

ЧТО УЧЕСТЬ ОБЯЗАТЕЛЬНО:
- КЛИМАТ места назначения в указанный месяц/сезон (типичная дневная и вечерняя температура, осадки, солнце, ветер). Опирайся на свои знания о климате, без выдумок про точный прогноз.
- ДОРОГА: длительность и транспорт. Если клиент едет из холода в жару (или наоборот) — продумай многослойный образ в дорогу: что снять и куда убрать по прилёту. Для долгой дороги — удобство, немнущиеся ткани, слои против кондиционера.
- ЗАНЯТИЯ: под каждое выбранное занятие (экскурсии, пляж, шопинг, рестораны и т.д.) в капсуле должны быть подходящие вещи и обувь.
- КОЛИЧЕСТВО вещей — по числу дней и багажу. Вещи должны сочетаться между собой, чтобы из малого собрать много образов. Ручная кладь — строгий минимум.
- Цветотип, типаж по Кибби, архетип, любимые/нелюбимые цвета, ткани и орнаменты — как в индивидуальном подборе образа. Капсула — в единой палитре, подходящей колориту клиента.
- Пол: для мужчины — строго мужская одежда, без макияжа и украшений с камнями.
- Актуальная современная мода текущего сезона, без конкретных годов в тексте.

ПИШИ КРАТКО: без воды, повторов и общих фраз, но не упуская сути. Списки — короткими строками.

Верни СТРОГО валидный JSON (без markdown-обёртки ```), на русском языке:

{
  "trip_title": "короткое название капсулы, 2-5 слов",
  "trip_summary": "2-3 предложения — общая идея капсулы и почему она подходит этому человеку и поездке",
  "climate": "2-3 предложения — какая погода ждёт в месте назначения в эти даты и что из этого следует для гардероба",
  "personal_fit": "2-3 предложения — как в капсуле учтены цветотип, типаж, архетип и предпочтения клиента",
  "palette": [ {"name":"название цвета","hex":"#RRGGBB"} ],  // 4-5 цветов капсулы
  "travel_day": {
    "title": "Образ в дорогу",
    "description": "2-4 предложения — что надеть в дорогу с учётом транспорта, длительности и разницы погоды; что снять/добавить по прибытии",
    "items": [ {"name":"вещь","description":"материал, цвет, фасон, длина — 1 короткое предложение"} ]  // 4-7 предметов, включая обувь и сумку
  },
  "packing_list": [
    {"category":"название категории","items":[ {"name":"вещь","qty":"количество, например '2 шт.'","note":"очень коротко: материал/цвет или зачем"} ]}
  ],  // категории: Одежда, Верхняя одежда (если нужна), Обувь, Для пляжа (если нужно), Сумки, Аксессуары, Украшения, Косметика и уход, Полезные мелочи — только уместные
  "looks": [
    {"title":"название образа","occasion":"для какого занятия","description":"1-2 предложения — настроение и почему так",
     "items":[ {"name":"вещь","description":"материал, цвет, фасон, длина — 1 короткое предложение"} ]}  // 4-7 предметов, включая обувь, сумку, аксессуары
  ],  // РОВНО 3 образа: первый — образ в дорогу (тот же, что travel_day), второй и третий — под главные занятия поездки (например, днём на экскурсии и вечером в ресторан, или пляж). Все вещи образов — из packing_list
  "tips": ["короткий практический совет по сборам и носке"]  // 3-5 советов
}

В описаниях вещей в "items" пиши ТОЛЬКО видимое глазом: материал, фактура, цвет, фасон, длина относительно тела. Без обоснований — их место в summary и tips.'''


REQUIRED_FIELDS = ['trip_title', 'trip_summary', 'packing_list', 'looks']


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
    """Картинка 3:2: тот же человек в трёх образах капсулы рядом."""
    is_male = _is_male(gender)
    person_word = 'man' if is_male else 'woman'
    pron_poss = 'his' if is_male else 'her'
    height_line = f'The person height is about {height} cm. ' if height else ''
    years = _season_years()

    looks = [lk for lk in (data.get('looks') or []) if isinstance(lk, dict)][:3]
    positions = ['LEFT', 'CENTER', 'RIGHT']
    looks_lines = []
    for idx, look in enumerate(looks):
        title = str(look.get('title') or '').strip()
        occasion = str(look.get('occasion') or '').strip()
        label = ' — '.join([t for t in (title, occasion) if t])
        looks_lines.append(
            f'{positions[idx]} figure ({label}): {_items_desc(look.get("items"))}'
        )
    looks_block = '\n'.join(looks_lines) or str(data.get('trip_summary') or '')

    destination = ''
    if isinstance(form_params, dict):
        destination = str(form_params.get('destination') or '').strip()
    climate_line = (
        f'The trip destination is {destination}; outfits suit its weather. ' if destination else ''
    )

    return f'''Create ONE photorealistic fashion editorial image with aspect ratio 3:2 (wide): a travel capsule wardrobe lookbook.

PERSON — MOST IMPORTANT: take the {person_word} STRICTLY from the provided photo — {pron_poss} EXACT real face, facial features, face shape, hair colour and texture, skin tone and body proportions must stay 100% intact, including {pron_poss} ethnicity; it must clearly be the SAME real person, photorealistic, not illustrated, looking fresh, rested and well-groomed. {height_line}

LAYOUT: THREE full-body figures of this SAME person standing side by side (left, center, right), evenly spaced, full height from head to shoes visible, each wearing a DIFFERENT complete outfit from the capsule below. All three figures are the same person with the same face and body. Clean seamless soft neutral light background, the same tone across the whole image, natural soft light. No text, no captions, no labels, no logos.

THE THREE OUTFITS — follow each description literally, item by item (colour, fabric, cut, length), do not swap or add items:
{looks_block}

{climate_line}Everything looks like real, wearable NEWEST {years} current-season fashion, modern proportions and shoe shapes. Paired parts (sleeves, trouser legs, shoes) are identical. The three outfits share one harmonious colour palette as a capsule wardrobe.'''
