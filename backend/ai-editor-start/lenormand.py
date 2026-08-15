"""Совместимость со старым вызовом расклада Ленорман.

Вся логика колод/раскладов/промптов теперь в пакете divination.
Здесь остаётся тонкая обёртка, чтобы не ломать существующие вызовы.
"""

from divination.decks import LENORMAND_CARDS
from divination.prompt import (
    build_divination_prompt,
    PERIOD_LABELS,
    GENDER_LABELS,
    SPHERE_LABELS,
)

HOUSE_NAMES = list(LENORMAND_CARDS)
CARD_NAMES = list(LENORMAND_CARDS)

# Старые короткие идентификаторы раскладов -> новые полные
_LEGACY_SPREADS = {
    'big9x4': 'lenormand_big9x4',
    'line3': 'lenormand_line3',
    'card1': 'lenormand_card1',
}


def normalize_spread_id(spread_id: str, system: str = 'lenormand') -> str:
    """Приводит идентификатор расклада к виду «система_расклад»."""
    if not spread_id:
        return 'lenormand_big9x4'
    if spread_id in _LEGACY_SPREADS:
        return _LEGACY_SPREADS[spread_id]
    if '_' not in spread_id:
        return f'{system}_{spread_id}'
    return spread_id


def build_lenormand_prompt(meta: dict) -> str:
    """Собирает промпт расклада (поддерживает старый формат spread)."""
    meta = dict(meta or {})
    system = meta.get('system') or 'lenormand'
    meta['spread'] = normalize_spread_id(meta.get('spread'), system)
    return build_divination_prompt(meta)


__all__ = [
    'HOUSE_NAMES', 'CARD_NAMES', 'build_lenormand_prompt',
    'normalize_spread_id', 'PERIOD_LABELS', 'GENDER_LABELS', 'SPHERE_LABELS',
]
