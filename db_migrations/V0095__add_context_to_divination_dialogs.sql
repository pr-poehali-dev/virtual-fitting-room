-- Параметры из мастера (пол, период, сферы, комментарий) для диалогов
ALTER TABLE t_p29007832_virtual_fitting_room.divination_dialogs
ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb;