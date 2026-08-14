UPDATE t_p29007832_virtual_fitting_room.color_type_history
SET status = 'failed',
    error_message = 'Сервис не смог обработать фото — ответ пришёл повреждённым. Попробуйте запустить определение цветотипа ещё раз.',
    refunded = true,
    result_text = NULL
WHERE id = '47bee4c0-9b28-4aca-9e1a-9c1245f2c94e'
  AND status = 'completed'
  AND color_type IS NULL;