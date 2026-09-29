-- Останавливаем архивную задачу по просьбе пользователя: второй файл плана
-- (ViewEditCardBody.vue) слишком крупный и дописывается по кругу, сжигая
-- попытки и деньги. Пользователь перепишет задачу с разбивкой на мелкие
-- компоненты. Готовые файлы остаются в done_files.
UPDATE t_p29007832_virtual_fitting_room.ai_editor_tasks
   SET status = 'failed',
       step_lock = NULL,
       error_message = 'Остановлено по просьбе пользователя: задача будет переписана с разбивкой на мелкие компоненты.',
       updated_at = NOW()
 WHERE id = '752a5087-8898-4da2-a028-55d7a90903f7'
   AND status IN ('pending', 'processing');