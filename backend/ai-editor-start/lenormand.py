"""Логика раскладов Ленорман: имена домов, сборка промпта для нейросети."""

# 36 домов Большого расклада Ленорман 9x4 (фиксированный порядок).
HOUSE_NAMES = [
    'Всадник', 'Клевер', 'Корабль', 'Дом', 'Дерево', 'Тучи', 'Змея', 'Гроб',
    'Букет', 'Коса', 'Метла', 'Птицы', 'Ребёнок', 'Лиса', 'Медведь', 'Звёзды',
    'Аист', 'Собака', 'Башня', 'Сад', 'Гора', 'Развилка', 'Крысы', 'Сердце',
    'Кольцо', 'Книга', 'Письмо', 'Мужчина', 'Женщина', 'Лилии', 'Солнце', 'Луна',
    'Ключ', 'Рыбы', 'Якорь', 'Крест',
]

# Список карт колоды (для валидации того, что прислал фронт).
CARD_NAMES = list(HOUSE_NAMES)

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
    'all': 'все сферы жизни',
}


def _card_for_house(layout, house_index):
    """layout — список из 36 строк (имя выпавшей карты в доме house_index)."""
    if not layout or house_index >= len(layout):
        return None
    val = layout[house_index]
    if isinstance(val, str) and val.strip():
        return val.strip()
    return None


def build_lenormand_prompt(meta: dict) -> str:
    """Собирает текстовый промпт расклада из divination_meta."""
    spread = meta.get('spread', 'big9x4')
    period = meta.get('period', 'now')
    gender = meta.get('gender', 'female')
    spheres = meta.get('spheres') or []
    comment = (meta.get('comment') or '').strip()
    layout = meta.get('layout') or []

    period_label = PERIOD_LABELS.get(period, PERIOD_LABELS['now'])
    gender_label = GENDER_LABELS.get(gender, GENDER_LABELS['female'])
    sphere_labels = [SPHERE_LABELS.get(s, s) for s in spheres]
    spheres_text = ', '.join(sphere_labels) if sphere_labels else 'общая ситуация'

    lines = []
    if spread == 'big9x4':
        spread_title = 'большой расклад Ленорман 9 на 4 (36 карт)'
        for i in range(36):
            card = _card_for_house(layout, i)
            house = HOUSE_NAMES[i] if i < len(HOUSE_NAMES) else f'дом {i + 1}'
            if card:
                lines.append(f'{i + 1}. дом {house} карта {card}.')
    else:
        spread_title = 'расклад Ленорман'
        for i, card in enumerate(layout):
            if isinstance(card, str) and card.strip():
                lines.append(f'{i + 1}. карта {card.strip()}.')

    cards_block = '\n'.join(lines)

    prompt = f"""Ты — опытный профессиональный таролог и мастер карт Ленорман. Сделай подробную, тёплую и бережную трактовку расклада.

Расшифруй {spread_title}. {gender_label.capitalize()}. Период: {period_label}.
Сферы для анализа: {spheres_text}.
"""
    if comment:
        prompt += f"\nДополнительный вопрос / уточнение от человека: {comment}\n"

    prompt += f"""
Карты в раскладе (формат «номер. дом {{значение дома}} карта {{выпавшая карта}}»):
{cards_block}

Инструкции по трактовке:
1. Учитывай сочетание значения ДОМА и выпавшей КАРТЫ в каждой позиции.
2. Сделай связный анализ по выбранным сферам, а не просто перечисление карт.
3. Опиши общую картину, ключевые акценты и динамику развития ситуации в указанный период.
4. Обязательно заверши раздел с практическими СОВЕТАМИ (что делать, на что обратить внимание).
5. Пиши на русском языке, тёплым поддерживающим тоном, без предсказаний фатального характера.
"""
    return prompt