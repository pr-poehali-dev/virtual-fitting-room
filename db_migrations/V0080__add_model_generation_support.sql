ALTER TABLE t_p29007832_virtual_fitting_room.freegen_tasks
ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'freegen',
ADD COLUMN IF NOT EXISTS model_params jsonb;

CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.user_models (
    id SERIAL PRIMARY KEY,
    user_id text NOT NULL,
    image_url text NOT NULL,
    gender text,
    age text,
    height text,
    body_type text,
    hair_color text,
    eye_color text,
    hair_length text,
    kibbe text,
    colortype text,
    prompt text,
    task_id text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_models_user_id ON t_p29007832_virtual_fitting_room.user_models(user_id);