-- Останавливаем зависшие задачи AI-редактора на время починки,
-- чтобы они перестали повторно обращаться к платной модели.
UPDATE t_p29007832_virtual_fitting_room.ai_editor_tasks
   SET status = 'failed',
       step_lock = NULL,
       error_message = 'Задача остановлена: идёт устранение сбоя обработки. Запустите заново позже.',
       updated_at = NOW()
 WHERE status IN ('pending', 'processing');