"""Промпт диалога-гадания: вопрос → карты → ответ → уточняющий вопрос.

Чтобы запрос не разрастался с каждым шагом, в предысторию идут краткие
выжимки прошлых шагов, а не полные ответы.
"""

from .decks import get_deck
from .spreads import get_spread
from .prompt import (
    ROLE_INTRO, COMMON_RULES, CARE_RULES, TONE_RULES, COMPLETENESS_RULE,
    PERIOD_LABELS, GENDER_LABELS, SPHERE_LABELS,
)

# Ориентир по объёму ответа в диалоге. Верхняя граница с запасом
# ниже технического потолка, чтобы ответ не оборвался на середине.
_LENGTH_RULE = (
    'ОБЪЁМ ОТВЕТА. Ориентир — примерно 1500-3000 знаков. '
    'Если в вопросе несколько подвопросов, отвечай на каждый '
    'и увеличивай объём соразмерно — но не больше 4000 знаков. '
    'Если вопрос простой и короткий, отвечай короче ориентира.'
)

# Разделитель: до него — ответ человеку, после — краткая выжимка для истории
SUMMARY_MARKER = '###КРАТКО###'

_SUMMARY_RULE = (
    f'В САМОМ КОНЦЕ ответа поставь строку {SUMMARY_MARKER} и после неё '
    'напиши краткую выжимку этого шага в 1-3 предложениях: '
    'о чём спросили, что выпало и главный смысл ответа. '
    'Выжимка нужна, чтобы не потерять нить в дальнейшем разговоре — '
    'пиши её так, чтобы по ней был понятен смысл без полного текста. '
    'Не упоминай саму выжимку в основном ответе.'
)


def build_history_block(history: list) -> str:
    """history — список словарей: step_no, question, cards, summary."""
    if not history:
        return ''

    lines = ['Предыстория разговора (кратко, по шагам):']
    for item in history:
        step_no = item.get('step_no')
        question = (item.get('question') or '').strip()
        cards = item.get('cards') or []
        summary = (item.get('summary') or '').strip()

        cards_text = ', '.join([c for c in cards if c]) or '—'
        lines.append(f'Шаг {step_no}. Вопрос: {question}')
        lines.append(f'   Выпали карты: {cards_text}')
        if summary:
            lines.append(f'   Суть ответа: {summary}')

    lines.append(
        'Учитывай эту предысторию: разговор продолжается, '
        'не повторяй уже сказанное, опирайся на прежние карты и выводы.'
    )
    return '\n'.join(lines)


def build_context_block(ctx: dict) -> str:
    """Параметры из мастера: пол, период, сферы, пожелание человека."""
    if not ctx:
        return ''
    gender = GENDER_LABELS.get(ctx.get('gender'), GENDER_LABELS['female'])
    period = PERIOD_LABELS.get(ctx.get('period'), PERIOD_LABELS['now'])
    spheres = [SPHERE_LABELS.get(s, s) for s in (ctx.get('spheres') or [])]
    spheres_text = ', '.join(spheres) if spheres else 'общая ситуация'
    comment = (ctx.get('comment') or '').strip()

    lines = [
        'О человеке и запросе (задано в начале, учитывай во всех ответах):',
        f'- гадание {gender};',
        f'- интересующий период: {period};',
        f'- сферы жизни: {spheres_text};',
    ]
    if comment:
        lines.append(f'- дополнительное пожелание: {comment}')
    return '\n'.join(lines)


def build_dialog_prompt(
    spread_id: str,
    question: str,
    cards: list,
    history: list = None,
    gender: str = 'female',
    context: dict = None,
) -> str:
    """Собирает промпт одного шага диалога."""
    spread = get_spread(spread_id)
    deck = get_deck(spread['deck'])
    history = history or []
    step_no = len(history) + 1

    cards_lines = []
    positions = spread.get('positions')
    for i, card in enumerate(cards):
        card = (card or '').strip()
        if not card:
            continue
        if positions and i < len(positions):
            cards_lines.append(f'{i + 1}. позиция «{positions[i]}» — карта {card}')
        else:
            cards_lines.append(f'{i + 1}. карта {card}')

    parts = [
        ROLE_INTRO,
        '',
        f'Это диалог-гадание на картах {deck["title"]}. '
        f'Сейчас шаг {step_no}. Человек задаёт вопрос и тянет карты, '
        f'ты отвечаешь, затем он уточняет дальше.',
    ]

    context_block = build_context_block(context)
    if context_block:
        parts += ['', context_block]

    history_block = build_history_block(history)
    if history_block:
        parts += ['', history_block]

    parts += [
        '',
        f'ТЕКУЩИЙ вопрос человека: {question.strip()}',
        '',
        spread['geometry'],
        '',
        'Карты, выпавшие на этот вопрос:',
        '\n'.join(cards_lines) if cards_lines else '—',
        '',
        spread['chains'],
        '',
        'Отвечай именно на текущий вопрос, опираясь на выпавшие сейчас карты.',
        '',
        _LENGTH_RULE,
        '',
        COMPLETENESS_RULE,
        '',
        TONE_RULES,
        '',
        CARE_RULES,
        '',
        COMMON_RULES,
        '',
        _SUMMARY_RULE,
    ]

    return '\n'.join(parts)


def split_answer_and_summary(text: str):
    """Делит ответ модели на текст для человека и краткую выжимку."""
    if not text:
        return '', ''
    if SUMMARY_MARKER in text:
        answer, summary = text.split(SUMMARY_MARKER, 1)
        return answer.strip(), summary.strip()
    # Модель забыла разделитель — берём хвост как выжимку
    clean = text.strip()
    tail = clean[-400:]
    return clean, tail