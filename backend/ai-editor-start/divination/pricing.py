"""Цены раскладов. Источник правды для списаний — только этот файл.

Цену НИКОГДА не берём с фронта.
"""

DEFAULT_COST = 50

# Полные расклады: цена за один расклад
FULL_SPREAD_PRICES = {
    'google/gemini-2.5-flash': 50,
    'anthropic/claude-sonnet-4.6': 100,
}

SPREAD_PRICES = {
    'lenormand_big9x4': FULL_SPREAD_PRICES,
    'lenormand_big8x4plus4': FULL_SPREAD_PRICES,
    'tarot_celtic10': FULL_SPREAD_PRICES,
    'tarot_plan5': FULL_SPREAD_PRICES,
}

ALLOWED_MODELS = set(FULL_SPREAD_PRICES.keys())
DEFAULT_MODEL = 'google/gemini-2.5-flash'

MODEL_CODES = {
    'google/gemini-2.5-flash': 'GF',
    'anthropic/claude-sonnet-4.6': 'CS',
}


def get_price(spread_id: str, model: str) -> int:
    table = SPREAD_PRICES.get(spread_id) or FULL_SPREAD_PRICES
    return table.get(model, DEFAULT_COST)
