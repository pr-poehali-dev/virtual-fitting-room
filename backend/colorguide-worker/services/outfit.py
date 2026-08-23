"""Сервис 'Подбор образов' (service_type='outfit').

Главный премиальный сервис: пользователь загружает фото в полный рост и заполняет
необязательные параметры (типаж по Кибби, архетипы по Юнгу, цветотип, волосы, глаза,
пол, сезон/погода, повод, теги-эффекты, комментарий). Из заполненных параметров
строится промпт для нейросети, которая подбирает ОДИН цельный образ:
одежду, обувь, украшения, аксессуары, макияж, причёску — по трендам текущего года.

Конвейер: Qwen3-VL Thinking анализирует фото + параметры -> русский JSON ->
данные подставляются в промпт для nano-banana-2 -> картинка 3:2
(в центре персона в образе, по бокам отдельные элементы образа).

Отличия от style.py:
- USE_QWEN = True  -> worker вызывает Qwen3-VL Thinking и парсит JSON из ответа
  (а не строгую json_schema, т.к. thinking-модель отдаёт reasoning + JSON).
- ASPECT_RATIO = '3:2'.
- build_image_prompt собирает раскладку "персона + элементы по бокам".
"""

from datetime import datetime

# Текстовая модель: свежий мультимодальный Qwen с reasoning.
QWEN_MODEL = 'qwen/qwen3-vl-235b-a22b-thinking'

# Флаг для worker: использовать Qwen (без strict json_schema, с парсингом JSON из ответа).
USE_QWEN = True
GEMINI_MODEL = QWEN_MODEL  # имя поля сохранено для совместимости вызова в worker

# Логотип на картинку не добавляем.
LOGO_IMAGE_URL = None

# Соотношение сторон итоговой картинки: 3:2 (центр — персона, по бокам элементы образа).
ASPECT_RATIO = '3:2'


def _season_years() -> str:
    """Текущий и следующий год — чтобы промпт не устаревал (например, '2026-2027')."""
    y = datetime.now().year
    return f'{y}-{y + 1}'


# Человекочитаемые подписи для параметров формы (используются при сборке промпта).
def build_params_block(form_params: dict) -> str:
    """Собирает текстовый блок ТОЛЬКО из заполненных параметров формы.
    Пустые/незаполненные поля пропускаются."""
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

    add('Пол', form_params.get('gender'))
    add('Рост (см)', form_params.get('height'))
    add('Типаж по Дэвиду Кибби', form_params.get('kibbe'))
    add('Архетип(ы) по Карлу Юнгу', form_params.get('archetypes'))
    add('Цветотип внешности', form_params.get('colortypes'))
    add('Длина волос', form_params.get('hair_length'))
    add('Цвет волос', form_params.get('hair_color'))
    add('Цвет глаз', form_params.get('eye_color'))
    add('Сезон / погода для образа', form_params.get('season'))
    add('Повод / куда собирается', form_params.get('occasion'))
    add('Знак зодиака', form_params.get('zodiac'))
    add('Желаемые акценты (теги)', form_params.get('tags'))
    add('Цвета, которые НРАВЯТСЯ (используй их в образе)', form_params.get('favorite_colors'))
    add('Цвета, которые НЕ НРАВЯТСЯ (НЕ используй их)', form_params.get('disliked_colors'))
    add('Ткани, которые НРАВЯТСЯ (отдавай им предпочтение)', form_params.get('favorite_fabrics'))
    add('Ткани, которые НЕ НРАВЯТСЯ (избегай их)', form_params.get('disliked_fabrics'))
    add('Орнаменты, которые НРАВЯТСЯ', form_params.get('favorite_patterns'))
    add('Орнаменты, которые НЕ НРАВЯТСЯ (избегай их)', form_params.get('disliked_patterns'))
    add('Предпочтения по длине юбок (для женских образов)', form_params.get('skirt_length'))
    add('Примерный возраст для образа (ориентируйся на него по уместности фасонов)', form_params.get('style_age'))
    add('Комментарий клиента', form_params.get('comment'))

    if not lines:
        return ''
    return 'ПАРАМЕТРЫ ОТ КЛИЕНТА (учитывай все указанные ниже, не указанные — не выдумывай):\n' + '\n'.join(lines)


