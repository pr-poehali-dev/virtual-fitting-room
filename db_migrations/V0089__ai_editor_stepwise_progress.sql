ALTER TABLE t_p29007832_virtual_fitting_room.ai_editor_tasks
    ADD COLUMN IF NOT EXISTS plan_files jsonb,
    ADD COLUMN IF NOT EXISTS done_files jsonb,
    ADD COLUMN IF NOT EXISTS step_index integer,
    ADD COLUMN IF NOT EXISTS plan_summary text,
    ADD COLUMN IF NOT EXISTS step_lock timestamp;