-- Второе фото (образ партнёра) для сервиса 'wedding'. Используется только для анализа,
-- в генерацию картинки не передаётся. После обработки очищается, как и person_image.
ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
    ADD COLUMN IF NOT EXISTS partner_image TEXT;