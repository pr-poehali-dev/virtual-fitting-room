-- Шаги, зависшие из-за таймаута прежней синхронной схемы
UPDATE t_p29007832_virtual_fitting_room.divination_dialog_steps
SET status = 'failed', refunded = true, updated_at = NOW()
WHERE status IN ('pending', 'processing')
  AND created_at < NOW() - INTERVAL '5 minutes';