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
    'Ты — опытный профессиональный таролог и мастер карт Ленорман.'
)

# Тон, бережность и общие правила ответа — одним блоком:
# раньше это были три отдельных блока, повторявших друг друга.
TONE_RULES = (
    'КАК ГОВОРИТЬ С ЧЕЛОВЕКОМ.\n'
    '1. Пиши на русском языке, тёплым поддерживающим тоном. Поздоровайся '
    'и заверши искренней поддержкой. Начинай сразу с разбора карт, '
    'без вступительных оговорок о природе гадания.\n'
    '2. Веди разбор по тому вопросу и сферам, которые указал человек.\n'
    '3. Без фатальных предсказаний. Сложные карты показывают, где стоит '
    'скорректировать действия, а не приговор.\n'
    '4. Давай связный рассказ, а не перечисление карт по списку.\n'
    '5. При тревоге о здоровье и жизни мягко направляй к живым '
    'специалистам, не ставь диагнозов и не пугай.\n'
    '6. В финале дай конкретные советы: что сделать и на что опереться.'
)

# Правило завершённости: ориентир по объёму не должен рвать мысль
COMPLETENESS_RULE = (
    'Мысль всегда доводи до конца — обрывать ответ на середине нельзя.'
)


# Словарь ролей. Имена домов и имена карт — одни и те же 36 слов,
# поэтому модель их путает. Разводим термины явно и один раз.
LENORMAND_GLOSSARY = (
    'СЛОВАРЬ (дальше используй только эти слова).\n'
    '- МЕСТО — номер клетки на столе. Это не номер карты.\n'
    '- ДОМ — постоянная тема места, она не меняется.\n'
    '- КАРТА — то, что выпало в этом месте.\n'
    '- Дома и карты называются одинаковыми словами, но это разные вещи. '
    'Пиши всегда в форме «карта Луна в доме Кольца»: сначала карта, '
    'потом дом.\n'
    '- СИГНИФИКАТОР — сама карта Женщина (для женщины) или сама карта '
    'Мужчина (для мужчины), в том месте, где она выпала.'
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


def _build_rows_block(spread: dict, deck: dict, layout: list) -> str:
    """Стол построчно: «Ряд 1 слева направо:» и по строке на карту.

    Номер столбца в каждой строке оставляем: без него модель считает
    соседей по вертикали арифметикой и путает цепочки.
    """
    grid = spread.get('grid') or {}
    cols = grid.get('cols') or 0
    rows = grid.get('rows') or 0
    house_names = deck.get('house_names')
    if not cols or not rows or not house_names:
        return ''

    lines = []
    for r in range(rows):
        if r == 0:
            lines.append('Ряд 1 слева направо:')
        else:
            lines.append(f'Ряд {r + 1} (под рядом {r}) слева направо:')
        for c in range(cols):
            i = r * cols + c
            card = _clean_card(layout[i] if i < len(layout) else '')
            if not card:
                continue
            house = house_names[i] if i < len(house_names) else ''
            lines.append(
                f'Место {i + 1}, столбец {c + 1}, в дом «{house}» '
                f'выпала карта «{card}».'
            )
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
    # Короткий вид: места фигур уже перечислены в списке карт
    plain = bool(spread.get('figures_plain'))
    lines = []
    i_own = find(own)
    if i_own is not None:
        where = '' if plain else f' Она лежит: {describe(i_own)}.'
        lines.append(
            f'- СИГНИФИКАТОР (сам человек) — карта «{own}».'
            f'{where} Весь разбор веди от неё.'
        )
    i_other = find(other)
    if i_other is not None:
        where = '' if plain else f' Она лежит: {describe(i_other)}.'
        lines.append(
            f'- ВТОРАЯ ФИГУРА (партнёр) — карта «{other}».{where}'
        )
    if not lines:
        return ''

    if plain:
        return '\n'.join(lines)
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
    her_his = 'Его' if gender == 'male' else 'Её'
    sphere_labels = [SPHERE_LABELS.get(s, s) for s in spheres]
    spheres_text = ', '.join(sphere_labels) if sphere_labels else 'общая ситуация'

    cards_block = _build_cards_block(spread, deck, layout)
    table_block = _build_table_block(spread, deck, layout)
    rows_block = _build_rows_block(spread, deck, layout)

    # Часть раскладов делают на один конкретный вопрос: сферы жизни
    # у них не спрашивают, а вопрос — главный ориентир разбора
    asks_question = spread_id in ('tarot_celtic10', 'tarot_plan5')

    intro = (
        f'Расшифруй {spread["title"]} {gender_label}, '
        f'на период — {period_label}.'
    )
    if spread.get('intro_extra'):
        intro = f'{intro} {spread["intro_extra"]}'

    parts = [ROLE_INTRO, '', intro]
    if not asks_question:
        parts.append(f'Сферы для анализа: {spheres_text}.')

    if comment:
        parts.append('')
        if asks_question:
            parts.append(
                f'{her_his} вопрос, ради которого сделан расклад: {comment}\n'
                'Весь разбор веди вокруг этого вопроса и в конце дай прямой ответ на него.'
            )
        else:
            parts.append(f'{her_his} дополнительный вопрос / уточнение: {comment}')

    parts.append('')
    # Часть раскладов сначала показывает форму стола, потом термины
    geometry_first = bool(spread.get('geometry_first'))
    if geometry_first:
        parts.append(spread['geometry'])
        parts.append('')
    if deck.get('house_names') and not spread.get('positions'):
        parts.append(LENORMAND_GLOSSARY)
        parts.append('')
    if not geometry_first:
        parts.append(spread['geometry'])
        parts.append('')

    # Таблица показывает карты и геометрию сразу: если она есть,
    # список тех же карт не нужен
    if spread.get('cards_format') == 'rows' and rows_block:
        parts.append('Карты в раскладе:')
        parts.append(rows_block)
    elif table_block:
        parts.append('ТАБЛИЦА СТОЛА (так карты лежат перед тобой):')
        parts.append(table_block)
    else:
        parts.append('Карты на столе:')
        parts.append(cards_block)

    figures_block = _build_figures_block(spread, deck, layout, gender)
    if figures_block:
        parts.append('')
        parts.append(figures_block)

    parts.append('')
    parts.append(spread['chains'])

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
    # Свой блок правил уже содержит требование не обрывать мысль
    if spread.get('extra_rules'):
        parts.append(spread['extra_rules'])
    else:
        parts.append(COMPLETENESS_RULE)

    parts.append('')
    parts.append(TONE_RULES)

    return '\n'.join(parts)