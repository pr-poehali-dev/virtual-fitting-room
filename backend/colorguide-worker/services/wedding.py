"""Сервис 'Свадебный образ' (service_type='wedding').

Один сервис для невесты и для жениха — роль выбирается в анкете (form_params['role']).
Клиент загружает фото в полный рост и заполняет анкету: сезон и место свадьбы,
формат торжества и дресс-код, архетипы, цветотип, типаж по Кибби, образ партнёра,
пожелания и ограничения. Нейросеть собирает ОДИН цельный свадебный образ.

Особый режим "от обратного": если клиент НЕ указал дресс-код/стиль торжества,
модель сама выводит стиль из того, что идёт человеку (для невесты — от фасона платья),
и явно указывает это в поле style_direction — чтобы под этот стиль подстроить
остальную свадьбу.

Конвейер такой же, как у outfit.py: Qwen3-VL Thinking -> русский JSON ->
промпт для nano-banana-2 -> картинка 3:2 (в центре персона в образе, по бокам элементы).
"""

from datetime import datetime

QWEN_MODEL = 'qwen/qwen3-vl-235b-a22b-thinking'

USE_QWEN = True
GEMINI_MODEL = QWEN_MODEL

LOGO_IMAGE_URL = None

ASPECT_RATIO = '3:2'


def _season_years() -> str:
    """Текущий и следующий год — чтобы промпт не устаревал (например, '2026-2027')."""
    y = datetime.now().year
    return f'{y}-{y + 1}'


def _is_groom(form_params) -> bool:
    role = str((form_params or {}).get('role') or '').strip().lower()
    return role.startswith('жених') or role in ('groom', 'мужской', 'мужчина')


def build_params_block(form_params: dict) -> str:
    """Собирает текстовый блок ТОЛЬКО из заполненных параметров анкеты."""
    if not form_params or not isinstance(form_params, dict):
        return ''

    lines = []

    def add(label, value):
        if value is None:
            return
        if isinstance(value, (list, tuple)):
            vals = [str(v).strip() for v in value if v not in (None, '')]
            if not vals:
                return
            lines.append(f'- {label}: {", ".join(vals)}')
        else:
            s = str(value).strip()
            if s:
                lines.append(f'- {label}: {s}')

    add('Для кого образ (роль на свадьбе)', form_params.get('role'))
    add('Рост (см)', form_params.get('height'))
    add('Примерный возраст', form_params.get('age'))
    add('Типаж по Дэвиду Кибби', form_params.get('kibbe'))
    add('Архетип(ы) по Карлу Юнгу', form_params.get('archetypes'))
    add('Цветотип внешности', form_params.get('colortypes'))
    add('Длина волос', form_params.get('hair_length'))
    add('Цвет волос', form_params.get('hair_color'))
    add('Цвет глаз', form_params.get('eye_color'))
    add('Сезон свадьбы', form_params.get('season'))
    add('Месяц свадьбы', form_params.get('month'))
    add('Место проведения', form_params.get('venue'))
    add('Город / страна / климат', form_params.get('location'))
    add('Время суток церемонии', form_params.get('day_time'))
    add('Стиль торжества / дресс-код (если указан — строго придерживайся его)',
        form_params.get('wedding_style'))
    add('Цветовая гамма свадьбы', form_params.get('wedding_colors'))
    add('Образ партнёра — описание клиента (согласуй образ с ним, чтобы пара смотрелась цельно)',
        form_params.get('partner_look'))
    if form_params.get('has_partner_photo'):
        lines.append('- Образ партнёра: приложен ВТОРЫМ фото — разбери по нему наряд партнёра '
                     '(цвета, ткани, фасон, уровень нарядности) и согласуй с ним образ клиента')
    add('Ткани, которые НРАВЯТСЯ', form_params.get('favorite_fabrics'))
    add('Ткани, которые НЕ НРАВЯТСЯ (избегай их)', form_params.get('disliked_fabrics'))
    add('Цвета, которые НРАВЯТСЯ', form_params.get('favorite_colors'))
    add('Цвета, которые НЕ НРАВЯТСЯ (НЕ используй их)', form_params.get('disliked_colors'))
    add('Желаемые акценты (теги)', form_params.get('tags'))
    add('Силуэт / фасон платья (для невесты)', form_params.get('dress_silhouette'))
    add('Что хочется подчеркнуть в фигуре', form_params.get('highlight'))
    add('Что хочется скрыть / прикрыть', form_params.get('hide'))
    add('Ограничения и особые требования (традиции, закрытые плечи, комфорт и т.п.)',
        form_params.get('restrictions'))
    add('Бюджет на образ, ₽', form_params.get('budget'))
    add('Комментарий клиента', form_params.get('comment'))

    style_set = str((form_params or {}).get('wedding_style') or '').strip()
    mode = str((form_params or {}).get('style_mode') or '').strip()

    tail = ''
    if not style_set or mode.lower().startswith('от обратного'):
        tail = (
            '\n\nВАЖНО — РЕЖИМ «ОТ ОБРАТНОГО»: клиент НЕ задал стиль торжества и дресс-код. '
            'Определи их САМ, отталкиваясь от человека: от его внешности, фигуры, колорита и '
            'от того фасона (для невесты — фасона платья, для жениха — кроя костюма), который ему '
            'максимально идёт. Сначала выбери, что человеку объективно к лицу, а затем выведи из '
            'этого стиль свадьбы целиком и обязательно опиши его в поле "style_direction": какой '
            'стиль торжества, палитра, декор и общее настроение свадьбы будут органично сочетаться '
            'с этим образом. Это будет отправной точкой для организации всей свадьбы.'
        )
    else:
        tail = (
            '\n\nСтиль торжества клиентом ЗАДАН — строго придерживайся его во всём образе. '
            'В поле "style_direction" кратко подтверди выбранный стиль и объясни, как образ '
            'вписан в него.'
        )

    if not lines:
        return tail.strip()
    return ('ПАРАМЕТРЫ ОТ КЛИЕНТА (учитывай все указанные ниже, не указанные — не выдумывай):\n'
            + '\n'.join(lines) + tail)


