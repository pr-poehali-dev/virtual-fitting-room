"""Сборка промпта расклада: общий движок для всех колод и раскладов."""

from .decks import get_deck
from .spreads import get_spread

PERIOD_LABELS = {
    'now': 'на текущий момент (сейчас, сегодня)',
    'week': 'на ближайшую неделю',
    'month': 'на ближайший месяц',
    '3months': 'на ближайшие 3 месяца',
    '6months': 'на ближайшие 6 месяцев',
    'year': 'на ближайший год',
}

GENDER_LABELS = {
    'female': 'для женщины',
    'male': 'для мужчины',
}

SPHERE_LABELS = {
    'outfit': 'как одеваться, какой стиль выбирать (образ, гардероб)',
    'relationships': 'личные отношения',
    'career': 'профессиональная деятельность',
    'finance': 'финансы и деньги',
    'beauty': 'персональные рекомендации по моде, стилю и красоте',
    'all': 'все сферы жизни',
}

ROLE_INTRO = (
    'Ты — опытный профессиональный таролог и мастер карт Ленорман. '
    'Сделай подробную, тёплую и бережную трактовку расклада. '
    'Трактуй по классическим правилам чтения такого расклада.'
)

# Тон разговора: добрый и человечный, но без приторности
TONE_RULES = (
    'ТОН РАЗГОВОРА. Говори с добротой и по-человечески, как понимающий '
    'собеседник. Без слащавости и без дежурных утешений. Уместный искренний '
    'комплимент — хорошо, он поддержит человека, но не рассыпайся '
    'в любезностях. Тепло — в том, что ты честен и говоришь по существу.'
)

# Правило завершённости: ориентир по объёму не должен рвать мысль
COMPLETENESS_RULE = (
    'Уложись в ориентир по объёму, но мысль всегда доводи до конца — '
    'обрывать ответ на середине нельзя. Лаконично не значит поверхностно: '
    'лучше убрать воду и повторы, чем суть. Текст должен выглядеть '
    'законченным, и человек должен уловить главное.'
)

# Как вести себя с человеком: расклад — повод для размышления,
# а не приговор. Отдельно — про чувствительные вопросы.
CARE_RULES = (
    'КАК РАЗГОВАРИВАТЬ С ЧЕЛОВЕКОМ.\n'
    'Прежде чем отвечать, пойми, зачем человек пришёл. Чаще всего — '
    'за поддержкой, самоанализом и подсказкой: тогда говори свободно, '
    'тепло и по существу.\n\n'
    'Но бывают вопросы, где твой ответ может ранить или подтолкнуть '
    'к необдуманному: тревога о здоровье, о жизни близких, о том, '
    'сбудется ли долгожданное и очень болезненное для человека. '
    'Различай это по вопросу и по тому, что стоит за ним. В таких случаях '
    'не давай прямых утверждений и никаких сроков. Разверни разговор '
    'на то, что человек сейчас чувствует, что его тревожит и на что он '
    'может опереться и повлиять. Мягко подскажи, что в таком вопросе '
    'рядом нужен живой специалист в этой области, и что карты его '
    'не заменят. Не отказывай в ответе и не читай нотаций: '
    'будь бережной и оставайся рядом.\n\n'
    'Всегда говори о вероятности, а не о судьбе: «карты показывают такой '
    'сценарий», «это один из возможных путей», «так может сложиться, если '
    'ничего не менять». Никогда — «так и будет», «это неизбежно». '
    'Подчёркивай, что расклад отражает состояние человека сейчас '
    'и даёт почву для размышления: карты — подсказки, а выводы человек '
    'делает сам, и многое зависит от его осознанности и готовности '
    'честно посмотреть на ситуацию.'
)

COMMON_RULES = (
    'Общие правила ответа:\n'
    '- пиши на русском языке, тёплым поддерживающим тоном;\n'
    '- не делай фатальных предсказаний, не пугай, не давай медицинских '
    'и юридических указаний;\n'
    '- давай связный анализ, а не сухое перечисление карт по позициям;\n'
    '- пиши без воды и повторов: каждая мысль должна что-то добавлять;\n'
    '- в конце обязательно дай практические СОВЕТЫ: что делать '
    'и на что обратить внимание. Совет подавай мягко, но по сути '
    'конкретно: ясно назови, что показывают карты и что с этим делать. '
    'Слова о том, чтобы прислушаться к себе и довериться интуиции, '
    'уместны — но рядом с ними всегда давай и конкретику.'
)


