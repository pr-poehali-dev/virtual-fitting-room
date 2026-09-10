-- Закрываем задачу, зависшую до переделки на пошаговый приём ответа.
-- Разбор не сохранился, до отрисовки не дошло, списания не было (cost = 0).
UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
   SET status = 'failed',
       error_message = 'Прервалось до починки. Запустите подбор заново.',
       partner_image = NULL,
       updated_at = NOW()
 WHERE id = '900c68d5-a40d-4238-b385-68768093191e'
   AND status IN ('pending', 'processing');