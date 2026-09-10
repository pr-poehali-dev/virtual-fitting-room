-- Закрываем задачу, крутившуюся на думающей модели: та молча размышляла
-- дольше, чем живёт функция, и заходы обрывались до первого слова ответа.
-- Подбор переведён на быструю модель. Списания не было (безлимит).
UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
   SET status = 'failed',
       error_message = 'Прервалось до смены модели. Запустите подбор заново.',
       partner_image = NULL,
       partial_answer = NULL,
       updated_at = NOW()
 WHERE id = '0ec14482-54de-4c02-9686-5ea9b680569f'
   AND status IN ('pending', 'processing');