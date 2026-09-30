-- Продолжаем архивную задачу по просьбе пользователя: она упала на 7-м файле
-- из 14 из-за временного отказа провайдера по балансу (баланс пополнен).
-- Готовые 6 файлов остаются в done_files. Оставшиеся правки мелкие,
-- поэтому переключаем модель на более дешёвую Sonnet 4.6.
UPDATE t_p29007832_virtual_fitting_room.ai_editor_tasks
   SET status = 'processing',
       step_retries = 0,
       step_lock = NULL,
       step_partial = NULL,
       error_message = NULL,
       model = 'anthropic/claude-sonnet-4.6',
       updated_at = NOW()
 WHERE id = 'f4137fb9-e87b-4b4d-b440-de665655367a'
   AND status = 'failed';