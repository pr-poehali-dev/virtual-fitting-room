'''
Business: Manage user balance, check limits, and deduct credits for try-on generations
Args: event with httpMethod, headers (session token via cookie/X-Session-Token), body
Returns: User balance info or updated balance after deduction
'''

import json
import os
import psycopg2
from typing import Dict, Any
from session_utils import validate_session

GENERATION_COST = 50
COLORTYPE_COST = 50
MIN_TOPUP = 50
SCHEMA = 't_p29007832_virtual_fitting_room'
# redeploy v2


def get_bonus_part(cur, conn, user_id: str, balance: float):
    """Какая часть баланса — бонусные рубли, и когда ближайшее сгорание.

    Заодно гасит просроченные бонусы. Списывается только неизрасходованный
    остаток и не больше текущего баланса — собственные деньги не задеваются.
    """
    # 1. Гасим то, у чего вышел срок
    cur.execute(
        f"""SELECT id, amount - spent - burned AS left_sum
              FROM {SCHEMA}.bonus_grants
             WHERE user_id = %s AND status = 'active'
               AND expires_at IS NOT NULL AND expires_at <= NOW()
             ORDER BY expires_at ASC""",
        (user_id,),
    )
    due = cur.fetchall() or []
    current = float(balance)
    for grant_id, left_sum in due:
        take = max(0.0, min(round(float(left_sum or 0), 2), current))
        if take > 0:
            cur.execute(
                f'UPDATE {SCHEMA}.users SET balance = GREATEST(balance - %s, 0) WHERE id = %s',
                (take, user_id),
            )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.balance_transactions
                    (user_id, type, amount, balance_before, balance_after, description)
                    VALUES (%s, 'charge', %s, %s, %s, 'Сгорание бонусных рублей')""",
                (user_id, -take, current, round(current - take, 2)),
            )
            current = round(current - take, 2)
        cur.execute(
            f"""UPDATE {SCHEMA}.bonus_grants
                   SET status = 'expired', burned = burned + %s,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE id = %s""",
            (take, grant_id),
        )

    # 2. Разносим траты по партиям: бонусные тратятся первыми.
    # Учитываются только списания, сделанные ПОСЛЕ начисления бонуса —
    # прошлые траты человека к подарку отношения не имеют
    cur.execute(
        f"""SELECT -amount, created_at
              FROM {SCHEMA}.balance_transactions
             WHERE user_id = %s AND type = 'charge' AND amount < 0
               AND description <> 'Сгорание бонусных рублей'
             ORDER BY created_at ASC""",
        (user_id,),
    )
    charges = [(round(float(a or 0), 2), d) for a, d in (cur.fetchall() or [])]

    cur.execute(
        f"""SELECT id, amount, spent, burned, created_at
              FROM {SCHEMA}.bonus_grants
             WHERE user_id = %s AND status IN ('active', 'expired')
             ORDER BY (expires_at IS NULL), expires_at ASC, created_at ASC""",
        (user_id,),
    )
    grants = [
        {
            'id': gid,
            'capacity': round(float(amount) - float(burned), 2),
            'spent_saved': float(spent),
            'created_at': created,
            'used': 0.0,
        }
        for gid, amount, spent, burned, created in (cur.fetchall() or [])
    ]

    # Каждую трату гасим из бонусов, которые уже были начислены на тот момент
    for charge_sum, charge_date in charges:
        left = charge_sum
        for grant in grants:
            if left <= 0:
                break
            if grant['created_at'] and charge_date and charge_date < grant['created_at']:
                continue
            free = round(grant['capacity'] - grant['used'], 2)
            take = max(0.0, min(free, left))
            grant['used'] = round(grant['used'] + take, 2)
            left = round(left - take, 2)

    for grant in grants:
        if abs(grant['used'] - grant['spent_saved']) > 0.001:
            cur.execute(
                f'UPDATE {SCHEMA}.bonus_grants SET spent = %s WHERE id = %s',
                (grant['used'], grant['id']),
            )

    # 3. Считаем остаток
    cur.execute(
        f"""SELECT COALESCE(SUM(amount - spent - burned), 0),
                   MIN(expires_at) FILTER (
                       WHERE expires_at IS NOT NULL AND amount - spent - burned > 0
                   )
              FROM {SCHEMA}.bonus_grants
             WHERE user_id = %s AND status = 'active'""",
        (user_id,),
    )
    row = cur.fetchone()
    conn.commit()

    bonus_left = max(0.0, round(float(row[0] or 0), 2))
    bonus_left = min(bonus_left, current)
    expiry = row[1].isoformat() if row[1] else None
    return bonus_left, expiry

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        return origin if origin else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Validate session token
    is_valid, user_id, error_msg = validate_session(event)
    
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': error_msg or 'Требуется авторизация'})
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute('''
                SELECT balance, free_tries_used, unlimited_access 
                FROM t_p29007832_virtual_fitting_room.users 
                WHERE id = %s
            ''', (user_id,))
            
            result = cur.fetchone()
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({'error': 'Пользователь не найден'})
                }
            
            balance, free_tries_used, unlimited_access = result
            free_tries_remaining = 0
            paid_tries_available = int(balance / GENERATION_COST) if balance >= GENERATION_COST else 0

            # Какая часть баланса — бонусные рубли. Сбой в подсчёте
            # не должен мешать показать обычный баланс
            bonus_balance = 0.0
            bonus_expiry = None
            try:
                bonus_balance, bonus_expiry = get_bonus_part(cur, conn, user_id, float(balance))
            except Exception as bonus_error:
                conn.rollback()
                print(f'[USER-BALANCE] Bonus part skipped: {bonus_error}')

            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({
                    'balance': float(balance),
                    'bonus_balance': bonus_balance,
                    'own_balance': round(float(balance) - bonus_balance, 2),
                    'bonus_expires_at': bonus_expiry,
                    'free_tries_remaining': free_tries_remaining,
                    'paid_tries_available': paid_tries_available,
                    'unlimited_access': unlimited_access,
                    'can_generate': unlimited_access or free_tries_remaining > 0 or paid_tries_available > 0
                })
            }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'deduct':
                cost_per_step = GENERATION_COST
                total_cost = cost_per_step
                generation_type = body_data.get('generation_type', 'try_on')
                generation_id = body_data.get('generation_id')
                
                cur.execute('''
                    SELECT balance, unlimited_access 
                    FROM t_p29007832_virtual_fitting_room.users 
                    WHERE id = %s
                ''', (user_id,))
                
                result = cur.fetchone()
                if not result:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({'error': 'Пользователь не найден'})
                    }
                
                balance, unlimited_access = result
                balance_before = float(balance)
                
                if unlimited_access:
                    description = f'{"Виртуальная примерочная" if generation_type == "try_on" else "Определение цветотипа"} (безлимитный доступ)'
                    
                    cur.execute('''
                        INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                        (user_id, type, amount, balance_before, balance_after, description, try_on_id, color_type_id)
                        VALUES (%s, 'charge', 0, %s, %s, %s, %s, %s)
                    ''', (
                        user_id, 
                        balance_before, 
                        balance_before, 
                        description,
                        generation_id if generation_type == 'try_on' else None,
                        generation_id if generation_type == 'color_type' else None
                    ))
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'success': True,
                            'unlimited': True,
                            'message': 'Безлимитный доступ'
                        })
                    }
                
                if balance >= total_cost:
                    balance_after = balance_before - total_cost
                    description = 'Виртуальная примерочная' if generation_type == 'try_on' else 'Определение цветотипа'
                    
                    cur.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.users 
                        SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (total_cost, user_id))
                    
                    cur.execute('''
                        INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                        (user_id, type, amount, balance_before, balance_after, description, try_on_id, color_type_id)
                        VALUES (%s, 'charge', %s, %s, %s, %s, %s, %s)
                    ''', (
                        user_id, 
                        -total_cost,
                        balance_before, 
                        balance_after, 
                        description,
                        generation_id if generation_type == 'try_on' else None,
                        generation_id if generation_type == 'color_type' else None
                    ))
                    
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'success': True,
                            'paid_try': True,
                            'new_balance': balance_after,
                            'cost': total_cost
                        })
                    }
                
                return {
                    'statusCode': 402,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({
                        'error': 'Недостаточно средств',
                        'balance': balance_before,
                        'required': total_cost
                    })
                }
            
            elif action == 'refund':
                cost_per_step = GENERATION_COST
                total_refund = cost_per_step
                generation_type = body_data.get('generation_type', 'try_on')
                generation_id = body_data.get('generation_id')
                reason = body_data.get('reason', 'Технический сбой')
                
                cur.execute('''
                    SELECT balance, unlimited_access 
                    FROM t_p29007832_virtual_fitting_room.users 
                    WHERE id = %s
                ''', (user_id,))
                
                result = cur.fetchone()
                if not result:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({'error': 'Пользователь не найден'})
                    }
                
                balance, unlimited_access = result
                balance_before = float(balance)
                
                if unlimited_access:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'success': True,
                            'unlimited': True,
                            'message': 'Безлимитный пользователь - возврат не требуется'
                        })
                    }
                
                balance_after = balance_before + total_refund
                service_name = 'примерочной' if generation_type == 'try_on' else 'цветотипа'
                description = f'Возврат: {reason} {service_name}'
                
                cur.execute('''
                    UPDATE t_p29007832_virtual_fitting_room.users 
                    SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (total_refund, user_id))
                
                cur.execute('''
                    INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                    (user_id, type, amount, balance_before, balance_after, description, try_on_id, color_type_id)
                    VALUES (%s, 'refund', %s, %s, %s, %s, %s, %s)
                ''', (
                    user_id, 
                    total_refund,
                    balance_before, 
                    balance_after, 
                    description,
                    generation_id if generation_type == 'try_on' else None,
                    generation_id if generation_type == 'color_type' else None
                ))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({
                        'success': True,
                        'refunded': True,
                        'refund_type': 'paid',
                        'refund_amount': total_refund,
                        'new_balance': balance_after
                    })
                }
            
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Неизвестное действие'})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    finally:
        cur.close()
        conn.close()