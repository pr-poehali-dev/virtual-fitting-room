UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks
SET status = 'failed',
    error_message = 'Задача зависла из-за таймаута (исправлено: переход на strict JSON schema)',
    person_image = NULL,
    updated_at = NOW()
WHERE id = '6ca3e82d-2051-4524-9888-b3fbc2064e21' AND status = 'processing';