UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
SET status = 'failed',
    error_message = 'Соединение с БД отвалилось после ответа Gemini (исправлено: соединения теперь короткие)',
    person_image = NULL,
    updated_at = NOW()
WHERE id = '96e201d5-6078-43cc-8a5b-0333d069d755' AND status = 'processing';