ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
ADD COLUMN IF NOT EXISTS colortype_history_id uuid NULL;

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.color_guide_tasks.colortype_history_id
IS 'Обратная связь: ссылка на запись цветотипа (color_type_history.id), из которой был сгенерирован этот гид в одном потоке';