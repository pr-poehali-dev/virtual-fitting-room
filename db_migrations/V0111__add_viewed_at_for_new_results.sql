-- Отметка о просмотре результата. Нужна, чтобы показывать человеку
-- значок с числом новых работ и блок «Новые результаты» в кабинете:
-- открыл результат — отметка проставилась, счётчик уменьшился.
ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP;

ALTER TABLE t_p29007832_virtual_fitting_room.freegen_history
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP;

ALTER TABLE t_p29007832_virtual_fitting_room.try_on_history
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP;

ALTER TABLE t_p29007832_virtual_fitting_room.color_type_history
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP;

-- Всё, что создано до этого момента, считаем уже просмотренным:
-- иначе при первом заходе счётчик покажет сотни старых работ.
UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
   SET viewed_at = NOW() WHERE viewed_at IS NULL;
UPDATE t_p29007832_virtual_fitting_room.freegen_history
   SET viewed_at = NOW() WHERE viewed_at IS NULL;
UPDATE t_p29007832_virtual_fitting_room.try_on_history
   SET viewed_at = NOW() WHERE viewed_at IS NULL;
UPDATE t_p29007832_virtual_fitting_room.color_type_history
   SET viewed_at = NOW() WHERE viewed_at IS NULL;

-- Быстрый поиск непросмотренных работ конкретного человека
CREATE INDEX IF NOT EXISTS idx_cgt_user_unviewed
    ON t_p29007832_virtual_fitting_room.color_guide_tasks (user_id)
    WHERE viewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fgh_user_unviewed
    ON t_p29007832_virtual_fitting_room.freegen_history (user_id)
    WHERE viewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_toh_user_unviewed
    ON t_p29007832_virtual_fitting_room.try_on_history (user_id)
    WHERE viewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cth_user_unviewed
    ON t_p29007832_virtual_fitting_room.color_type_history (user_id)
    WHERE viewed_at IS NULL;