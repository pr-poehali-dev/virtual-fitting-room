import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def verify_admin_password(provided_password: str) -> bool:
    admin_password = os.environ.get('ADMIN_PASSWORD')
    return provided_password == admin_password

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Admin API for managing users, lookbooks and viewing statistics
    Args: event - dict with httpMethod, queryStringParameters, headers
          context - object with attributes: request_id, function_name
    Returns: HTTP response with admin data
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    headers = event.get('headers', {})
    admin_password = headers.get('x-admin-password') or headers.get('X-Admin-Password')
    
    if not admin_password or not verify_admin_password(admin_password):
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Unauthorized'})
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
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'success': True})
            }
        
        if action == 'stats':
            cursor.execute("SELECT COUNT(*) as total FROM users")
            total_users = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM lookbooks")
            total_lookbooks = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as total FROM try_on_history")
            total_try_ons = cursor.fetchone()['total']
            
            today = datetime.now().date()
            cursor.execute(
                "SELECT COUNT(*) as total FROM try_on_history WHERE DATE(created_at) = %s",
                (today,)
            )
            today_try_ons = cursor.fetchone()['total']
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'total_users': total_users,
                    'total_lookbooks': total_lookbooks,
                    'total_try_ons': total_try_ons,
                    'today_try_ons': today_try_ons
                })
            }
        
        elif action == 'users':
            cursor.execute(
                "SELECT id, email, name, balance, free_tries_used, unlimited_access, created_at FROM users ORDER BY created_at DESC"
            )
            users = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps([{
                    'id': u['id'],
                    'email': u['email'],
                    'name': u['name'],
                    'balance': float(u['balance']) if u['balance'] else 0,
                    'free_tries_used': u['free_tries_used'] or 0,
                    'unlimited_access': u['unlimited_access'] or False,
                    'created_at': u['created_at'].isoformat()
                } for u in users])
            }
        
        elif action == 'lookbooks':
            cursor.execute(
                "SELECT id, user_id, name, person_name, photos, created_at FROM lookbooks ORDER BY created_at DESC"
            )
            lookbooks = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps([{
                    'id': str(lb['id']),
                    'user_id': lb['user_id'],
                    'name': lb['name'],
                    'person_name': lb['person_name'],
                    'photos': lb['photos'] or [],
                    'created_at': lb['created_at'].isoformat()
                } for lb in lookbooks])
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
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps([{
                    'id': str(h['id']),
                    'user_id': h['user_id'],
                    'created_at': h['created_at'].isoformat()
                } for h in history])
            }
        
        elif action == 'payments':
            status_filter = query_params.get('status')
            date_from = query_params.get('date_from')
            date_to = query_params.get('date_to')
            
            query = '''
                SELECT 
                    pt.id,
                    pt.user_id,
                    pt.amount,
                    pt.payment_method,
                    pt.status,
                    pt.order_id,
                    pt.created_at,
                    pt.updated_at,
                    u.email,
                    u.name
                FROM payment_transactions pt
                LEFT JOIN users u ON pt.user_id = u.id
                WHERE 1=1
            '''
            params = []
            
            if status_filter:
                query += " AND pt.status = %s"
                params.append(status_filter)
            
            if date_from:
                query += " AND pt.created_at >= %s"
                params.append(date_from)
            
            if date_to:
                query += " AND pt.created_at <= %s"
                params.append(date_to)
            
            query += " ORDER BY pt.created_at DESC"
            
            cursor.execute(query, params)
            payments = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps([{
                    'id': str(p['id']),
                    'user_id': p['user_id'],
                    'user_email': p['email'],
                    'user_name': p['name'],
                    'amount': float(p['amount']),
                    'payment_method': p['payment_method'],
                    'status': p['status'],
                    'order_id': p['order_id'],
                    'created_at': p['created_at'].isoformat(),
                    'updated_at': p['updated_at'].isoformat() if p['updated_at'] else None
                } for p in payments])
            }
        
        elif action == 'delete_user' and method == 'DELETE':
            user_id = query_params.get('user_id')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing user_id'})
                }
            
            cursor.execute("DELETE FROM try_on_history WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM lookbooks WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
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
                        'Access-Control-Allow-Origin': '*'
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
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'success': True})
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
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
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()