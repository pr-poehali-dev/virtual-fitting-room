CREATE TABLE IF NOT EXISTS kibbe_test_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    user_name VARCHAR(255),
    height INTEGER,
    dominance VARCHAR(50),
    winning_letter VARCHAR(10),
    kibbe_type VARCHAR(100),
    answers JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kibbe_test_history_user_id ON kibbe_test_history(user_id);
CREATE INDEX IF NOT EXISTS idx_kibbe_test_history_created_at ON kibbe_test_history(created_at DESC);