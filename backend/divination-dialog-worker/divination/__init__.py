"""Гадания: колоды, диалоговые расклады, сборка промпта диалога."""

from .decks import DECKS, get_deck
from .spreads import SPREADS, DEFAULT_SPREAD, get_spread

__all__ = ['DECKS', 'get_deck', 'SPREADS', 'DEFAULT_SPREAD', 'get_spread']
