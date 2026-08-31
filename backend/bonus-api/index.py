"""API бонусных рублей: акции для сайта, баланс пользователя, управление из админки."""

import json
import os
from typing import Any, Dict

import jwt
from psycopg2.extras import RealDictCursor

from bonus_core import (
    SCHEMA,
    email_fingerprint,
    expire_due_grants,
    find_promotion,
    get_bonus_summary,
    get_db_connection,
    grant_bonus,
    money,
    revoke_bonus,
    sync_spending,
)
from session_utils import validate_session

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Session-Token, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
}


def reply(status, payload):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', **CORS},
        'isBase64Encoded': False,
        'body': json.dumps(payload, ensure_ascii=False, default=str),
    }


def is_admin(event):
    headers = event.get('headers', {})
    token = (headers.get('x-admin-token') or headers.get('X-Admin-Token')
             or headers.get('x-auth-token') or headers.get('X-Auth-Token') or '')
    if not token:
        return False
    try:
        secret = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return bool(payload.get('admin'))
    except Exception:
        return False


def public_promotions(cur):
    """Акции для страницы «Акции»: только включённые и разрешённые к показу."""
    cur.execute(
        f"""SELECT code, title, description, trigger_type, min_amount,
                   bonus_amount, expires_days, ends_at
              FROM {SCHEMA}.bonus_promotions
             WHERE is_active = true AND show_on_site = true
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (ends_at IS NULL OR ends_at >= NOW())
             ORDER BY sort_order ASC, min_amount ASC"""
    )
    return [
        {
            'code': r['code'],
            'title': r['title'],
            'description': r['description'] or '',
            'trigger_type': r['trigger_type'],
            'min_amount': money(r['min_amount']),
            'bonus_amount': money(r['bonus_amount']),
            'expires_days': r['expires_days'],
            'ends_at': r['ends_at'].isoformat() if r['ends_at'] else None,
        }
        for r in (cur.fetchall() or [])
    ]


def user_bonus_detail(cur, user_id):
    """Баланс с разбивкой и история начислений — для кошелька пользователя."""
    summary = get_bonus_summary(cur, user_id)
    cur.execute(
        f"""SELECT reason, promotion_code, amount, spent, burned,
                   expires_at, status, created_at
              FROM {SCHEMA}.bonus_grants
             WHERE user_id = %s
             ORDER BY created_at DESC
             LIMIT 50""",
        (user_id,),
    )
    summary['grants'] = [
        {
            'reason': r['reason'],
            'promotion_code': r['promotion_code'] or '',
            'amount': money(r['amount']),
            'left': max(0.0, money(r['amount']) - money(r['spent']) - money(r['burned'])),
            'spent': money(r['spent']),
            'burned': money(r['burned']),
            'status': r['status'],
            'expires_at': r['expires_at'].isoformat() if r['expires_at'] else None,
            'created_at': r['created_at'].isoformat() if r['created_at'] else None,
        }
        for r in (cur.fetchall() or [])
    ]
    return summary


def admin_promotions(cur):
    cur.execute(
        f"""SELECT p.*,
                   (SELECT COALESCE(SUM(g.amount), 0)
                      FROM {SCHEMA}.bonus_grants g
                     WHERE g.promotion_id = p.id) AS granted_total,
                   (SELECT COUNT(*) FROM {SCHEMA}.bonus_grants g
                     WHERE g.promotion_id = p.id) AS granted_count
              FROM {SCHEMA}.bonus_promotions p
             ORDER BY p.sort_order ASC, p.created_at ASC"""
    )
    result = []
    for r in cur.fetchall() or []:
        item = dict(r)
        item['id'] = str(item['id'])
        item['min_amount'] = money(item['min_amount'])
        item['bonus_amount'] = money(item['bonus_amount'])
        item['granted_total'] = money(item['granted_total'])
        for key in ('starts_at', 'ends_at', 'created_at', 'updated_at'):
            item[key] = item[key].isoformat() if item.get(key) else None
        result.append(item)
    return result


