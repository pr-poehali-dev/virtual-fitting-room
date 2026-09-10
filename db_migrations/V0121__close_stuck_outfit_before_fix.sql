-- Закрываем задачу, зависшую до починки: разбор не сохранился (правка тогда
-- ещё не работала), до отрисовки не дошло, списания не было.
UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
   SET status = 'failed',
       error_message = 'Прервалось до починки. Запустите подбор заново.',
       partner_image = NULL,
       updated_at = NOW()
 WHERE id = 'fc58b3b2-e7f3-448e-8adc-12a781cbf3cc'
   AND status IN ('pending', 'processing');