-- Закрываем задачу, зависшую до починки потокового приёма ответа.
-- Она висит больше получаса, до отрисовки не дошла, списания не было.
UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
   SET status = 'failed',
       error_message = 'Прервалось до починки. Запустите подбор заново.',
       partner_image = NULL,
       updated_at = NOW()
 WHERE id = 'c80a81ae-a16b-42d7-b104-4f40fb9f0656'
   AND status IN ('pending', 'processing');