GEMINI_PROMPT = '''Ты — топовый свадебный стилист-имиджмейкер мирового уровня с 15-летним опытом подготовки свадеб. К тебе пришёл клиент за подбором СВАДЕБНОГО образа — для невесты или для жениха (роль указана в параметрах). Собери ОДИН цельный, продуманный, современный свадебный образ, идеально подходящий именно этому человеку.

КРИТИЧЕСКИ ВАЖНО про одежду на фото: НЕ ориентируйся на ту одежду, что СЕЙЧАС надета на человеке — это случайный наряд для фото. Смотри на САМОГО человека: лицо, колорит, фигуру, пропорции, рост, энергетику.

ПОРЯДОК АНАЛИЗА (рассуждай как свадебный стилист):
1) ВНЕШНОСТЬ И КОЛОРИТ: подтон кожи (тёплый/холодный/нейтральный), цвет волос и глаз, контрастность. Отсюда выводи ОТТЕНОК БЕЛОГО или основного цвета наряда — это ключевое решение свадебного образа (чистый белый, айвори, шампань, пудровый, слоновая кость, молочный; для жениха — оттенок костюма и рубашки). Неверный оттенок белого делает лицо болезненным — подбери строго под колорит.
2) ФИГУРА И ПРОПОРЦИИ: костяк, плечи, баланс верха и низа, талия, рост, масштаб. Если указан типаж по Кибби — опирайся на него. Из этого выводи силуэт платья или крой костюма, длину, посадку, декольте, линию талии.
3) ОБСТОЯТЕЛЬСТВА СВАДЬБЫ: обязательно учти сезон, месяц, место проведения (улица, зал, пляж, усадьба, ресторан), климат и время суток. Образ должен быть КОМФОРТНЫМ и УМЕСТНЫМ: летом на улице — лёгкие дышащие ткани, зимой — тёплый верх и уместная накидка, на природе и пляже — устойчивая обувь без тонкой шпильки, для церкви — уместная закрытость.
4) СТИЛЬ ТОРЖЕСТВА: если дресс-код и стиль заданы — строго следуй им. Если НЕ заданы — определи их сам от того, что идёт человеку, и опиши в "style_direction".
5) ПАРА: если описан образ партнёра — согласуй образ с ним по стилю, уровню нарядности и палитре, чтобы пара смотрелась цельно на фотографиях. Не копируй партнёра буквально, а гармонично дополни.
6) ВЫВОД: собери ОДИН цельный образ со всеми деталями.

ЖЁСТКИЕ ПРАВИЛА (соблюдай строго):
- Всё — по актуальным свадебным трендам ТЕКУЩЕГО сезона, но носибельно и со вкусом, без карнавальности и без устаревших приёмов 2010-х (пышные юбки-торты с обручами, кринолин, стразы по всему платью, узкие лодочки-шпильки, тесные короткие пиджаки).
- НЕ ПИШИ КОНКРЕТНЫЕ ГОДЫ в описаниях (никаких "коллекция 2024", "тренд 2023 года"). Пиши "текущий сезон", "новая коллекция этого сезона", "актуально сейчас".
- НЕ УКАЗЫВАЙ ЧИСЛОВЫЕ РАЗМЕРЫ вещей в сантиметрах и миллиметрах (длина фаты и шлейфа, габариты клатча, диаметр часов, высота каблука и т.п.) — на картинке они всё равно не читаются, а описание засоряют. Описывай словами: длинная/короткая, компактный/вместительный, тонкий/массивный, каблук низкий/средний/высокий.
- В полях с предметами ("outfit", "shoes", "headpiece", "accessories", "jewelry") описывай ТОЛЬКО ВИДИМОЕ ГЛАЗОМ: материал, фактуру, цвет, форму, фасон, длину, посадку. НЕ пиши обоснования и отсылки к другим вещам ("подчёркивает цвет глаз", "сочетается с фатой", "цвет совпадает с обувью", "выгодно смотрится на фигуре") — это не нарисовать. Объяснения давай в "look_summary" и "tips". Каждое описание предмета — 1-2 коротких предложения.
- Образ должен быть КОМФОРТНЫМ: свадебный день длится 10-14 часов. Учитывай возможность двигаться, сидеть, танцевать и находиться на улице.
- ЦВЕТ: не более 3 цветов в образе, гармонично, в пропорции 60-30-10. Свадебная палитра должна согласовываться с цветовой гаммой торжества, если она указана.
- Каждый элемент — обувь, украшения, аксессуары, фата или бутоньерка — должен сочетаться с нарядом ПО СТИЛЮ, ЦВЕТУ и МАТЕРИАЛУ. Металл украшений согласуй с колоритом и с деталями наряда.
- ЕСЛИ РОЛЬ — НЕВЕСТА: собери женский образ — платье (или костюм/комбинезон, если это уместнее по стилю), обувь, свадебное украшение для головы (фата, вуаль, венок, гребень, ободок — выбери уместное или обоснуй отказ), украшения, аксессуары (перчатки, накидка, клатч, букет по стилю), свадебный макияж (стойкий, фотогеничный, с учётом фото и слёз) и причёску под длину и тип волос. Обязательно предложи хотя бы одно украшение с уместным камнем или жемчугом, подобранным по колориту.
- ЕСЛИ РОЛЬ — ЖЕНИХ: собери строго МУЖСКОЙ образ — костюм (крой, лацканы, посадка), рубашка, галстук или бабочка (или обоснованный отказ от них), обувь, ремень, часы, запонки, бутоньерка, платок-паше, носки. СТРОГО БЕЗ ЖЕНСКИХ ЭЛЕМЕНТОВ. Декоративный макияж НЕ предлагай — в поле "makeup" укажи "Макияж не требуется" и дай короткую рекомендацию по грумингу (уход за кожей, брови, борода/щетина, стрижка за 3-5 дней до свадьбы). Украшения мужские и лаконичные, БЕЗ камней и перстней; кольцо максимум одно — простое, без камня. В поле "hairstyle" опиши мужскую укладку.
- ПРОВЕРКА ПЕРЕД ОТВЕТОМ (ОБЯЗАТЕЛЬНО): мысленно перепроверь весь образ на здравый смысл, комфорт, уместность сезону, месту и роли. Если хоть один элемент нелогичен (тонкая шпилька для выездной церемонии на траве, тяжёлый бархат в июльскую жару, открытые плечи для венчания при указанном ограничении) — ЗАМЕНИ его и только потом формируй JSON.

Верни СТРОГО валидный JSON-объект по схеме ниже (и ничего, кроме JSON — без markdown-обёртки ```), на русском языке, конкретно и обоснованно:

{
  "identity": "2-4 слова — стилевая идентичность свадебного образа",
  "look_title": "короткое название образа (например, 'Нежная классика на закате')",
  "look_summary": "2-3 предложения — описание собранного образа и почему он идёт этому человеку и подходит этой свадьбе",
  "style_direction": "3-5 предложений — стиль и дресс-код торжества: если клиент задал его — как образ в него вписан; если НЕ задал — какой стиль свадьбы, палитра, декор и настроение выводятся из этого образа и рекомендуются для всей свадьбы",
  "color_analysis": "2-4 предложения — разбор колорита внешности и ОБОСНОВАНИЕ выбранного оттенка белого или основного цвета наряда",
  "body_analysis": "2-4 предложения — фигура, пропорции, какой силуэт и крой выбран и почему",
  "palette": [ {"name":"название цвета","hex":"#RRGGBB","role":"основной 60% / дополнительный 30% / акцент 10%"} ],
  "outfit": [ {"name":"название вещи (платье / костюм / рубашка / накидка и т.п.)","description":"ОБЯЗАТЕЛЬНО материал и фактура ткани (шёлк, атлас, креп, кружево, фатин, шерсть, лён и т.п.), силуэт, крой, длина, посадка, цвет и оттенок — конкретно и современно"} ],
  "shoes": {"name":"обувь","description":"модель, ОБЯЗАТЕЛЬНО материал и фактура, цвет, высота и устойчивость каблука с учётом места церемонии"},
  "headpiece": {"name":"фата / украшение для головы (для невесты) или его отсутствие; для жениха — бутоньерка","description":"вид, длина, материал, как сочетается с причёской и нарядом"},
  "accessories": [ {"name":"аксессуар","description":"что и как носить, материал и фактура"} ],
  "jewelry": [ {"name":"украшение","description":"ОБЯЗАТЕЛЬНО металл и его оттенок, камень или жемчуг для невесты, форма и фактура"} ],
  "makeup": {"description":"стойкий фотогеничный свадебный макияж под образ и колорит; для жениха — 'Макияж не требуется' + груминг"},
  "hairstyle": {"description":"причёска под образ, длину и тип волос, с учётом фаты и погоды"},
  "partner_harmony": "2-3 предложения — как этот образ сочетается с образом партнёра и что стоит согласовать в паре (если данных о партнёре нет — общие рекомендации по согласованию)",
  "comfort_notes": ["практичная заметка о комфорте и погоде"],
  "tips": ["короткий практический совет свадебного стилиста"],
  "image_outfit_desc": "ОДНО подробное предложение на РУССКОМ, описывающее весь свадебный образ целиком (наряд сверху донизу + обувь + головной убор), как он выглядит надетым на человеке — для художника. Для КАЖДОЙ вещи ОБЯЗАТЕЛЬНО укажи материал, фактуру, точный оттенок и фасон"
}

В "comfort_notes" дай 3 заметки, в "tips" — ровно 5 советов. Будь точным и конкретным: для каждой вещи, обуви, аксессуаров и украшений обязательно указывай материал и фактуру — это нужно для точной отрисовки.'''


