"""Ядро бонусных рублей: расчёт остатка, начисление, списание, сгорание.

Бонусы лежат на обычном балансе пользователя, поэтому оплата услуг нигде
не меняется. Здесь ведётся только параллельный учёт: какая часть баланса
подарена, за что и когда сгорает.
"""

import hashlib
import os
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = 't_p29007832_virtual_fitting_room'
DEFAULT_EXPIRES_DAYS = 30


def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    sep = '&' if '?' in dsn else '?'
    return psycopg2.connect(f'{dsn}{sep}options=-c%20search_path%3D{SCHEMA}')


def email_fingerprint(email):
    """Необратимый отпечаток почты: сам адрес не хранится и не восстановим."""
    salt = os.environ.get('JWT_SECRET_KEY', 'bonus-guard')
    normalized = (email or '').strip().lower()
    if not normalized:
        return ''
    return hashlib.sha256(f'{salt}:{normalized}'.encode('utf-8')).hexdigest()


def money(value):
    """Аккуратное округление до копеек."""
    return round(float(value or 0), 2)


def expire_due_grants(cur, user_id=None):
    """Гасит просроченные бонусы. Баланс уменьшается только на остаток партии.

    Списываем ровно min(неизрасходованный остаток, текущий баланс) — уйти
    в минус или задеть собственные деньги человека технически нельзя.
    """
    where_user = ''
    params = []
    if user_id:
        where_user = ' AND g.user_id = %s'
        params.append(user_id)

    cur.execute(
        f"""SELECT g.id, g.user_id, g.amount, g.spent, g.burned, g.promotion_code,
                   u.balance
              FROM {SCHEMA}.bonus_grants g
              JOIN {SCHEMA}.users u ON u.id = g.user_id
             WHERE g.status = 'active'
               AND g.expires_at IS NOT NULL
               AND g.expires_at <= NOW(){where_user}
             ORDER BY g.expires_at ASC""",
        params,
    )
    rows = cur.fetchall() or []

    burned_total = 0.0
    for row in rows:
        left = money(row['amount']) - money(row['spent']) - money(row['burned'])
        balance = money(row['balance'])
        take = max(0.0, min(left, balance))

        if take > 0:
            cur.execute(
                f"""UPDATE {SCHEMA}.users
                       SET balance = GREATEST(balance - %s, 0)
                     WHERE id = %s""",
                (take, row['user_id']),
            )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.balance_transactions
                    (user_id, type, amount, balance_before, balance_after, description)
                    VALUES (%s, 'charge', %s, %s, %s, %s)""",
                (row['user_id'], -take, balance, max(0.0, balance - take),
                 'Сгорание бонусных рублей'),
            )
            burned_total += take

        cur.execute(
            f"""UPDATE {SCHEMA}.bonus_grants
                   SET status = 'expired',
                       burned = burned + %s,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE id = %s""",
            (take, row['id']),
        )
    return burned_total, len(rows)


def sync_spending(cur, user_id):
    """Разносит траты пользователя по бонусным партиям.

    Бонусные рубли считаются потраченными первыми, а среди них — те, что
    сгорят раньше. Считаем от факта: сколько всего начислено бонусами и
    сколько человек потратил. Разница и есть израсходованный бонус.
    """
    cur.execute(
        f"""SELECT COALESCE(SUM(-amount), 0) AS spent
              FROM {SCHEMA}.balance_transactions
             WHERE user_id = %s AND type = 'charge' AND amount < 0
               AND description <> 'Сгорание бонусных рублей'""",
        (user_id,),
    )
    total_spent = money((cur.fetchone() or {}).get('spent'))

    cur.execute(
        f"""SELECT id, amount, spent, burned, expires_at, created_at
              FROM {SCHEMA}.bonus_grants
             WHERE user_id = %s AND status IN ('active', 'expired')
             ORDER BY (expires_at IS NULL), expires_at ASC, created_at ASC""",
        (user_id,),
    )
    grants = cur.fetchall() or []

    remaining = total_spent
    for grant in grants:
        capacity = money(grant['amount']) - money(grant['burned'])
        take = max(0.0, min(capacity, remaining))
        remaining = max(0.0, remaining - take)
        if abs(take - money(grant['spent'])) > 0.001:
            cur.execute(
                f"""UPDATE {SCHEMA}.bonus_grants
                       SET spent = %s, updated_at = CURRENT_TIMESTAMP
                     WHERE id = %s""",
                (take, grant['id']),
            )


def get_bonus_summary(cur, user_id, refresh=True):
    """Сколько на счету бонусных рублей, когда ближайшее сгорание."""
    if refresh:
        expire_due_grants(cur, user_id)
        sync_spending(cur, user_id)

    cur.execute(
        f"""SELECT COALESCE(SUM(amount - spent - burned), 0) AS bonus_left,
                   MIN(expires_at) FILTER (
                       WHERE expires_at IS NOT NULL AND amount - spent - burned > 0
                   ) AS next_expiry
              FROM {SCHEMA}.bonus_grants
             WHERE user_id = %s AND status = 'active'""",
        (user_id,),
    )
    row = cur.fetchone() or {}
    bonus_left = max(0.0, money(row.get('bonus_left')))

    cur.execute(f'SELECT balance FROM {SCHEMA}.users WHERE id = %s', (user_id,))
    user_row = cur.fetchone()
    balance = money(user_row['balance']) if user_row else 0.0

    # Бонусов на счету не может быть больше, чем денег вообще
    bonus_left = min(bonus_left, balance)
    next_expiry = row.get('next_expiry')

    return {
        'balance': balance,
        'bonus_balance': bonus_left,
        'own_balance': money(balance - bonus_left),
        'next_expiry': next_expiry.isoformat() if next_expiry else None,
    }


def grant_bonus(cur, user_id, amount, reason, promotion=None,
                expires_days=DEFAULT_EXPIRES_DAYS, created_by='system'):
    """Начисляет бонусные рубли: на баланс и в отдельный учёт партий."""
    amount = money(amount)
    if amount <= 0 or not user_id:
        return None

    cur.execute(f'SELECT balance FROM {SCHEMA}.users WHERE id = %s', (user_id,))
    row = cur.fetchone()
    if not row:
        return None
    before = money(row['balance'])
    after = money(before + amount)

    expires_at = None
    if expires_days and int(expires_days) > 0:
        expires_at = datetime.utcnow() + timedelta(days=int(expires_days))

    promo_id = promotion.get('id') if promotion else None
    promo_code = (promotion.get('code') if promotion else '') or ''

    cur.execute(
        f'UPDATE {SCHEMA}.users SET balance = balance + %s WHERE id = %s',
        (amount, user_id),
    )
    cur.execute(
        f"""INSERT INTO {SCHEMA}.bonus_grants
            (user_id, promotion_id, promotion_code, reason, amount,
             expires_at, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id""",
        (user_id, promo_id, promo_code, reason, amount, expires_at, created_by),
    )
    grant_id = cur.fetchone()['id']

    cur.execute(
        f"""INSERT INTO {SCHEMA}.balance_transactions
            (user_id, type, amount, balance_before, balance_after, description)
            VALUES (%s, 'deposit', %s, %s, %s, %s)""",
        (user_id, amount, before, after, f'Бонусные рубли: {reason}'),
    )
    return grant_id


def revoke_bonus(cur, user_id, amount, reason='Списание бонусов администратором'):
    """Снимает бонусные рубли вручную, не трогая собственные деньги."""
    amount = money(amount)
    if amount <= 0 or not user_id:
        return 0.0

    summary = get_bonus_summary(cur, user_id)
    take_total = min(amount, summary['bonus_balance'])
    if take_total <= 0:
        return 0.0

    cur.execute(
        f"""SELECT id, amount, spent, burned
              FROM {SCHEMA}.bonus_grants
             WHERE user_id = %s AND status = 'active'
               AND amount - spent - burned > 0
             ORDER BY (expires_at IS NULL), expires_at ASC, created_at ASC""",
        (user_id,),
    )
    left_to_take = take_total
    for grant in cur.fetchall() or []:
        available = money(grant['amount']) - money(grant['spent']) - money(grant['burned'])
        take = min(available, left_to_take)
        if take <= 0:
            continue
        cur.execute(
            f"""UPDATE {SCHEMA}.bonus_grants
                   SET burned = burned + %s,
                       status = CASE WHEN amount - spent - burned - %s <= 0
                                     THEN 'revoked' ELSE status END,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE id = %s""",
            (take, take, grant['id']),
        )
        left_to_take = money(left_to_take - take)
        if left_to_take <= 0:
            break

    before = summary['balance']
    after = money(max(0.0, before - take_total))
    cur.execute(
        f'UPDATE {SCHEMA}.users SET balance = GREATEST(balance - %s, 0) WHERE id = %s',
        (take_total, user_id),
    )
    cur.execute(
        f"""INSERT INTO {SCHEMA}.balance_transactions
            (user_id, type, amount, balance_before, balance_after, description)
            VALUES (%s, 'charge', %s, %s, %s, %s)""",
        (user_id, -take_total, before, after, reason),
    )
    return take_total


def find_promotion(cur, trigger_type, amount=None):
    """Подбирает активную акцию: для пополнения — самую щедрую подходящую."""
    cur.execute(
        f"""SELECT id, code, title, bonus_amount, expires_days, min_amount
              FROM {SCHEMA}.bonus_promotions
             WHERE is_active = true
               AND trigger_type = %s
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (ends_at IS NULL OR ends_at >= NOW())
               AND bonus_amount > 0
             ORDER BY min_amount DESC""",
        (trigger_type,),
    )
    rows = cur.fetchall() or []
    if not rows:
        return None
    if amount is None:
        return dict(rows[0])
    for row in rows:
        if money(amount) >= money(row['min_amount']):
            return dict(row)
    return None
