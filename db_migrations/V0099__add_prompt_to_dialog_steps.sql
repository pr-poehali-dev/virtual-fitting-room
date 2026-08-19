-- Временно: сохраняем текст промпта шага диалога, чтобы его можно было проверить
ALTER TABLE t_p29007832_virtual_fitting_room.divination_dialog_steps
    ADD COLUMN IF NOT EXISTS prompt TEXT;