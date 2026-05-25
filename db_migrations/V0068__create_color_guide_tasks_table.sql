CREATE TABLE IF NOT EXISTS color_guide_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    person_image TEXT,
    cdn_url TEXT,
    result_json JSONB,
    colortype_slug VARCHAR(50),
    cost INTEGER DEFAULT 0,
    refunded BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_color_guide_tasks_user_id ON color_guide_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_color_guide_tasks_status ON color_guide_tasks(status);
CREATE INDEX IF NOT EXISTS idx_color_guide_tasks_created_at ON color_guide_tasks(created_at DESC);