# Словарь ролей. Имена домов и имена карт — одни и те же 36 слов,
# поэтому модель их путает. Разводим термины явно и один раз.
LENORMAND_GLOSSARY = (
    'СЛОВАРЬ (запомни, дальше используй только эти слова).\n'
    '- МЕСТО — номер клетки на столе, от 1 до 36. Это не номер карты.\n'
    '- ДОМ — постоянная тема места. Дом никогда не двигается: '
    'место 25 всегда дом Кольца, что бы в нём ни лежало.\n'
    '- КАРТА — то, что выпало в этом месте. Карты каждый раз разные.\n'
    '- ВНИМАНИЕ: дома и карты называются одинаковыми словами. '
    '«Дом Кольца» и «карта Кольцо» — РАЗНЫЕ вещи. В одном месте '
    'всегда РОВНО ОДИН дом и РОВНО ОДНА карта, и они почти всегда '
    'называются по-разному.\n'
    '- КАК ПИСАТЬ: всегда в форме «карта Луна в доме Кольца». '
    'Сначала карта, потом дом. Никогда не пиши два названия подряд '
    'без слов «карта» и «дом».\n'
    '- СИГНИФИКАТОР — это САМА карта Женщина (для женщины) или '
    'сама карта Мужчина (для мужчины), в том месте, где она выпала. '
    'Карта, выпавшая в доме Женщины или в доме Мужчины, '
    'сигнификатором НЕ является — это обычная карта в этом доме.'
)


def _clean_card(value) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return ''


def _build_cards_block(spread: dict, deck: dict, layout: list) -> str:
    """Строки вида «12. ряд 2, столбец 3 — дом Птицы — карта Ключ»."""
    grid = spread.get('grid')
    positions = spread.get('positions')
    house_names = deck.get('house_names')
    position_word = deck.get('position_word', 'позиция')

    lines = []
    for i in range(spread['size']):
        card = _clean_card(layout[i] if i < len(layout) else '')
        if not card:
            continue

        parts = [f'{i + 1}.']
        if grid and grid.get('cols'):
            cols = grid['cols']
            rows = grid.get('rows', 1)
            tail = grid.get('tail', 0)
            main_count = cols * rows
            if tail and i >= main_count:
                # Карты нижней отдельной строки
                parts.append(
                    f'ИТОГОВАЯ СТРОКА (отдельно под полем), '
                    f'место {i - main_count + 1} из {tail} —'
                )
            elif rows > 1 or cols > 1:
                row = i // cols + 1
                col = i % cols + 1
                # «из N» не даёт модели домыслить другую ширину поля
                parts.append(f'ряд {row}, столбец {col} из {cols} —')
        if positions and i < len(positions):
            parts.append(f'позиция «{positions[i]}» —')
        elif house_names and i < len(house_names):
            parts.append(f'{position_word} {house_names[i]} —')
        parts.append(f'карта {card}')
        lines.append(' '.join(parts))

    return '\n'.join(lines)


def _build_table_block(spread: dict, deck: dict, layout: list) -> str:
    """Стол как таблица: строка = ряд стола, ячейка = место, дом и карта.

    Так модели не нужно вычислять соседей арифметикой — она видит их
    глазами: над картой это ячейка выше в том же столбце, под ней — ниже,
    диагонали — соседние ячейки по углам.
    """
    grid = spread.get('grid') or {}
    cols = grid.get('cols') or 0
    rows = grid.get('rows') or 0
    tail = grid.get('tail') or 0
    house_names = deck.get('house_names')
    if not cols or not rows or not house_names:
        return ''

    def cell(i: int) -> str:
        card = _clean_card(layout[i] if i < len(layout) else '')
        if not card:
            return ''
        house = house_names[i] if i < len(house_names) else ''
        return f'место {i + 1} · дом «{house}» · выпала карта «{card}»'

    def fmt_row(cells: list) -> str:
        return '| ' + ' | '.join(c if c else ' ' for c in cells) + ' |'

    lines = ['| ' + ' | '.join(f'столбец {c + 1}' for c in range(cols)) + ' |']
    lines.append('|' + '---|' * cols)
    for r in range(rows):
        lines.append(fmt_row([cell(r * cols + c) for c in range(cols)]))

    if tail:
        # Итоговые карты лежат по центру: слева и справа ячейки пустые
        pad = (cols - tail) // 2
        cells = [''] * cols
        for k in range(tail):
            cells[pad + k] = cell(rows * cols + k)
        lines.append(fmt_row(cells))

    return '\n'.join(lines)


