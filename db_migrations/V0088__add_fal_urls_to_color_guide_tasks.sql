ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
    ADD COLUMN IF NOT EXISTS fal_status_url TEXT,
    ADD COLUMN IF NOT EXISTS fal_response_url TEXT,
    ADD COLUMN IF NOT EXISTS recovery_done BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_color_guide_tasks_recovery
    ON t_p29007832_virtual_fitting_room.color_guide_tasks (status, created_at)
    WHERE fal_response_url IS NOT NULL;