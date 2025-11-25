'''
Business: Admin endpoint to grant unlimited access to users
Args: event with httpMethod, headers (X-Admin-Password), body (user_email, unlimited_access)
Returns: Success confirmation or error
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
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    admin_password = event.get('headers', {}).get('X-Admin-Password') or event.get('headers', {}).get('x-admin-password')
    
    if admin_password != os.environ.get('ADMIN_PASSWORD'):
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Неверный пароль администратора'})
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute('''
                SELECT id, email, name, balance, free_tries_used, unlimited_access 
                FROM t_p29007832_virtual_fitting_room.users 
                ORDER BY created_at DESC
            ''')
            
            users = []
            for row in cur.fetchall():
                users.append({
                    'id': str(row[0]),
                    'email': row[1],
                    'name': row[2],
                    'balance': float(row[3]) if row[3] else 0,
                    'free_tries_used': row[4] or 0,
                    'unlimited_access': row[5] or False
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'users': users})
            }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            user_email = body_data.get('user_email')
            unlimited_access = body_data.get('unlimited_access', False)
            
            if not user_email:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Требуется user_email'})
                }
            
            cur.execute('''
                UPDATE t_p29007832_virtual_fitting_room.users 
                SET unlimited_access = %s, updated_at = CURRENT_TIMESTAMP 
                WHERE email = %s
                RETURNING id, email, name
            ''', (unlimited_access, user_email))
            
            result = cur.fetchone()
            
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Пользователь не найден'})
                }
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'user_id': str(result[0]),
                    'email': result[1],
                    'name': result[2],
                    'unlimited_access': unlimited_access
                })
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    finally:
        cur.close()
        conn.close()
