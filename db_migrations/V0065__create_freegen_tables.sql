-- Таблица задач свободной генерации (по аналогии с nanobananapro_tasks)
CREATE TABLE IF NOT EXISTS freegen_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    prompt TEXT NOT NULL,
    "references" TEXT NOT NULL DEFAULT '[]',
    aspect_ratio TEXT NOT NULL DEFAULT '1:1',
    fal_request_id TEXT,
    fal_response_url TEXT,
    result_url TEXT,
    error_message TEXT,
    refunded BOOLEAN DEFAULT FALSE,
    saved_to_history BOOLEAN DEFAULT FALSE,
    first_result_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_freegen_tasks_status ON freegen_tasks(status);
CREATE INDEX IF NOT EXISTS idx_freegen_tasks_user_id ON freegen_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_freegen_tasks_created_at ON freegen_tasks(created_at);

-- Таблица истории свободной генерации (по аналогии с try_on_history)
CREATE TABLE IF NOT EXISTS freegen_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    prompt TEXT NOT NULL,
    "references" TEXT NOT NULL DEFAULT '[]',
    aspect_ratio TEXT,
    result_image TEXT NOT NULL,
    cost NUMERIC(10,2) DEFAULT 0.00,
    task_id TEXT,
    removed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_freegen_history_user_id ON freegen_history(user_id);
CREATE INDEX IF NOT EXISTS idx_freegen_history_created_at ON freegen_history(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS unique_freegen_task_id ON freegen_history(task_id) WHERE task_id IS NOT NULL;