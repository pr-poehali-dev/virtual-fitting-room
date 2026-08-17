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
    'Сделай подробную, тёплую и бережную трактовку расклада.'
)

COMMON_RULES = (
    'Общие правила ответа:\n'
    '- пиши на русском языке, тёплым поддерживающим тоном;\n'
    '- не делай фатальных предсказаний, не пугай, не давай медицинских '
    'и юридических указаний;\n'
    '- давай связный анализ, а не сухое перечисление карт по позициям;\n'
    '- в конце обязательно дай практические СОВЕТЫ: что делать '
    'и на что обратить внимание.'
)


def _clean_card(value) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return ''


def build_cards_block(spread: dict, deck: dict, layout: list) -> str:
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

    cards_block = build_cards_block(spread, deck, layout)
    house_hint = ''
    if deck.get('house_names') and not spread.get('positions'):
        house_hint = (
            '\nВ этом раскладе у каждой позиции есть собственное значение — '
            '«дом». Значение позиции всегда сочетай с выпавшей в ней картой: '
            'дом задаёт тему, карта отвечает на неё.'
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
    parts.append(spread['geometry'])
    if house_hint:
        parts.append(house_hint.strip())

    parts.append('')
    parts.append('Карты на столе:')
    parts.append(cards_block)

    parts.append('')
    parts.append(spread['chains'])

    parts.append('')
    parts.append(COMMON_RULES)

    return '\n'.join(parts)