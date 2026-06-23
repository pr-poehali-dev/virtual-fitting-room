-- Добавляем колонку для параметров формы сервиса "Подбор образов" (service_type='outfit').
-- Nullable JSONB, не влияет на существующие сервисы colorguide/style.
ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
ADD COLUMN IF NOT EXISTS form_params jsonb NULL;