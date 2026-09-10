-- Останавливаем зависшую задачу подбора образа. Ответ модели не укладывался
-- во время жизни функции, задача не доходила до отрисовки и перезапускалась
-- по кругу, тратя платные вызовы. Списания по задаче не было (cost = 0),
-- поэтому возврат средств не требуется.
UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
   SET status = 'failed',
       error_message = 'Не уложились во время. Попробуйте, пожалуйста, ещё раз.',
       partner_image = NULL,
       updated_at = NOW()
 WHERE id = '5e563b86-afeb-443f-b019-b9cb7ef949f5'
   AND status IN ('pending', 'processing');