-- Спасаем расклад, не уложившийся в отведённое время: сам текст (48 тыс.
-- знаков) уже написан и лежит в partial_text. Отдаём его человеку как
-- готовый результат вместо того, чтобы потерять вместе с задачей.
UPDATE t_p29007832_virtual_fitting_room.ai_editor_tasks
   SET ai_response = convert_from(decode(substring(partial_text from 5), 'base64'), 'UTF8'),
       status = 'completed',
       model_used = COALESCE(model_used, 'recovered'),
       updated_at = NOW()
 WHERE id = '3a362919-5aa1-4e8b-a13b-7d9a5a9d584f'
   AND status = 'processing'
   AND partial_text LIKE 'b64:%';