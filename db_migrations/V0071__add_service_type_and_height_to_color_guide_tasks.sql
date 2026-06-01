ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
    ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) NOT NULL DEFAULT 'colorguide',
    ADD COLUMN IF NOT EXISTS height INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_color_guide_tasks_service_type
    ON t_p29007832_virtual_fitting_room.color_guide_tasks(service_type);