def save_promotion(cur, data):
    """Создаёт или обновляет акцию."""
    promo_id = data.get('id')
    fields = {
        'code': (data.get('code') or '').strip()[:64],
        'title': (data.get('title') or '').strip()[:255],
        'description': data.get('description') or '',
        'trigger_type': data.get('trigger_type') or 'custom',
        'min_amount': money(data.get('min_amount')),
        'bonus_amount': money(data.get('bonus_amount')),
        'expires_days': data.get('expires_days'),
        'is_active': bool(data.get('is_active')),
        'show_on_site': bool(data.get('show_on_site', True)),
        'sort_order': int(data.get('sort_order') or 100),
        'starts_at': data.get('starts_at') or None,
        'ends_at': data.get('ends_at') or None,
    }
    if fields['expires_days'] in ('', None):
        fields['expires_days'] = None
    else:
        fields['expires_days'] = int(fields['expires_days'])

    if not fields['code'] or not fields['title']:
        return None, 'Нужны короткий код и название акции'

    if promo_id:
        cur.execute(
            f"""UPDATE {SCHEMA}.bonus_promotions
                   SET code=%s, title=%s, description=%s, trigger_type=%s,
                       min_amount=%s, bonus_amount=%s, expires_days=%s,
                       is_active=%s, show_on_site=%s, sort_order=%s,
                       starts_at=%s, ends_at=%s, updated_at=CURRENT_TIMESTAMP
                 WHERE id=%s
             RETURNING id""",
            (fields['code'], fields['title'], fields['description'],
             fields['trigger_type'], fields['min_amount'], fields['bonus_amount'],
             fields['expires_days'], fields['is_active'], fields['show_on_site'],
             fields['sort_order'], fields['starts_at'], fields['ends_at'], promo_id),
        )
    else:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.bonus_promotions
                (code, title, description, trigger_type, min_amount, bonus_amount,
                 expires_days, is_active, show_on_site, sort_order, starts_at, ends_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (code) DO UPDATE
                   SET title=EXCLUDED.title, description=EXCLUDED.description,
                       trigger_type=EXCLUDED.trigger_type,
                       min_amount=EXCLUDED.min_amount,
                       bonus_amount=EXCLUDED.bonus_amount,
                       expires_days=EXCLUDED.expires_days,
                       is_active=EXCLUDED.is_active,
                       show_on_site=EXCLUDED.show_on_site,
                       sort_order=EXCLUDED.sort_order,
                       updated_at=CURRENT_TIMESTAMP
             RETURNING id""",
            (fields['code'], fields['title'], fields['description'],
             fields['trigger_type'], fields['min_amount'], fields['bonus_amount'],
             fields['expires_days'], fields['is_active'], fields['show_on_site'],
             fields['sort_order'], fields['starts_at'], fields['ends_at']),
        )
    row = cur.fetchone()
    return (str(row['id']) if row else None), None


def admin_users_with_bonus(cur, search='', limit=50):
    """Список людей с бонусами на счету."""
    params = []
    where = "WHERE g.status = 'active' AND g.amount - g.spent - g.burned > 0"
    if search:
        where += ' AND (u.email ILIKE %s OR u.name ILIKE %s)'
        params.extend([f'%{search}%', f'%{search}%'])
    params.append(int(limit))

    cur.execute(
        f"""SELECT u.id, u.email, u.name, u.balance,
                   COALESCE(SUM(g.amount - g.spent - g.burned), 0) AS bonus_left,
                   MIN(g.expires_at) AS next_expiry
              FROM {SCHEMA}.bonus_grants g
              JOIN {SCHEMA}.users u ON u.id = g.user_id
              {where}
             GROUP BY u.id, u.email, u.name, u.balance
             ORDER BY bonus_left DESC
             LIMIT %s""",
        params,
    )
    result = []
    for r in cur.fetchall() or []:
        balance = money(r['balance'])
        bonus = min(max(0.0, money(r['bonus_left'])), balance)
        result.append({
            'id': str(r['id']),
            'email': r['email'],
            'name': r['name'],
            'balance': balance,
            'bonus_balance': bonus,
            'own_balance': money(balance - bonus),
            'next_expiry': r['next_expiry'].isoformat() if r['next_expiry'] else None,
        })
    return result


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Бонусные рубли: акции, начисления, списания, сгорание."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'isBase64Encoded': False, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'promotions')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            body = {}
    action = body.get('action') or action

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # --- Публично: список акций для страницы «Акции» ---
        if action == 'promotions' and method == 'GET':
            return reply(200, {'promotions': public_promotions(cur)})

        # --- Пользователь: свой бонусный баланс ---
        if action == 'my_bonuses':
            ok, user_id, err = validate_session(event)
            if not ok:
                return reply(401, {'error': err or 'Требуется авторизация'})
            data = user_bonus_detail(cur, user_id)
            conn.commit()
            return reply(200, data)

        # --- Дальше только админ ---
        if not is_admin(event):
            return reply(403, {'error': 'Нет доступа'})

        if action == 'admin_promotions' and method == 'GET':
            return reply(200, {'promotions': admin_promotions(cur)})

        if action == 'save_promotion' and method == 'POST':
            promo_id, error = save_promotion(cur, body)
            if error:
                return reply(400, {'error': error})
            conn.commit()
            return reply(200, {'success': True, 'id': promo_id})

        if action == 'toggle_promotion' and method == 'POST':
            cur.execute(
                f"""UPDATE {SCHEMA}.bonus_promotions
                       SET is_active = %s, updated_at = CURRENT_TIMESTAMP
                     WHERE id = %s""",
                (bool(body.get('is_active')), body.get('id')),
            )
            conn.commit()
            return reply(200, {'success': True})

        if action == 'remove_promotion' and method == 'POST':
            # Начисленные бонусы у людей остаются, убираем только правило
            cur.execute(
                f'UPDATE {SCHEMA}.bonus_grants SET promotion_id = NULL WHERE promotion_id = %s',
                (body.get('id'),),
            )
            cur.execute(
                f'DELETE FROM {SCHEMA}.bonus_promotions WHERE id = %s',
                (body.get('id'),),
            )
            conn.commit()
            return reply(200, {'success': True})

        if action == 'users' and method == 'GET':
            return reply(200, {
                'users': admin_users_with_bonus(cur, params.get('search', ''),
                                                params.get('limit', 50))
            })

        if action == 'user_detail':
            user_id = body.get('user_id') or params.get('user_id')
            if not user_id:
                return reply(400, {'error': 'Нужен пользователь'})
            data = user_bonus_detail(cur, user_id)
            conn.commit()
            return reply(200, data)

        if action == 'grant' and method == 'POST':
            user_id = body.get('user_id')
            amount = money(body.get('amount'))
            if not user_id or amount <= 0:
                return reply(400, {'error': 'Нужен пользователь и сумма больше нуля'})
            grant_bonus(
                cur, user_id, amount,
                body.get('reason') or 'Начисление администратором',
                expires_days=body.get('expires_days', 30),
                created_by='admin',
            )
            data = get_bonus_summary(cur, user_id)
            conn.commit()
            return reply(200, {'success': True, **data})

        if action == 'revoke' and method == 'POST':
            user_id = body.get('user_id')
            amount = money(body.get('amount'))
            if not user_id or amount <= 0:
                return reply(400, {'error': 'Нужен пользователь и сумма больше нуля'})
            taken = revoke_bonus(cur, user_id, amount,
                                 body.get('reason') or 'Списание бонусов администратором')
            data = get_bonus_summary(cur, user_id)
            conn.commit()
            return reply(200, {'success': True, 'revoked': taken, **data})

        if action == 'clear_all' and method == 'POST':
            if body.get('confirm') != 'CLEAR':
                return reply(400, {'error': 'Нужно подтверждение'})
            cur.execute(
                f"""SELECT user_id, SUM(amount - spent - burned) AS left_sum
                      FROM {SCHEMA}.bonus_grants
                     WHERE status = 'active' AND amount - spent - burned > 0
                     GROUP BY user_id"""
            )
            targets = cur.fetchall() or []
            cleared = 0.0
            for row in targets:
                cleared += revoke_bonus(cur, row['user_id'], money(row['left_sum']),
                                        'Массовое обнуление бонусов')
            conn.commit()
            return reply(200, {'success': True, 'users': len(targets),
                               'cleared': money(cleared)})

        if action == 'run_expiry' and method == 'POST':
            burned, count = expire_due_grants(cur)
            conn.commit()
            return reply(200, {'success': True, 'burned': money(burned), 'grants': count})

        if action == 'stats' and method == 'GET':
            cur.execute(
                f"""SELECT
                      COALESCE(SUM(amount), 0) AS granted,
                      COALESCE(SUM(spent), 0) AS spent,
                      COALESCE(SUM(burned), 0) AS burned,
                      COALESCE(SUM(CASE WHEN status='active'
                                        THEN amount - spent - burned ELSE 0 END), 0) AS active
                      FROM {SCHEMA}.bonus_grants"""
            )
            row = cur.fetchone() or {}
            return reply(200, {
                'granted': money(row.get('granted')),
                'spent': money(row.get('spent')),
                'burned': money(row.get('burned')),
                'active': money(row.get('active')),
            })

        return reply(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()
