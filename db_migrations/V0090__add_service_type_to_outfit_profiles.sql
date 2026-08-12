-- Разделение сохранённых анкет по сервисам.
-- Существующие анкеты принадлежат подбору образов, поэтому DEFAULT 'outfit'
-- и все текущие строки автоматически получают правильный тип.
ALTER TABLE t_p29007832_virtual_fitting_room.outfit_profiles
    ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) NOT NULL DEFAULT 'outfit';

CREATE INDEX IF NOT EXISTS idx_outfit_profiles_user_service
    ON t_p29007832_virtual_fitting_room.outfit_profiles (user_id, service_type);