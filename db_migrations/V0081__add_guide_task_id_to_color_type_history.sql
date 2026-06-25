ALTER TABLE t_p29007832_virtual_fitting_room.color_type_history
ADD COLUMN IF NOT EXISTS guide_task_id uuid NULL;

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.color_type_history.guide_task_id
IS 'Ссылка на задачу персонального гида (color_guide_tasks.id), сгенерированного в одном потоке с определением цветотипа';