REQUIRED_FIELDS = [
    'identity', 'look_title', 'look_summary', 'style_direction', 'palette',
    'outfit', 'shoes', 'accessories', 'jewelry', 'makeup', 'hairstyle', 'tips'
]


def _join_descs(items):
    out = []
    for it in items or []:
        if isinstance(it, dict):
            name = str(it.get('name', '')).strip()
            desc = str(it.get('description', '')).strip()
            if name and desc:
                out.append(f'{name} ({desc})')
            elif name:
                out.append(name)
            elif desc:
                out.append(desc)
        elif it:
            out.append(str(it))
    return ', '.join(out)


def _obj_desc(obj):
    if isinstance(obj, dict):
        name = str(obj.get('name', '')).strip()
        desc = str(obj.get('description', '')).strip()
        return f'{name} ({desc})' if name and desc else (name or desc)
    return str(obj or '')


def _is_male_role(gender) -> bool:
    g = str(gender or '').strip().lower()
    return g.startswith('жених') or g in ('мужской', 'муж', 'male', 'm', 'мужчина', 'man', 'groom')


def build_image_prompt(data: dict, height: int = None, gender=None) -> str:
    """Промпт для nano-banana-2: картинка 3:2 — в центре персона в свадебном образе
    во весь рост, по бокам отдельно выложены элементы образа."""
    height_line = f'The person height is about {height} cm. ' if height else ''
    is_male = _is_male_role(gender)
    years = _season_years()

    person_word = 'groom (man)' if is_male else 'bride (woman)'
    pron_poss = 'his' if is_male else 'her'
    pron_obj = 'him' if is_male else 'her'
    pron_subj = 'he' if is_male else 'she'
    enhance_extra = '' if is_male else ', tasteful long-lasting bridal makeup'

    outfit_desc = str(data.get('image_outfit_desc') or data.get('look_summary') or '').strip()
    hair_desc = _obj_desc(data.get('hairstyle'))
    hair_line = (
        f'HAIR — do the bridal styling described here, on {pron_poss} own natural hair '
        f'(keep the real hair colour and length from the photo): {hair_desc}\n\n'
        if hair_desc else ''
    )
    shoes_desc = _obj_desc(data.get('shoes'))
    headpiece_desc = _obj_desc(data.get('headpiece'))
    accessories_desc = _join_descs(data.get('accessories'))
    jewelry_desc = _join_descs(data.get('jewelry'))
    makeup_desc = _obj_desc(data.get('makeup'))

    side_items = []
    if jewelry_desc:
        side_items.append(f'jewelry ({jewelry_desc})')
    if headpiece_desc:
        label = 'the boutonniere' if is_male else 'the veil / headpiece'
        side_items.append(f'{label} ({headpiece_desc})')
    if accessories_desc:
        side_items.append(f'accessories ({accessories_desc})')
    if shoes_desc:
        side_items.append(f'the shoes ({shoes_desc})')
    if is_male:
        side_items.append('a close-up of elegant cufflinks and a wristwatch matching the suit')
    elif makeup_desc and 'не требуется' not in makeup_desc.lower():
        side_items.append(f'a small bridal makeup/beauty close-up ({makeup_desc})')
    side_block = '; '.join(side_items) if side_items else 'jewelry, accessories, the shoes'

    prompt = f'''Create ONE photorealistic WEDDING fashion editorial image with aspect ratio 3:2 (wide).

PERSON — MOST IMPORTANT: take the person STRICTLY from the provided photo and keep {pron_poss} EXACT real face, facial features, face shape, hair colour and texture, skin tone and body proportions. Use {pron_poss} real appearance from the uploaded photo as the single source of truth — invent nothing, keep {pron_poss} ethnicity and real identity 100% intact, it must clearly and recognizably be the SAME real person, photorealistic, not illustrated. Show {pron_obj} at {pron_poss} very best on the wedding day: YOUNGER and FRESHER than in the photo, rested and radiant, smooth glowing firm skin, bright open eyes, healthy glow, well-groomed{enhance_extra} — a flattering bridal-editorial rendering of the same person. {height_line}

LAYOUT: In the CENTER — a single full-body photo of this {person_word} wearing ONE complete wedding look, standing facing the camera. Along the LEFT and RIGHT edges — the very same items {pron_subj} is wearing, each IDENTICAL to the one on the person, shown separately as clean product-style still-life cut-outs, evenly spaced, not overlapping: {side_block}. Elegant bridal lookbook / styling moodboard composition on a soft neutral light-grey/ivory seamless background, natural soft lighting. No text, no captions, no labels, no logos, no color swatches.

THE WEDDING LOOK on the person — FOLLOW THIS DESCRIPTION LITERALLY, item by item: render every garment exactly with the stated colour, fabric, texture, cut and length. Do not substitute, simplify, recolour or "interpret" anything, do not add items that are not described. The exact shade of white/ivory/champagne (or the suit colour) MUST match the description precisely: {outfit_desc}

{hair_line}STYLE ERA — VERY IMPORTANT: everything must look like the NEWEST {years} bridal collections, elegant and refined, trending RIGHT NOW — never like the 2010s and never like a past season. Fit each garment exactly as described: fitted stays close to the body, flowing stays flowing. AVOID: huge hooped ball-gown skirts, all-over rhinestones, thin stiletto pumps, tight short blazers, costume-like or theatrical looks. Hair, makeup and styling must read as modern and current too. Use no more than 3 colours, harmonized 60-30-10.

REQUIREMENTS: one cohesive head-to-toe wedding look. The whole image is a single clean styling board: center person + side elements, nothing else.'''

    return prompt