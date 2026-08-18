"""Диалоговые расклады и цены. Тексты промпта здесь не нужны:
эта функция только принимает вопрос и ставит его в очередь,
а в нейросеть ходит divination-dialog-worker.
"""

from .spreads import SPREADS, DEFAULT_SPREAD, get_spread

__all__ = ['SPREADS', 'DEFAULT_SPREAD', 'get_spread']
