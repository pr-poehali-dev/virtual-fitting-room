-- Добавляем поля для OAuth-входа через VK ID, не ломая существующих пользователей
ALTER TABLE t_p29007832_virtual_fitting_room.users
    ADD COLUMN IF NOT EXISTS vk_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(32),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Уникальный индекс на vk_id (только для не-NULL значений)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_vk_id
    ON t_p29007832_virtual_fitting_room.users (vk_id)
    WHERE vk_id IS NOT NULL;