def _build_figures_block(spread: dict, deck: dict, layout: list, gender: str) -> str:
    """Готовые координаты фигур: модель их не ищет и не может ошибиться."""
    house_names = deck.get('house_names')
    if not house_names:
        return ''

    grid = spread.get('grid') or {}
    cols = grid.get('cols') or 0
    rows = grid.get('rows') or 0

    def find(card_name: str):
        for i in range(spread['size']):
            if _clean_card(layout[i] if i < len(layout) else '') == card_name:
                return i
        return None

    def describe(i: int) -> str:
        house = house_names[i] if i < len(house_names) else ''
        where = ''
        if cols:
            main = cols * rows
            if i < main:
                where = f', ряд {i // cols + 1}, столбец {i % cols + 1}'
            else:
                where = f', итоговый ряд, место {i - main + 1}'
        return f'место {i + 1}{where}, дом «{house}»'

    own, other = ('Женщина', 'Мужчина') if gender == 'female' else ('Мужчина', 'Женщина')
    lines = []
    i_own = find(own)
    if i_own is not None:
        lines.append(
            f'- СИГНИФИКАТОР (сам человек) — карта «{own}». '
            f'Она лежит: {describe(i_own)}. Весь разбор веди от неё.'
        )
    i_other = find(other)
    if i_other is not None:
        lines.append(
            f'- ВТОРАЯ ФИГУРА (партнёр) — карта «{other}». '
            f'Она лежит: {describe(i_other)}.'
        )
    if not lines:
        return ''

    lines.append(
        f'Не путай: карта, выпавшая В ДОМЕ «{own}», — это НЕ сигнификатор. '
        f'Сигнификатор — только сама карта «{own}» в указанном выше месте.'
    )
    return 'ГДЕ ЛЕЖАТ ФИГУРЫ (посчитано за тебя, бери готовым).\n' + '\n'.join(lines)


def _build_index_block(spread: dict, deck: dict, layout: list) -> str:
    """Обратный указатель: карта -> где лежит. Чтобы не искать глазами."""
    if not deck.get('house_names'):
        return ''
    house_names = deck['house_names']
    items = []
    for i in range(spread['size']):
        card = _clean_card(layout[i] if i < len(layout) else '')
        if not card:
            continue
        house = house_names[i] if i < len(house_names) else ''
        items.append((card, f'карта «{card}» — место {i + 1}, дом «{house}»'))
    if not items:
        return ''
    items.sort(key=lambda x: x[0])
    return (
        'ГДЕ ИСКАТЬ КАРТУ (алфавитный указатель, бери готовым):\n'
        + '; '.join(t for _, t in items) + '.'
    )


