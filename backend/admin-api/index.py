import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import boto3
from botocore.config import Config
import jwt

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def verify_admin_jwt(provided_token: str) -> tuple[bool, str]:
    '''
    Verify JWT token for admin authentication
    Returns: (is_valid, error_message)
    '''
    if not provided_token:
        return (False, 'Token required')
    
    try:
        secret_key = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = jwt.decode(provided_token, secret_key, algorithms=['HS256'])
        
        if not payload.get('admin'):
            return (False, 'Invalid token')
        
        return (True, '')
    except jwt.ExpiredSignatureError:
        return (False, 'Token expired')
    except jwt.InvalidTokenError:
        return (False, 'Invalid token')
    except Exception as e:
        return (False, f'Token verification failed: {str(e)}')

def verify_admin_password(provided_password: str, ip_address: str, cursor, conn) -> tuple[bool, str]:
    '''
    Verify admin password with rate limiting
    Returns: (is_valid, error_message)
    '''
    admin_password = os.environ.get('ADMIN_PASSWORD')
    
    print(f'[DEBUG] Provided password: "{provided_password}" (len={len(provided_password) if provided_password else 0})')
    print(f'[DEBUG] Expected password from env: exists={admin_password is not None}, len={len(admin_password) if admin_password else 0}')
    print(f'[DEBUG] Match result: {provided_password == admin_password}')
    
    # Check rate limiting - max 5 failed attempts per IP in 15 minutes
    cursor.execute(
        """
        SELECT COUNT(*) as attempt_count
        FROM admin_login_attempts
        WHERE ip_address = %s
        AND attempt_time > NOW() - INTERVAL '15 minutes'
        AND success = false
        """,
        (ip_address,)
    )
    result = cursor.fetchone()
    failed_attempts = result['attempt_count'] if result else 0
    
    if failed_attempts >= 5:
        return (False, 'Too many failed login attempts. Please try again in 15 minutes.')
    
    is_valid = provided_password == admin_password
    
    # Log the attempt
    cursor.execute(
        """
        INSERT INTO admin_login_attempts (ip_address, success, attempt_time)
        VALUES (%s, %s, NOW())
        """,
        (ip_address, is_valid)
    )
    conn.commit()
    
    if not is_valid:
        return (False, 'Invalid admin password')
    
    return (True, '')

