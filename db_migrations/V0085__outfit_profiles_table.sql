CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.outfit_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(120) NOT NULL,
    comment TEXT DEFAULT '',
    form_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outfit_profiles_user
    ON t_p29007832_virtual_fitting_room.outfit_profiles (user_id, created_at DESC);