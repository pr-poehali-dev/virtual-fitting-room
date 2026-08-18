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

# Правило завершённости: ориентир по объёму не должен рвать мысль
COMPLETENESS_RULE = (
    'Уложись в ориентир по объёму, но мысль всегда доводи до конца — '
    'обрывать ответ на середине нельзя. Лаконично не значит поверхностно: '
    'лучше убрать воду и повторы, чем суть. Ответ должен выглядеть '
    'законченным, и человек должен уловить главное.'
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
                parts.append(f'нижний ряд, место {i - main_count + 1} —')
            elif rows > 1 or cols > 1:
                row = i // cols + 1
                col = i % cols + 1
                parts.append(f'ряд {row}, столбец {col} —')
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

    parts = [
        ROLE_INTRO,
        '',
        f'Расшифруй {spread["title"]}. {gender_label.capitalize()}. '
        f'Период: {period_label}.',
        f'Сферы для анализа: {spheres_text}.',
    ]

    if comment:
        parts.append('')
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