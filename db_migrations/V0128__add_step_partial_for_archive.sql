-- Копилка для недописанного ответа на шаге правки файла. Сейчас при обрыве
-- теряется всё, что модель успела написать, и шаг начинается с нуля с новой
-- оплатой. Для раскладов такая копилка уже есть (partial_text) и работает.
ALTER TABLE t_p29007832_virtual_fitting_room.ai_editor_tasks
    ADD COLUMN IF NOT EXISTS step_partial text NULL;