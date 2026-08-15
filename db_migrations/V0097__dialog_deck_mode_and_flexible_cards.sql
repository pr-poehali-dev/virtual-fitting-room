-- Режим колоды в диалоге:
--  'full'   — каждый вопрос тянем из полной колоды (карты могут повторяться)
--  'single' — одна колода на весь диалог (карты не повторяются)
ALTER TABLE t_p29007832_virtual_fitting_room.divination_dialogs
ADD COLUMN IF NOT EXISTS deck_mode TEXT NOT NULL DEFAULT 'full';

-- Сколько карт тянуть на один вопрос (1..6)
ALTER TABLE t_p29007832_virtual_fitting_room.divination_dialogs
ADD COLUMN IF NOT EXISTS cards_per_step INTEGER NOT NULL DEFAULT 1;

-- Старые диалоговые расклады -> новые универсальные
UPDATE t_p29007832_virtual_fitting_room.divination_dialogs
SET spread = 'lenormand_dialog', cards_per_step = 1
WHERE spread = 'lenormand_card1';

UPDATE t_p29007832_virtual_fitting_room.divination_dialogs
SET spread = 'lenormand_dialog', cards_per_step = 3
WHERE spread = 'lenormand_line3';

UPDATE t_p29007832_virtual_fitting_room.divination_dialogs
SET spread = 'tarot_dialog', cards_per_step = 1
WHERE spread = 'tarot_card1';

UPDATE t_p29007832_virtual_fitting_room.divination_dialogs
SET spread = 'tarot_dialog', cards_per_step = 3
WHERE spread = 'tarot_line3';