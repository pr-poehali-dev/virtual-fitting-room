-- Диалоги-гадания: вопрос → карты → ответ → уточняющий вопрос (до 30 шагов)
CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.divination_dialogs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    deck TEXT NOT NULL,
    spread TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    steps_count INTEGER NOT NULL DEFAULT 0,
    total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_div_dialogs_user
    ON t_p29007832_virtual_fitting_room.divination_dialogs (user_id, created_at DESC);

-- Шаги диалога. summary — краткая выжимка для передачи модели,
-- answer_text — полный ответ для показа на экране.
CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.divination_dialog_steps (
    id UUID PRIMARY KEY,
    dialog_id UUID NOT NULL,
    step_no INTEGER NOT NULL,
    question TEXT NOT NULL,
    cards JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_text TEXT,
    summary TEXT,
    task_id UUID,
    status TEXT NOT NULL DEFAULT 'pending',
    cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    refunded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_div_steps_dialog
    ON t_p29007832_virtual_fitting_room.divination_dialog_steps (dialog_id, step_no);