-- Бонусные рубли: акции, начисления, защита от повторной регистрации.
-- Существующие таблицы не изменяются.

-- 1. Правила акций. Админ включает, выключает, создаёт свои.
CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.bonus_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'custom',
    min_amount NUMERIC(10,2) DEFAULT 0,
    bonus_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    expires_days INTEGER DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT false,
    starts_at TIMESTAMP NULL,
    ends_at TIMESTAMP NULL,
    show_on_site BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bonus_promotions_active
    ON t_p29007832_virtual_fitting_room.bonus_promotions (is_active, trigger_type);

-- 2. Партии начисленных бонусов. Каждая живёт своей жизнью и сгорает отдельно.
CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.bonus_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    promotion_id UUID NULL,
    promotion_code VARCHAR(64) DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    amount NUMERIC(10,2) NOT NULL,
    spent NUMERIC(10,2) NOT NULL DEFAULT 0,
    burned NUMERIC(10,2) NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by VARCHAR(32) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bonus_grants_user
    ON t_p29007832_virtual_fitting_room.bonus_grants (user_id, status);
CREATE INDEX IF NOT EXISTS idx_bonus_grants_expires
    ON t_p29007832_virtual_fitting_room.bonus_grants (status, expires_at);

-- 3. Отпечатки удалённых аккаунтов: бонус за регистрацию выдаём один раз.
-- Хранится только необратимый хэш почты, сам адрес восстановить нельзя.
CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.bonus_registration_guard (
    email_hash VARCHAR(64) PRIMARY KEY,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Стартовые акции. Выключены: включите в админке, когда будете готовы.
INSERT INTO t_p29007832_virtual_fitting_room.bonus_promotions
    (code, title, description, trigger_type, min_amount, bonus_amount, expires_days, is_active, sort_order)
VALUES
    ('registration', 'Бонус за регистрацию',
     'Дарим 50 бонусных рублей всем, кто создал аккаунт.',
     'registration', 0, 50, 30, false, 10),
    ('topup_500', 'Пополнение от 500 ₽',
     'Пополните счёт на 500 ₽ и получите 50 бонусных рублей сверху.',
     'topup', 500, 50, 30, false, 20),
    ('topup_1500', 'Пополнение от 1500 ₽',
     'Пополните счёт на 1500 ₽ и получите 300 бонусных рублей сверху.',
     'topup', 1500, 300, 30, false, 30),
    ('topup_3000', 'Пополнение от 3000 ₽',
     'Пополните счёт на 3000 ₽ и получите 900 бонусных рублей сверху.',
     'topup', 3000, 900, 30, false, 40)
ON CONFLICT (code) DO NOTHING;