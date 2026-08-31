-- Защита от повторной выдачи бонуса пользователям ВК без настоящей почты.
-- У них адрес технический (vk<id>@vk.local), поэтому запоминаем ещё и отпечаток vk_id.
ALTER TABLE t_p29007832_virtual_fitting_room.bonus_registration_guard
    ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'email';

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.bonus_registration_guard.source
    IS 'Откуда отпечаток: email — хэш почты, vk — хэш идентификатора ВКонтакте';