GEMINI_PROMPT = '''Ты — топовый персональный стилист-имиджмейкер мирового уровня с 15-летним опытом. К тебе пришёл клиент за индивидуальным подбором ОДНОГО идеального образа. Работай как настоящий профессионал: сначала ВНИМАТЕЛЬНО изучи самого человека на фото, затем учти параметры, которые он указал, и собери для него один цельный, продуманный, актуальный образ.

КРИТИЧЕСКИ ВАЖНО про одежду на фото: НЕ ориентируйся на ту одежду, цвета, фасоны и степень нарядности, что СЕЙЧАС надеты на человеке — это случайный наряд для фото, а не указание, что ему идёт. Смотри на САМОГО человека: лицо, колорит, фигуру, пропорции, рост, энергетику. Из этого и из указанных параметров выводи рекомендации.

ПОРЯДОК АНАЛИЗА (рассуждай как стилист):
1) ВНЕШНОСТЬ И КОЛОРИТ: подтон кожи (тёплый/холодный/нейтральный), цвет волос и глаз, контрастность внешности.
2) ФИГУРА И ПРОПОРЦИИ: внимательно оцени костяк, плечи, баланс верха/низа, талию, рост, масштаб. Если указан типаж по Кибби — опирайся на него; если нет — определи линии фигуры сам. Из этого выводи силуэты, длины, крой, посадку.
3) ПАРАМЕТРЫ КЛИЕНТА: обязательно учти все указанные параметры (повод, сезон/погоду, архетипы, цветотип, желаемые акценты-теги, комментарий). Образ должен соответствовать поводу и погоде.
4) ВЫВОД: собери ОДИН цельный образ — одежда (верх, низ или платье, верхняя одежда по сезону), обувь, сумка, аксессуары, украшения, макияж, причёска.

ЖЁСТКИЕ ПРАВИЛА СТИЛЯ (соблюдай строго):
- Все вещи и обувь — из НОВЫХ коллекций ТЕКУЩЕГО года, по актуальным трендам сезона. Никаких устаревших фасонов 2010-х (скинни, узкие лодочки-шпильки, короткие тесные пиджаки), но и без экстремального подиума — реальная носибельная современная мода.
- НЕ ПИШИ КОНКРЕТНЫЕ ГОДЫ в описаниях (никаких "коллекция 2024", "тренд 2023 года" и т.п.). Пиши "текущий сезон", "новая коллекция этого сезона", "актуально сейчас".
- НЕ УКАЗЫВАЙ ЧИСЛОВЫЕ РАЗМЕРЫ вещей в сантиметрах и миллиметрах (длина шарфа, габариты сумки, диаметр часов, высота каблука и т.п.) — по картинке размеры всё равно не читаются, а описание засоряют. Вместо цифр описывай словами: длинный/короткий, компактная/вместительная, тонкий/массивный, каблук низкий/средний/высокий.
- В полях "clothing", "shoes", "bag", "accessories", "jewelry" описывай ТОЛЬКО ВИДИМОЕ ГЛАЗОМ: материал, фактуру, цвет, форму, фасон, длину, посадку. НЕ пиши обоснования и отсылки к другим вещам ("подчёркивает цвет глаз", "акцентирует линию лица", "цвет совпадает с обувью", "гармонирует с образом", "выгодно смотрится на фигуре") — это не нарисовать. Все объяснения, почему вещь идёт человеку, давай в "look_summary", "body_analysis" и "tips". Каждое описание предмета — 1-2 коротких предложения.
- СЕЗОН И ПОГОДА — ОБЯЗАТЕЛЬНО: ткань, плотность, длина рукава и слоёв должны соответствовать указанному сезону и погоде. Для ЛЕТА и жары — только лёгкие дышащие ткани (лён, хлопок, вискоза, тонкий шёлк, тонкий трикотаж), без шерсти, кашемира, плотного трикотажа, плотной верхней одежды и лишней многослойности. Для ХОЛОДА — наоборот, тёплые плотные ткани и уместный верх. Если сезон не указан — собирай образ для умеренной погоды.
- В одном образе НЕ БОЛЕЕ 3 цветов одежды, в пропорции 60-30-10 (основной 60%, дополнительный 30%, акцентный 10%).
- Все элементы образа должны сочетаться между собой ПО СТИЛЮ И ПО ЦВЕТУ — единый, гармоничный, законченный лук.
- ЛОГИКА ЦВЕТА АКСЕССУАРОВ, ОБУВИ И СУМКИ: цвета обуви, сумки, ремня и аксессуаров должны быть ЛОГИЧНЫ и УМЕСТНЫ для самого образа и повода. Для строгих, деловых, классических и тёмных образов сумка, обувь и ремень — в сдержанной, согласованной гамме (чёрный, тёмно-коричневый, графит, тёмно-синий), а НЕ контрастно-светлые и не случайные по цвету. ПРИМЕР НЕДОПУСТИМОГО: белая (светлая) сумка к строгому тёмному мужскому костюму — это грубая ошибка. Светлые, яркие и контрастные аксессуары уместны только в светлых, летних, casual или нарядных образах, где это осознанный акцент. Ремень и обувь по возможности согласуй между собой.
- Фасон, силуэт, длину и посадку каждой вещи подбирай строго под фигуру и рост человека.
- НАТУРАЛЬНЫЕ КАМНИ В УКРАШЕНИЯХ (ТОЛЬКО ДЛЯ ЖЕНСКИХ ОБРАЗОВ): если пол клиента ЖЕНСКИЙ и повод нарядный, торжественный, вечерний или особый (например, свидание, театр, выход в свет, праздник, вечеринка) — обязательно предложи хотя бы одно украшение с НАТУРАЛЬНЫМ камнем (например, лабрадорит, оникс, лунный камень, аметист, бирюза, малахит, гранат, цитрин, агат и т.п.), подобранным по колориту и цвету образа; укажи название камня в описании украшения. Для повседневных, casual и офисных образов камни НЕ обязательны — добавляй лаконичную минималистичную бижутерию/металл без камней, если так уместнее. Для МУЖСКИХ образов это правило НЕ применяется — камни мужчине НЕ предлагай.
- ЗНАК ЗОДИАКА: если указан знак зодиака клиента, можешь мягко и со вкусом учесть его эстетику и характер в образе (настроение, акценты, выбор камня) — но БЕЗ эзотерики, гороскопов и навязчивости; это лишь лёгкий штрих, а не основа образа.
- ПОЛ КЛИЕНТА — ОЧЕНЬ ВАЖНО: если пол клиента МУЖСКОЙ, собирай строго МУЖСКОЙ образ — мужской крой одежды, мужская обувь, мужские сумки и аксессуары; СТРОГО БЕЗ ЖЕНСКИХ ЭЛЕМЕНТОВ И ЖЕНСТВЕННЫХ ДЕТАЛЕЙ (никаких платьев, юбок, женского кроя, женственных тканей, декора, рюшей, бантов, каблуков, женских сумок-клатчей и т.п.). Для мужчины НЕ предлагай декоративный макияж: в поле "makeup" укажи "Макияж не требуется" и при желании добавь короткую рекомендацию по грумингу (уход за кожей, брови, борода/щетина) — но НИКАКИХ помад, теней, румян. Украшения и аксессуары для мужчины подбирай мужские и лаконичные, в минимальном количестве (например, наручные часы, лаконичная цепочка/браслет, ремень, очки). ДЛЯ МУЖЧИНЫ СТРОГО ЗАПРЕЩЕНО: украшения с камнями (любыми, в т.ч. натуральными), перстни и массивные декоративные кольца. Кольцо допустимо максимум одно — простое, лаконичное, БЕЗ камня. Если пол женский — собирай женский образ как обычно, с уместным макияжем.
- ПРОВЕРКА НА ЛОГИКУ ПЕРЕД ОТВЕТОМ (ОБЯЗАТЕЛЬНО): прежде чем выдать JSON, мысленно перепроверь весь собранный образ на здравый смысл и сочетаемость. Убедись, что КАЖДЫЙ элемент (одежда, обувь, сумка, ремень, аксессуары, украшения) логично подходит по ЦВЕТУ, СТИЛЮ и МАТЕРИАЛУ к остальному образу, к поводу, к сезону и к полу клиента. Если хоть один элемент выглядит нелогично или нелепо (например, неуместный по цвету или стилю предмет, светлая сумка к строгому тёмному костюму, летний аксессуар в зимнем образе и т.п.) — ЗАМЕНИ его на уместный, и только после этого формируй итоговый JSON.

Верни СТРОГО валидный JSON-объект по схеме ниже (и ничего, кроме JSON — без markdown-обёртки ```), на русском языке, конкретно и обоснованно:

{
  "identity": "2-4 слова — стилевая идентичность образа",
  "look_title": "короткое название образа (например, 'Романтический вечер')",
  "look_summary": "2-3 предложения — общее описание собранного образа и почему он идёт этому человеку и подходит поводу",
  "color_analysis": "2-4 предложения — разбор колорита внешности",
  "body_analysis": "2-4 предложения — фигура, пропорции, что подчёркиваем",
  "palette": [ {"name":"название цвета","hex":"#RRGGBB","role":"основной 60% / дополнительный 30% / акцент 10%"} ],  // ровно 3 цвета образа в пропорции 60-30-10
  "clothing": [ {"name":"название вещи","description":"ОБЯЗАТЕЛЬНО укажи материал/ткань (например, шерсть, кашемир, хлопок, лён, шёлк, вискоза, деним, кожа, замша, трикотаж и т.п.) и её фактуру (гладкая/рельефная/матовая/глянцевая, плотность); затем фасон, цвет, посадку — конкретно и современно"} ],  // 2-4 предмета одежды (верх/низ/платье/верхняя одежда)
  "shoes": {"name":"обувь","description":"актуальная модель сезона, ОБЯЗАТЕЛЬНО материал (кожа/замша/нубук/текстиль и т.п.) и фактура, цвет"},
  "bag": {"name":"сумка","description":"форма, размер, ОБЯЗАТЕЛЬНО материал (гладкая/зернистая кожа, замша, текстиль и т.п.) и фактура, цвет"},
  "accessories": [ {"name":"аксессуар","description":"что и как носить, ОБЯЗАТЕЛЬНО материал (кожа, металл, ткань, рог, дерево и т.п.) и фактура"} ],  // 2-3 аксессуара (ремень, очки, шляпа, платок и т.п.)
  "jewelry": [ {"name":"украшение","description":"ОБЯЗАТЕЛЬНО материал (металл и его оттенок: жёлтое/белое золото, серебро, сталь; для женщин при необходимости — камень), форма, фактура"} ],  // 2-3 украшения
  "makeup": {"description":"макияж под образ и колорит — тон, акценты, помада/тени/румяна"},
  "hairstyle": {"description":"причёска под образ, длину и тип волос клиента"},
  "tips": ["короткий практический совет стилиста"]  // ровно 5 советов
}

Будь точным и конкретным. Для каждой вещи, обуви, сумки, аксессуаров и украшений ОБЯЗАТЕЛЬНО указывай материал/ткань и её фактуру — это важно для точной отрисовки. Описывай так, чтобы по тексту можно было точно нарисовать актуальный образ этого года на человеке.'''