def build_divination_prompt(meta: dict) -> str:
    """Собирает промпт расклада из divination_meta."""
    spread_id = meta.get('spread') or meta.get('spread_id') or 'lenormand_big9x4'
    spread = get_spread(spread_id)
    deck = get_deck(spread['deck'])

    period = meta.get('period', 'now')
    gender = meta.get('gender', 'female')
    spheres = meta.get('spheres') or []
    comment = (meta.get('comment') or '').strip()
    layout = meta.get('layout') or []

    period_label = PERIOD_LABELS.get(period, PERIOD_LABELS['now'])
    gender_label = GENDER_LABELS.get(gender, GENDER_LABELS['female'])
    sphere_labels = [SPHERE_LABELS.get(s, s) for s in spheres]
    spheres_text = ', '.join(sphere_labels) if sphere_labels else 'общая ситуация'

    cards_block = _build_cards_block(spread, deck, layout)
    house_hint = ''
    if deck.get('house_names') and not spread.get('positions'):
        house_hint = (
            'Дом — это вопрос, карта — ответ на него: читай их вместе. '
            'НЕ разбирай все 36 мест подряд отдельными пунктами. '
            'Иди цепочками и смысловыми блоками, а дома называй там, '
            'где они важны для ответа.'
        )

    table_block = _build_table_block(spread, deck, layout)
    grid = spread.get('grid') or {}
    cols = grid.get('cols') or 0
    nav_hint = ''
    if deck.get('house_names') and cols > 1:
        nav_hint = (
            'КАК СМОТРЕТЬ НА СТОЛ. Ниже таблица: строка — ряд стола, '
            'ячейка — одно место. Ничего не вычисляй, смотри в таблицу.\n'
            '- НАД картой — ячейка выше в том же столбце, ПОД — ниже '
            'в том же столбце, слева и справа — соседние ячейки строки;\n'
            '- ДИАГОНАЛИ — четыре ячейки по углам: выше слева, выше справа, '
            'ниже слева, ниже справа. У края стола часть из них '
            'отсутствует — не придумывай их;\n'
            '- тот же столбец — это НАД или ПОД, а не диагональ.'
        )

    # Часть раскладов делают на один конкретный вопрос: сферы жизни
    # у них не спрашивают, а вопрос — главный ориентир разбора
    asks_question = spread_id in ('tarot_celtic10', 'tarot_plan5')

    parts = [
        ROLE_INTRO,
        '',
        f'Расшифруй {spread["title"]}. {gender_label.capitalize()}. '
        f'Период: {period_label}.',
    ]
    if not asks_question:
        parts.append(f'Сферы для анализа: {spheres_text}.')

    if comment:
        parts.append('')
        if asks_question:
            parts.append(
                f'Вопрос человека, ради которого сделан расклад: {comment}\n'
                'Весь разбор веди вокруг этого вопроса и в конце дай прямой ответ на него.'
            )
        else:
            parts.append(f'Дополнительный вопрос / уточнение от человека: {comment}')

    parts.append('')
    if deck.get('house_names') and not spread.get('positions'):
        parts.append(LENORMAND_GLOSSARY)
        parts.append('')
    parts.append(spread['geometry'])
    if nav_hint:
        parts.append('')
        parts.append(nav_hint)

    parts.append('')
    if table_block:
        parts.append('ТАБЛИЦА СТОЛА (так карты лежат перед тобой):')
        parts.append(table_block)
        parts.append('')
        parts.append('Те же карты списком, по порядку:')
    else:
        parts.append('Карты на столе:')
    parts.append(cards_block)

    figures_block = _build_figures_block(spread, deck, layout, gender)
    if figures_block:
        parts.append('')
        parts.append(figures_block)

    index_block = _build_index_block(spread, deck, layout)
    if index_block:
        parts.append('')
        parts.append(index_block)

    parts.append('')
    parts.append(spread['chains'])
    if house_hint:
        parts.append(house_hint.strip())

    # Фокус разбора: «вся картина жизни» — только если выбраны все сферы.
    # Иначе весь расклад читается через выбранные сферы и вопрос.
    if not asks_question:
        parts.append('')
        if 'all' in spheres or not spheres:
            parts.append(
                'ФОКУС РАЗБОРА. Человек спрашивает про все сферы жизни — '
                'покажи всю картину целиком: и отношения, и дела, и деньги, '
                'и внутреннее состояние.'
            )
        else:
            parts.append(
                f'ФОКУС РАЗБОРА. Человек спрашивает не про всё подряд, '
                f'а про конкретное: {spheres_text}. Весь расклад трактуй '
                f'именно через это. Карты, которые прямо не относятся '
                f'к выбранным сферам, читай как обстоятельства, влияющие '
                f'на них, а не как отдельные темы. НЕ разбирай сферы, '
                f'о которых человек не спрашивал.'
            )
        if comment:
            parts.append(
                'Человек задал конкретный вопрос — сделай на нём особый '
                'акцент. Разбор веди так, чтобы он отвечал на этот вопрос, '
                'и в конце дай прямой ответ.'
            )

    if spread.get('length'):
        parts.append('')
        parts.append(spread['length'])

    parts.append('')
    parts.append(COMPLETENESS_RULE)

    parts.append('')
    parts.append(TONE_RULES)

    parts.append('')
    parts.append(CARE_RULES)

    parts.append('')
    parts.append(COMMON_RULES)

    return '\n'.join(parts)