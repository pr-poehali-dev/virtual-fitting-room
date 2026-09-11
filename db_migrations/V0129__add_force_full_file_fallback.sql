-- Запасной ход: если точечные правки испортили файл, следующий заход
-- просит файл целиком — медленнее, зато структура не рвётся.
ALTER TABLE t_p29007832_virtual_fitting_room.ai_editor_tasks
    ADD COLUMN IF NOT EXISTS force_full_file boolean NOT NULL DEFAULT false;