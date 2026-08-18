"""Гадания: колоды, диалоговые расклады, сборка промпта диалога."""

from .decks import DECKS, get_deck, deck_cards
from .spreads import SPREADS, DEFAULT_SPREAD, get_spread, spread_exists

__all__ = [
    'DECKS', 'get_deck', 'deck_cards',
    'SPREADS', 'DEFAULT_SPREAD', 'get_spread', 'spread_exists',
]
