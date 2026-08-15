"""Цены раскладов. Источник правды для списаний — только этот файл.

Цену НИКОГДА не берём с фронта.
"""

DEFAULT_COST = 50

# Полные расклады: цена за один расклад
FULL_SPREAD_PRICES = {
    'google/gemini-2.5-flash': 50,
    'anthropic/claude-sonnet-4.6': 100,
}

# Расклады-диалоги: цена за ОДИН шаг (вопрос + карты + ответ)
DIALOG_STEP_PRICES = {
    'google/gemini-2.5-flash': 10,
    'anthropic/claude-sonnet-4.6': 25,
}

# Какие расклады работают в режиме диалога
DIALOG_SPREADS = {
    'lenormand_card1',
    'lenormand_line3',
    'tarot_card1',
    'tarot_line3',
}

SPREAD_PRICES = {
    'lenormand_big9x4': FULL_SPREAD_PRICES,
    'tarot_celtic10': FULL_SPREAD_PRICES,
    'lenormand_card1': DIALOG_STEP_PRICES,
    'lenormand_line3': DIALOG_STEP_PRICES,
    'tarot_card1': DIALOG_STEP_PRICES,
    'tarot_line3': DIALOG_STEP_PRICES,
}

ALLOWED_MODELS = set(FULL_SPREAD_PRICES.keys())
DEFAULT_MODEL = 'google/gemini-2.5-flash'

MODEL_CODES = {
    'google/gemini-2.5-flash': 'GF',
    'anthropic/claude-sonnet-4.6': 'CS',
}

# Максимум шагов в одном диалоге
DIALOG_MAX_STEPS = 30


def get_price(spread_id: str, model: str) -> int:
    table = SPREAD_PRICES.get(spread_id) or FULL_SPREAD_PRICES
    return table.get(model, DEFAULT_COST)


def is_dialog_spread(spread_id: str) -> bool:
    return spread_id in DIALOG_SPREADS
