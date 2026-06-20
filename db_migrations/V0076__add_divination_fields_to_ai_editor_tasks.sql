ALTER TABLE t_p29007832_virtual_fitting_room.ai_editor_tasks
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS cost integer,
    ADD COLUMN IF NOT EXISTS refunded boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS task_type varchar(30) DEFAULT 'editor',
    ADD COLUMN IF NOT EXISTS divination_meta jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_editor_tasks_user_created
    ON t_p29007832_virtual_fitting_room.ai_editor_tasks (user_id, created_at DESC);