-- Закрываем шаги диалога-гадания, зависшие из-за обрыва связи с нейросетью.
-- Оплаты по ним нет (cost = 0), возвращать нечего — снимаем вечную загрузку.
UPDATE t_p29007832_virtual_fitting_room.divination_dialog_steps
   SET status = 'failed', updated_at = NOW()
 WHERE status IN ('pending', 'processing')
   AND cost = 0
   AND updated_at < NOW() - INTERVAL '5 minutes';