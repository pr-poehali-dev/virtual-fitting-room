"""Бонус за регистрацию для входа через ВКонтакте.

Логика повторяет ту, что работает при обычной регистрации по почте.
Отличие одно: у пользователей ВК почта часто техническая (vk<id>@vk.local),
поэтому от повторной выдачи защищаемся ещё и отпечатком vk_id — он не
меняется, даже если человек удалит аккаунт и зайдёт заново.
"""

import hashlib
import os


def _fingerprint(kind: str, value: str) -> str:
    salt = os.environ.get('JWT_SECRET_KEY', 'bonus-guard')
    normalized = (value or '').strip().lower()
    if not normalized:
        return ''
    return hashlib.sha256(f'{salt}:{kind}:{normalized}'.encode('utf-8')).hexdigest()


def _email_fingerprint(email: str) -> str:
    """Отпечаток почты — совпадает с тем, что пишет auth-api и delete-account."""
    salt = os.environ.get('JWT_SECRET_KEY', 'bonus-guard')
    normalized = (email or '').strip().lower()
    if not normalized:
        return ''
    return hashlib.sha256(f'{salt}:{normalized}'.encode('utf-8')).hexdigest()


def _is_technical_email(email: str) -> bool:
    return (email or '').strip().lower().endswith('@vk.local')


def grant_vk_registration_bonus(cursor, user_id: str, vk_id: str, email: str) -> None:
    """Начисляет бонус за регистрацию новому пользователю из ВКонтакте."""
    vk_mark = _fingerprint('vk', str(vk_id))
    email_mark = '' if _is_technical_email(email) else _email_fingerprint(email)

    marks = [m for m in (vk_mark, email_mark) if m]
    if not marks:
        return

    cursor.execute(
        'SELECT 1 FROM bonus_registration_guard WHERE email_hash = ANY(%s)',
        (marks,),
    )
    if cursor.fetchone():
        print('[VK-AUTH] Bonus already granted earlier')
        return

    cursor.execute(
        """SELECT id, code, title, bonus_amount, expires_days
             FROM bonus_promotions
            WHERE is_active = true AND trigger_type = 'registration'
              AND bonus_amount > 0
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
            ORDER BY sort_order ASC
            LIMIT 1"""
    )
    promo = cursor.fetchone()
    if not promo:
        return

    promo_id = promo['id'] if isinstance(promo, dict) else promo[0]
    promo_code = promo['code'] if isinstance(promo, dict) else promo[1]
    promo_title = promo['title'] if isinstance(promo, dict) else promo[2]
    raw_amount = promo['bonus_amount'] if isinstance(promo, dict) else promo[3]
    expires_days = promo['expires_days'] if isinstance(promo, dict) else promo[4]

    bonus_amount = round(float(raw_amount), 2)
    if bonus_amount <= 0:
        return

    cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
    row = cursor.fetchone()
    if row is None:
        return
    current = row['balance'] if isinstance(row, dict) else row[0]
    before = round(float(current), 2)
    after = round(before + bonus_amount, 2)

    cursor.execute(
        'UPDATE users SET balance = balance + %s WHERE id = %s',
        (bonus_amount, user_id),
    )
    cursor.execute(
        """INSERT INTO bonus_grants
           (user_id, promotion_id, promotion_code, reason, amount, expires_at, created_by)
           VALUES (%s, %s, %s, %s, %s,
                   CASE WHEN %s::int IS NULL THEN NULL
                        ELSE NOW() + (%s::int || ' days')::interval END,
                   'system')""",
        (user_id, promo_id, promo_code, promo_title, bonus_amount,
         expires_days, expires_days),
    )
    cursor.execute(
        """INSERT INTO balance_transactions
           (user_id, type, amount, balance_before, balance_after, description)
           VALUES (%s, 'deposit', %s, %s, %s, %s)""",
        (user_id, bonus_amount, before, after, f'Бонусные рубли: {promo_title}'),
    )

    cursor.execute(
        """INSERT INTO bonus_registration_guard (email_hash, source)
           VALUES (%s, 'vk') ON CONFLICT (email_hash) DO NOTHING""",
        (vk_mark,),
    )
    if email_mark:
        cursor.execute(
            """INSERT INTO bonus_registration_guard (email_hash, source)
               VALUES (%s, 'email') ON CONFLICT (email_hash) DO NOTHING""",
            (email_mark,),
        )

    print(f'[VK-AUTH] Bonus {bonus_amount} granted to {user_id}')
