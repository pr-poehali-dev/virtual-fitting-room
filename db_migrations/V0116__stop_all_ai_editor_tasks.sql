-- Останавливаем задачи AI-редактора: каждая попытка обращается к платной
-- модели, обрывается на середине и повторяется по кругу без результата.
-- Уже сделанные файлы сохранены в done_files и не теряются.
UPDATE t_p29007832_virtual_fitting_room.ai_editor_tasks
   SET status = 'failed',
       step_lock = NULL,
       error_message = 'Остановлено: устраняем обрыв длинных шагов. Запустите заново после починки.',
       updated_at = NOW()
 WHERE status IN ('pending', 'processing');