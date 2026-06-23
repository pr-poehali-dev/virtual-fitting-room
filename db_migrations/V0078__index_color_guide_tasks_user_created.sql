-- Индекс для быстрой выборки истории по пользователю с сортировкой по дате.
-- Убирает зависание/таймаут на запросе истории color_guide_tasks.
CREATE INDEX IF NOT EXISTS idx_color_guide_tasks_user_created
ON t_p29007832_virtual_fitting_room.color_guide_tasks (user_id, created_at DESC);