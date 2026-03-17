CREATE TABLE t_p29007832_virtual_fitting_room.ai_editor_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    mode VARCHAR(20) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt TEXT NOT NULL,
    filename VARCHAR(500),
    file_content TEXT,
    archive_base64 TEXT,
    ai_response TEXT,
    result_file_content TEXT,
    result_archive_base64 TEXT,
    files_count INTEGER,
    model_used VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);