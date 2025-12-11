import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Change user password from profile
    Args: event - dict with httpMethod, body, headers
          context - object with attributes: request_id, function_name
    Returns: HTTP response
    '''
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('x-user-id') or headers.get('X-User-Id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Unauthorized - User ID required'})
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        body_str = event.get('body', '{}')
        body_data = json.loads(body_str)
        
        current_password = body_data.get('current_password')
        new_password = body_data.get('new_password')
        
        if not current_password or not new_password:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Current and new password required'})
            }
        
        if len(new_password) < 6:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Password must be at least 6 characters'})
            }
        
        user_id_escaped = user_id.replace("'", "''")
        
        cursor.execute(f"SELECT password_hash FROM users WHERE id = '{user_id_escaped}'")
        user = cursor.fetchone()
        
        if not user:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'User not found'})
            }
        
        if not bcrypt.checkpw(current_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Current password is incorrect'})
            }
        
        new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_password_hash_escaped = new_password_hash.replace("'", "''")
        
        cursor.execute(
            f"UPDATE users SET password_hash = '{new_password_hash_escaped}', updated_at = CURRENT_TIMESTAMP WHERE id = '{user_id_escaped}'"
        )
        
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'message': 'Password changed successfully'})
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