# Обязательные поля результата (для валидации полноты ответа Qwen)
REQUIRED_FIELDS = [
    'identity', 'look_title', 'look_summary', 'palette', 'clothing',
    'shoes', 'accessories', 'jewelry', 'makeup', 'hairstyle', 'tips'
]


def _join_descs(items):
    """Собрать строку 'name — description' из списка объектов."""
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


def _is_male(gender) -> bool:
    g = str(gender or '').strip().lower()
    return g in ('мужской', 'муж', 'male', 'm', 'мужчина', 'man')


def build_context_line(form_params: dict) -> str:
    """Строка контекста для рисующей модели: сезон/погода и повод из анкеты."""
    if not isinstance(form_params, dict):
        return ''
    bits = []
    season = str(form_params.get('season') or '').strip()
    occasion = str(form_params.get('occasion') or '').strip()
    if season:
        bits.append(f'season / weather: {season}')
    if occasion:
        bits.append(f'occasion: {occasion}')
    if not bits:
        return ''
    return (
        'CONTEXT — the look is worn for ' + '; '.join(bits) +
        '. Fabrics, layering and coverage must suit this weather and this occasion.\n\n'
    )


def build_image_prompt(data: dict, height: int = None, gender=None, form_params=None) -> str:
    """Промпт для nano-banana-2: картинка 3:2 — в центре персона в образе во весь рост,
    по бокам отдельно выложены элементы образа (украшения, аксессуары, обувь и т.п.)."""
    height_line = f'The person height is about {height} cm. ' if height else ''
    context_line = build_context_line(form_params)
    is_male = _is_male(gender)
    years = _season_years()

    person_word = 'man' if is_male else 'woman'
    pron_poss = 'his' if is_male else 'her'
    pron_obj = 'him' if is_male else 'her'
    pron_subj = 'he' if is_male else 'she'
    enhance_extra = '' if is_male else ', light tasteful makeup'

    hair_desc = _obj_desc(data.get('hairstyle'))
    hair_line = (
        f'HAIR — do the styling described here, on {pron_poss} own natural hair '
        f'(keep the real hair colour and length from the photo): {hair_desc}\n\n'
        if hair_desc else ''
    )
    shoes_desc = _obj_desc(data.get('shoes'))
    bag_desc = _obj_desc(data.get('bag'))
    accessories_desc = _join_descs(data.get('accessories'))
    jewelry_desc = _join_descs(data.get('jewelry'))
    makeup_desc = _obj_desc(data.get('makeup'))

    clothing_desc = _join_descs(data.get('clothing'))
    outfit_desc = f'ОДЕЖДА: {clothing_desc}' if clothing_desc else str(data.get('look_summary') or '').strip()

    side_items = []
    if jewelry_desc:
        side_items.append(f'jewelry ({jewelry_desc})')
    if accessories_desc:
        side_items.append(f'accessories ({accessories_desc})')
    if bag_desc:
        side_items.append(f'the bag ({bag_desc})')
    if shoes_desc:
        side_items.append(f'the shoes ({shoes_desc})')
    if is_male:
        # Для мужчины вместо косметического крупного плана — наручные часы.
        side_items.append('a close-up of an elegant wristwatch matching the outfit')
    elif makeup_desc and 'не требуется' not in makeup_desc.lower():
        side_items.append(f'a small makeup/beauty close-up ({makeup_desc})')
    side_block = '; '.join(side_items) if side_items else 'jewelry, accessories, the bag, the shoes'

    prompt = f'''Create ONE photorealistic fashion editorial image with aspect ratio 3:2 (wide).

PERSON — MOST IMPORTANT: take the {person_word} STRICTLY from the provided photo and keep {pron_poss} EXACT real face, facial features, face shape, hair colour and texture, skin tone and body proportions. Use {pron_poss} real appearance from the uploaded photo as the single source of truth — invent nothing, keep {pron_poss} ethnicity and real identity 100% intact, it must clearly and recognizably be the SAME real person, photorealistic, not illustrated. Show {pron_obj} at {pron_poss} very best: YOUNGER and FRESHER than in the photo, rested and radiant, smooth glowing firm skin, bright open eyes, healthy glow, well-groomed{enhance_extra} — a flattering beauty-editorial rendering of the same person. {height_line}

LAYOUT: In the CENTER — a single full-body photo of this {person_word} wearing ONE complete styled outfit, standing facing the camera. Along the LEFT and RIGHT edges — the very same items {pron_subj} is wearing, each IDENTICAL to the one on the person, shown separately as clean product-style still-life cut-outs, evenly spaced, not overlapping: {side_block}. Modern lookbook / styling moodboard composition on a soft neutral light-grey/beige seamless background, natural soft lighting. No text, no captions, no labels, no logos, no color swatches.

THE OUTFIT on the person — FOLLOW THIS DESCRIPTION LITERALLY, item by item: render every garment exactly with the stated colour, fabric, texture, cut and length. Do not substitute, simplify, recolour or "interpret" anything, do not add items that are not described: {outfit_desc}

{pron_subj.capitalize()} is ALSO wearing, on the body, exactly the same shoes, bag, accessories and jewelry that are listed above in the LAYOUT section — same colours, materials and shapes, worn naturally as part of the look.

{hair_line}{context_line}FASHION ERA — VERY IMPORTANT: everything must look like the NEWEST {years} current-season collections, in stores and trending RIGHT NOW — never like the 2010s and never like a past season. Real, wearable fashion, NOT extreme avant-garde runway. Keep the exact garment types, cuts and lengths from the description above — do not swap them for other items; make them look like the current-year version of that item, with modern proportions, modern shoe shapes and heel heights, and a modern finish, never a dated one. Fit each garment exactly as described: fitted stays close to the body, loose stays loose. Paired parts (both sleeves, both trouser legs, both shoes) are always identical in length and volume — asymmetry ONLY where the description explicitly names it. Hair, makeup and styling must read as modern and current too. Use no more than 3 colors in the outfit, harmonized in a 60-30-10 proportion.

REQUIREMENTS: one cohesive head-to-toe look. The whole image is a single clean styling board: center person + side elements, nothing else.'''

    return prompt