-- Добавляем поле references_cleaned_at для отслеживания очистки S3-референсов
ALTER TABLE t_p29007832_virtual_fitting_room.freegen_tasks
ADD COLUMN IF NOT EXISTS references_cleaned_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_freegen_tasks_cleanup 
ON t_p29007832_virtual_fitting_room.freegen_tasks (created_at, references_cleaned_at)
WHERE references_cleaned_at IS NULL;