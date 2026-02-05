import json
import os
import psycopg2
import uuid
from typing import Dict, Any
import requests
import base64

YOOKASSA_API = 'https://api.yookassa.ru/v3'

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f"[DEBUG] Received event: {json.dumps(event)}")
    
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    path: str = event.get('path', '')
    print(f"[DEBUG] Method: {method}, Path: {path}")
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': f'Database connection error: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    try:
        if method == 'POST' and '/webhook' not in path:
            body_data = json.loads(event.get('body', '{}'))
            user_id = body_data.get('user_id')
            amount = body_data.get('amount')
            
            if not user_id or not amount:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'Требуется user_id и amount'}),
                    'isBase64Encoded': False
                }
            
            if amount < 30:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'Минимальная сумма пополнения — 30 рублей'}),
                    'isBase64Encoded': False
                }
            
            cur.execute('''
                INSERT INTO t_p29007832_virtual_fitting_room.payment_transactions 
                (user_id, amount, status, payment_method) 
                VALUES (%s, %s, 'pending', 'yookassa') 
                RETURNING id
            ''', (user_id, amount))
            
            transaction = cur.fetchone()
            transaction_id = str(transaction[0])
            conn.commit()
            
            site_url = os.environ.get('SITE_URL', 'https://fitting-room.ru')
            shop_id = os.environ.get('YUKASSA_SHOP_ID')
            secret_key = os.environ.get('YUKASSA_SECRET_KEY')
            
            if not shop_id or not secret_key:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'ЮКасса не настроена. Ожидаем подключения.'}),
                    'isBase64Encoded': False
                }
            
            idempotence_key = str(uuid.uuid4())
            
            payment_data = {
                'amount': {
                    'value': f'{amount:.2f}',
                    'currency': 'RUB'
                },
                'confirmation': {
                    'type': 'redirect',
                    'return_url': f'{site_url}/profile?tab=wallet'
                },
                'capture': True,
                'description': f'Пополнение баланса на {amount} ₽',
                'metadata': {
                    'transaction_id': transaction_id,
                    'user_id': user_id
                }
            }
            
            auth_string = f'{shop_id}:{secret_key}'
            auth_encoded = base64.b64encode(auth_string.encode()).decode()
            
            try:
                response = requests.post(
                    f'{YOOKASSA_API}/payments',
                    json=payment_data,
                    headers={
                        'Authorization': f'Basic {auth_encoded}',
                        'Idempotence-Key': idempotence_key,
                        'Content-Type': 'application/json'
                    },
                    timeout=10
                )
                
                result = response.json()
                
                if response.status_code in [200, 201]:
                    yookassa_payment_id = result.get('id')
                    confirmation_url = result.get('confirmation', {}).get('confirmation_url')
                    
                    cur.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.payment_transactions 
                        SET yookassa_payment_id = %s, yookassa_status = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (yookassa_payment_id, result.get('status'), transaction_id))
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'body': json.dumps({
                            'payment_url': confirmation_url,
                            'payment_id': yookassa_payment_id,
                            'transaction_id': transaction_id
                        }),
                        'isBase64Encoded': False
                    }
                else:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'body': json.dumps({
                            'error': 'Ошибка создания платежа',
                            'details': result
                        }),
                        'isBase64Encoded': False
                    }
            
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': f'Ошибка API ЮКассы: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST' and '/webhook' in path:
            body_data = json.loads(event.get('body', '{}'))
            
            event_type = body_data.get('event')
            payment_object = body_data.get('object', {})
            
            if event_type == 'payment.succeeded':
                yookassa_payment_id = payment_object.get('id')
                amount_value = float(payment_object.get('amount', {}).get('value', 0))
                metadata = payment_object.get('metadata', {})
                transaction_id = metadata.get('transaction_id')
                user_id = metadata.get('user_id')
                
                if transaction_id and user_id:
                    cur.execute('''
                        SELECT status, amount FROM t_p29007832_virtual_fitting_room.payment_transactions 
                        WHERE id = %s
                    ''', (transaction_id,))
                    
                    transaction = cur.fetchone()
                    if transaction and transaction[0] == 'pending':
                        amount = transaction[1]
                        
                        cur.execute('''
                            SELECT balance FROM t_p29007832_virtual_fitting_room.users 
                            WHERE id = %s
                        ''', (user_id,))
                        user_data = cur.fetchone()
                        balance_before = float(user_data[0]) if user_data else 0
                        balance_after = balance_before + float(amount)
                        
                        cur.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.payment_transactions 
                            SET status = 'completed', yookassa_status = 'succeeded', updated_at = CURRENT_TIMESTAMP 
                            WHERE id = %s
                        ''', (transaction_id,))
                        
                        cur.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.users 
                            SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP 
                            WHERE id = %s
                        ''', (amount, user_id))
                        
                        cur.execute('''
                            INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                            (user_id, type, amount, balance_before, balance_after, description, payment_transaction_id, yookassa_payment_id)
                            VALUES (%s, 'deposit', %s, %s, %s, 'Пополнение через ЮКасса', %s, %s)
                        ''', (user_id, amount, balance_before, balance_after, transaction_id, yookassa_payment_id))
                        
                        conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'status': 'ok'}),
                'isBase64Encoded': False
            }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {})
            payment_id = params.get('payment_id')
            
            if not payment_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'Требуется payment_id'}),
                    'isBase64Encoded': False
                }
            
            shop_id = os.environ.get('YUKASSA_SHOP_ID')
            secret_key = os.environ.get('YUKASSA_SECRET_KEY')
            
            if not shop_id or not secret_key:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'ЮКасса не настроена'}),
                    'isBase64Encoded': False
                }
            
            auth_string = f'{shop_id}:{secret_key}'
            auth_encoded = base64.b64encode(auth_string.encode()).decode()
            
            try:
                response = requests.get(
                    f'{YOOKASSA_API}/payments/{payment_id}',
                    headers={'Authorization': f'Basic {auth_encoded}'},
                    timeout=10
                )
                
                result = response.json()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({
                        'status': result.get('status'),
                        'amount': result.get('amount', {}).get('value')
                    }),
                    'isBase64Encoded': False
                }
            
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': f'Ошибка проверки статуса: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': 'Метод не поддерживается'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': f'Unexpected error: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        try:
            if 'cur' in locals():
                cur.close()
            if 'conn' in locals():
                conn.close()
        except:
            pass