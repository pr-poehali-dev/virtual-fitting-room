'''
Business: Manage user balance, check limits, and deduct credits for try-on generations
Args: event with httpMethod, headers (X-User-Id), body
Returns: User balance info or updated balance after deduction
'''

import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Требуется авторизация'})
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
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Пользователь не найден'})
                }
            
            balance, free_tries_used, unlimited_access = result
            free_tries_remaining = max(0, 3 - free_tries_used) if not unlimited_access else 999
            paid_tries_available = int(balance / 30) if balance >= 30 else 0
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'balance': float(balance),
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
                steps = body_data.get('steps', 1)
                cost_per_step = 30
                total_cost = cost_per_step * steps
                
                cur.execute('''
                    SELECT balance, free_tries_used, unlimited_access 
                    FROM t_p29007832_virtual_fitting_room.users 
                    WHERE id = %s
                ''', (user_id,))
                
                result = cur.fetchone()
                if not result:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Пользователь не найден'})
                    }
                
                balance, free_tries_used, unlimited_access = result
                
                if unlimited_access:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True,
                            'unlimited': True,
                            'message': 'Безлимитный доступ',
                            'steps': steps
                        })
                    }
                
                if free_tries_used < 3:
                    cur.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.users 
                        SET free_tries_used = free_tries_used + 1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (user_id,))
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True,
                            'free_try': True,
                            'remaining_free': 2 - free_tries_used,
                            'steps': steps
                        })
                    }
                
                if balance >= total_cost:
                    cur.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.users 
                        SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (total_cost, user_id))
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True,
                            'paid_try': True,
                            'new_balance': float(balance - total_cost),
                            'cost': total_cost,
                            'steps': steps
                        })
                    }
                
                return {
                    'statusCode': 402,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'error': 'Недостаточно средств',
                        'balance': float(balance),
                        'required': total_cost,
                        'steps': steps
                    })
                }
            
            elif action == 'refund':
                steps = body_data.get('steps', 1)
                cost_per_step = 30
                total_refund = cost_per_step * steps
                
                cur.execute('''
                    SELECT balance, free_tries_used, unlimited_access 
                    FROM t_p29007832_virtual_fitting_room.users 
                    WHERE id = %s
                ''', (user_id,))
                
                result = cur.fetchone()
                if not result:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Пользователь не найден'})
                    }
                
                balance, free_tries_used, unlimited_access = result
                
                if unlimited_access:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True,
                            'unlimited': True,
                            'message': 'Безлимитный пользователь - возврат не требуется'
                        })
                    }
                
                if free_tries_used > 0 and free_tries_used <= 3:
                    cur.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.users 
                        SET free_tries_used = free_tries_used - 1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s AND free_tries_used > 0
                    ''', (user_id,))
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True,
                            'refunded': True,
                            'refund_type': 'free_try',
                            'new_free_tries': 3 - (free_tries_used - 1)
                        })
                    }
                
                cur.execute('''
                    UPDATE t_p29007832_virtual_fitting_room.users 
                    SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (total_refund, user_id))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'refunded': True,
                        'refund_type': 'paid',
                        'refund_amount': total_refund,
                        'new_balance': float(balance + total_refund)
                    })
                }
            
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Неизвестное действие'})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    finally:
        cur.close()
        conn.close()