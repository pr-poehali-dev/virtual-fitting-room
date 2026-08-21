ALTER TABLE t_p29007832_virtual_fitting_room.ai_editor_tasks
ADD COLUMN IF NOT EXISTS step_retries INTEGER NOT NULL DEFAULT 0;