def delete_user_folder_from_s3(user_id: str) -> int:
    '''
    Delete all files in user's S3 folder
    Returns: number of deleted files
    '''
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
            aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
            region_name='ru-central1',
            config=Config(signature_version='s3v4')
        )
        
        s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
        user_folder_prefix = f'images/lookbooks/{user_id}/'
        
        deleted_count = 0
        continuation_token = None
        
        # List and delete all files in user's folder (may require pagination)
        while True:
            list_params = {
                'Bucket': s3_bucket_name,
                'Prefix': user_folder_prefix
            }
            
            if continuation_token:
                list_params['ContinuationToken'] = continuation_token
            
            response = s3_client.list_objects_v2(**list_params)
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    s3_client.delete_object(
                        Bucket=s3_bucket_name,
                        Key=obj['Key']
                    )
                    deleted_count += 1
            
            # Check if there are more files to list
            if response.get('IsTruncated'):
                continuation_token = response.get('NextContinuationToken')
            else:
                break
        
        return deleted_count
    except Exception as e:
        print(f'Error deleting S3 folder for user {user_id}: {str(e)}')
        return 0

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Admin API for managing users, lookbooks and viewing statistics
    Args: event - dict with httpMethod, queryStringParameters, headers
          context - object with attributes: request_id, function_name
    Returns: HTTP response with admin data
    Updated: 2025-12-12 - redeploy to pick up new ADMIN_PASSWORD
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    headers = event.get('headers', {})
    admin_token = headers.get('x-admin-token') or headers.get('X-Admin-Token')
    
    if not admin_token:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Unauthorized: Token required'})
        }
    
    is_valid, error_message = verify_admin_jwt(admin_token)
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_message})
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        query_params = event.get('queryStringParameters') or {}
        action = query_params.get('action', 'stats')
        
        if action == 'login':
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'success': True})
            }
        
        if action == 'stats':
            cursor.execute("SELECT COUNT(*) as total FROM users")
            total_users = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM lookbooks")
            total_lookbooks = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM try_on_history WHERE model_used = 'replicate'")
            total_replicate = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM try_on_history WHERE model_used = 'seedream'")
            total_seedream = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM try_on_history WHERE model_used = 'nanobananapro'")
            total_nanobana = cursor.fetchone()['total']
            
            today = datetime.now().date()
            cursor.execute(
                "SELECT COUNT(*) as total FROM try_on_history WHERE DATE(created_at) = %s AND model_used = 'replicate'",
                (today,)
            )
            today_replicate = cursor.fetchone()['total']
            
            cursor.execute(
                "SELECT COUNT(*) as total FROM try_on_history WHERE DATE(created_at) = %s AND model_used = 'seedream'",
                (today,)
            )
            today_seedream = cursor.fetchone()['total']
            
            cursor.execute(
                "SELECT COUNT(*) as total FROM try_on_history WHERE DATE(created_at) = %s AND model_used = 'nanobananapro'",
                (today,)
            )
            today_nanobana = cursor.fetchone()['total']
            
            cursor.execute(
                "SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE status = 'completed'"
            )
            total_revenue = cursor.fetchone()['total']
            
            cursor.execute(
                "SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE status = 'completed' AND DATE(created_at) = %s",
                (today,)
            )
            today_revenue = cursor.fetchone()['total']
            
            cursor.execute(
                "SELECT COUNT(*) as total FROM payment_transactions WHERE status = 'completed'"
            )
            total_payments = cursor.fetchone()['total']
            
            thirty_days_ago = today - timedelta(days=30)
            cursor.execute(
                "SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE status = 'completed' AND created_at >= %s",
                (thirty_days_ago,)
            )
            month_revenue = cursor.fetchone()['total']
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'total_users': total_users,
                    'total_lookbooks': total_lookbooks,
                    'total_replicate': total_replicate,
                    'total_seedream': total_seedream,
                    'total_nanobana': total_nanobana,
                    'today_replicate': today_replicate,
                    'today_seedream': today_seedream,
                    'today_nanobana': today_nanobana,
                    'total_revenue': float(total_revenue),
                    'today_revenue': float(today_revenue),
                    'month_revenue': float(month_revenue),
                    'total_payments': total_payments
                })
            }
        
        elif action == 'users':
            limit = query_params.get('limit', '1000')
            offset = query_params.get('offset', '0')
            
            try:
                limit = int(limit)
                offset = int(offset)
            except ValueError:
                limit = 1000
                offset = 0
            
            cursor.execute("SELECT COUNT(*) as total FROM users")
            total = cursor.fetchone()['total']
            
            cursor.execute(
                "SELECT id, email, name, balance, free_tries_used, unlimited_access, created_at FROM users ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (limit, offset)
            )
            users = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'users': [{
                        'id': u['id'],
                        'email': u['email'],
                        'name': u['name'],
                        'balance': float(u['balance']) if u['balance'] else 0,
                        'free_tries_used': u['free_tries_used'] or 0,
                        'unlimited_access': u['unlimited_access'] or False,
                        'created_at': u['created_at'].isoformat()
                    } for u in users],
                    'total': total
                })
            }
        
        elif action == 'lookbooks':
            limit = query_params.get('limit', '1000')
            offset = query_params.get('offset', '0')
            
            try:
                limit = int(limit)
                offset = int(offset)
            except ValueError:
                limit = 1000
                offset = 0
            
            cursor.execute("SELECT COUNT(*) as total FROM lookbooks")
            total = cursor.fetchone()['total']
            
            cursor.execute(
                "SELECT id, user_id, name, person_name, photos, created_at FROM lookbooks ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (limit, offset)
            )
            lookbooks = cursor.fetchall()
            
            result = []
            for lb in lookbooks:
                photos_value = lb['photos']
                if isinstance(photos_value, str):
                    try:
                        photos_array = json.loads(photos_value)
                    except:
                        photos_array = []
                elif photos_value is None:
                    photos_array = []
                else:
                    photos_array = photos_value
                
                result.append({
                    'id': str(lb['id']),
                    'user_id': lb['user_id'],
                    'name': lb['name'],
                    'person_name': lb['person_name'],
                    'photos': photos_array,
                    'created_at': lb['created_at'].isoformat()
                })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'lookbooks': result,
                    'total': total
                })
            }
        
        elif action == 'history':
            cursor.execute(
                "SELECT id, user_id, created_at FROM try_on_history ORDER BY created_at DESC LIMIT 100"
            )
            history = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps([{
                    'id': str(h['id']),
                    'user_id': h['user_id'],
                    'created_at': h['created_at'].isoformat()
                } for h in history])
            }
        
        elif action == 'generation_history':
            # Build WHERE clause based on filters
            filters = []
            filter_values = []
            
            user_id_filter = query_params.get('user_id')
            model_filter = query_params.get('model')
            saved_filter = query_params.get('saved_to_lookbook')
            date_from = query_params.get('date_from')
            date_to = query_params.get('date_to')
            
            if user_id_filter:
                filters.append("h.user_id = %s")
                filter_values.append(user_id_filter)
            
            if model_filter:
                filters.append("h.model_used = %s")
                filter_values.append(model_filter)
            
            if saved_filter == 'true':
                filters.append("h.saved_to_lookbook = true")
            elif saved_filter == 'false':
                filters.append("h.saved_to_lookbook = false")
            
            if date_from:
                filters.append("h.created_at >= %s")
                filter_values.append(date_from)
            
            if date_to:
                filters.append("h.created_at <= %s")
                filter_values.append(date_to)
            
            where_clause = " AND ".join(filters) if filters else "1=1"
            
            query = f"""
                SELECT 
                    h.id,
                    h.user_id,
                    u.email as user_email,
                    u.name as user_name,
                    h.model_used,
                    h.saved_to_lookbook,
                    h.cost,
                    h.result_image,
                    h.created_at,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM lookbooks l WHERE h.user_id = l.user_id AND h.result_image = ANY(l.photos)) THEN 'in_lookbook'
                        WHEN h.created_at >= NOW() - INTERVAL '180 days' THEN 'in_history'
                        ELSE 'removed'
                    END as photo_status
                FROM try_on_history h
                LEFT JOIN users u ON h.user_id = u.id
                WHERE {where_clause}
                ORDER BY h.created_at DESC
                LIMIT 500
            """
            
            cursor.execute(query, filter_values)
            history = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps([{
                    'id': str(h['id']),
                    'user_id': str(h['user_id']) if h['user_id'] else None,
                    'user_email': h['user_email'],
                    'user_name': h['user_name'],
                    'model_used': h['model_used'],
                    'saved_to_lookbook': h['saved_to_lookbook'],
                    'cost': float(h['cost']) if h['cost'] else 0,
                    'photo_status': h['photo_status'],
                    'result_image': h['result_image'],
                    'created_at': h['created_at'].isoformat()
                } for h in history])
            }
        
        elif action == 'payments':
            limit = query_params.get('limit', '1000')
            offset = query_params.get('offset', '0')
            type_filter = query_params.get('type')
            date_from = query_params.get('date_from')
            date_to = query_params.get('date_to')
            
            try:
                limit = int(limit)
                offset = int(offset)
            except ValueError:
                limit = 1000
                offset = 0
            
            # Count total transactions
            count_query = '''
                SELECT COUNT(*) as total
                FROM balance_transactions bt
                WHERE 1=1
            '''
            count_params = []
            
            if type_filter:
                count_query += " AND bt.type = %s"
                count_params.append(type_filter)
            
            if date_from:
                count_query += " AND bt.created_at >= %s"
                count_params.append(date_from)
            
            if date_to:
                count_query += " AND bt.created_at <= %s"
                count_params.append(date_to)
            
            cursor.execute(count_query, count_params)
            total = cursor.fetchone()['total']
            
            # Get transactions with pagination
            query = '''
                SELECT 
                    bt.id,
                    bt.user_id,
                    bt.type,
                    bt.amount,
                    bt.balance_before,
                    bt.balance_after,
                    bt.description,
                    bt.created_at,
                    bt.try_on_id,
                    bt.color_type_id,
                    bt.yookassa_payment_id,
                    u.email,
                    u.name,
                    th.removed_at AS try_on_removed,
                    th.saved_to_lookbook,
                    ct.removed_at AS color_removed
                FROM balance_transactions bt
                LEFT JOIN users u ON bt.user_id = u.id
                LEFT JOIN try_on_history th ON bt.try_on_id = th.id
                LEFT JOIN color_type_history ct ON bt.color_type_id = ct.id
                WHERE 1=1
            '''
            params = []
            
            if type_filter:
                query += " AND bt.type = %s"
                params.append(type_filter)
            
            if date_from:
                query += " AND bt.created_at >= %s"
                params.append(date_from)
            
            if date_to:
                query += " AND bt.created_at <= %s"
                params.append(date_to)
            
            query += " ORDER BY bt.created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            transactions = cursor.fetchall()
            
            result_transactions = []
            for t in transactions:
                display_description = t['description']
                
                if t['try_on_id'] and t['try_on_removed']:
                    if t['saved_to_lookbook']:
                        display_description = 'Виртуальная примерочная [УДАЛЕНО ИЗ ЛУКБУКА]'
                    else:
                        display_description = 'Виртуальная примерочная [УДАЛЕНО ИЗ ИСТОРИИ]'
                elif t['color_type_id'] and t['color_removed']:
                    display_description = 'Определение цветотипа [УДАЛЕНО ИЗ ИСТОРИИ]'
                
                result_transactions.append({
                    'id': str(t['id']),
                    'user_id': t['user_id'],
                    'user_email': t['email'],
                    'user_name': t['name'],
                    'type': t['type'],
                    'amount': float(t['amount']),
                    'balance_before': float(t['balance_before']),
                    'balance_after': float(t['balance_after']),
                    'description': display_description,
                    'yookassa_payment_id': t['yookassa_payment_id'],
                    'created_at': t['created_at'].isoformat(),
                    'is_deleted': bool(t['try_on_removed'] or t['color_removed'])
                })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'payments': result_transactions,
                    'total': total
                })
            }
        
        elif action == 'refund' and method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            user_id = body_data.get('user_id')
            amount = body_data.get('amount', 30)
            reason = body_data.get('reason', 'Возврат администратором')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing user_id'})
                }
            
            try:
                # Get current balance
                cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
                user_row = cursor.fetchone()
                
                if not user_row:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'User not found'})
                    }
                
                balance_before = float(user_row['balance'])
                balance_after = balance_before + amount
                
                # Update balance
                cursor.execute('UPDATE users SET balance = balance + %s WHERE id = %s', (amount, user_id))
                
                # Record transaction
                cursor.execute('''
                    INSERT INTO balance_transactions
                    (user_id, type, amount, balance_before, balance_after, description)
                    VALUES (%s, 'refund', %s, %s, %s, %s)
                ''', (user_id, amount, balance_before, balance_after, reason))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'success': True,
                        'new_balance': balance_after,
                        'refund_amount': amount
                    })
                }
            
            except Exception as e:
                conn.rollback()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': f'Refund failed: {str(e)}'})
                }
        
        elif action == 'deduct_balance' and method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            user_id = body_data.get('user_id')
            amount = body_data.get('amount')
            reason = body_data.get('reason', 'Списание администратором')
            
            if not user_id or not amount:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing user_id or amount'})
                }
            
            if amount <= 0:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Amount must be positive'})
                }
            
            try:
                # Get current balance
                cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
                user_row = cursor.fetchone()
                
                if not user_row:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'User not found'})
                    }
                
                balance_before = float(user_row['balance'])
                
                if balance_before < amount:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': f'Insufficient balance. Current: {balance_before}₽, Required: {amount}₽'})
                    }
                
                balance_after = balance_before - amount
                
                # Update balance (deduct)
                cursor.execute('UPDATE users SET balance = balance - %s WHERE id = %s', (amount, user_id))
                
                # Record transaction with negative amount for charge
                cursor.execute('''
                    INSERT INTO balance_transactions
                    (user_id, type, amount, balance_before, balance_after, description)
                    VALUES (%s, 'charge', %s, %s, %s, %s)
                ''', (user_id, -amount, balance_before, balance_after, reason))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'success': True,
                        'new_balance': balance_after,
                        'deducted_amount': amount
                    })
                }
            
            except Exception as e:
                conn.rollback()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': f'Deduction failed: {str(e)}'})
                }
        
        elif action == 'delete_user' and method == 'DELETE':
            user_id = query_params.get('user_id')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing user_id'})
                }
            
            cursor.execute("DELETE FROM try_on_history WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM lookbooks WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM email_verifications WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM payment_transactions WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM nanobananapro_tasks WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM replicate_tasks WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM seedream_tasks WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM history_api_debug_log WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = %s)", (user_id,))
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            
            conn.commit()
            
            # Delete user's S3 folder after successful DB deletion
            deleted_files_count = delete_user_folder_from_s3(user_id)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'success': True})
            }
        
        elif action == 'delete_lookbook' and method == 'DELETE':
            lookbook_id = query_params.get('lookbook_id')
            
            if not lookbook_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing lookbook_id'})
                }
            
            cursor.execute("DELETE FROM lookbooks WHERE id = %s", (lookbook_id,))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'success': True})
            }
        
        elif action == 'clear_generation_history' and method == 'DELETE':
            cursor.execute("DELETE FROM try_on_history")
            deleted_count = cursor.rowcount
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'success': True, 'deleted': deleted_count})
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Invalid action'})
            }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()