"""Гадания: колоды, расклады, сборка промпта расклада."""

from .decks import DECKS, get_deck
from .spreads import SPREADS, DEFAULT_SPREAD, get_spread
from .prompt import build_divination_prompt

__all__ = [
    'DECKS', 'get_deck',
    'SPREADS', 'DEFAULT_SPREAD', 'get_spread',
    'build_divination_prompt',
]
