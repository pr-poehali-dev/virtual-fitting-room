CREATE TABLE IF NOT EXISTS archetype_test_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    user_name VARCHAR(255),
    top_archetype VARCHAR(50),
    top_archetype_name VARCHAR(100),
    top_names VARCHAR(255),
    scores JSONB,
    answers JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archetype_test_history_user_id ON archetype_test_history(user_id);
CREATE INDEX IF NOT EXISTS idx_archetype_test_history_created_at ON archetype_test_history(created_at DESC);