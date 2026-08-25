ALTER TABLE t_p29007832_virtual_fitting_room.freegen_tasks
ADD COLUMN IF NOT EXISTS consult_task_id UUID;

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.freegen_tasks.consult_task_id
IS 'Консультация ИИ-стилиста, к карточке которой нужно прикрепить готовую картинку';