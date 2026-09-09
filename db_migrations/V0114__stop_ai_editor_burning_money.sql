-- Останавливаем задачу: каждые три минуты она заново обращается к платной
-- модели, деньги списываются, а результат до сайта не доходит.
UPDATE t_p29007832_virtual_fitting_room.ai_editor_tasks
   SET status = 'failed',
       step_lock = NULL,
       error_message = 'Остановлено на время поиска причины сбоя.',
       updated_at = NOW()
 WHERE status IN ('pending', 'processing');