import json
import os
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

def send_verification_email(email: str, token: str, user_name: str):
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    
    verify_url = f"https://p29007832.poehali.dev/verify-email?token={token}"
    
    message = MIMEMultipart('alternative')
    message['Subject'] = 'Подтвердите email - Виртуальная примерочная'
    message['From'] = smtp_user
    message['To'] = email
    
    text_content = f"""
Здравствуйте, {user_name}!

Спасибо за регистрацию в Виртуальной примерочной.

Пожалуйста, подтвердите ваш email, перейдя по ссылке:
{verify_url}

Ссылка действительна в течение 24 часов.

С уважением,
Команда Виртуальной примерочной
"""
    
    html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Подтверждение email</h2>
        <p>Здравствуйте, {user_name}!</p>
        <p>Спасибо за регистрацию в Виртуальной примерочной.</p>
        <p>
            <a href="{verify_url}" 
               style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                Подтвердить email
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Или скопируйте и вставьте эту ссылку в браузер:<br>
            <span style="color: #4F46E5;">{verify_url}</span>
        </p>
        <p style="color: #666; font-size: 14px;">
            Ссылка действительна в течение 24 часов.
        </p>
    </div>
</body>
</html>
"""
    
    text_part = MIMEText(text_content, 'plain', 'utf-8')
    html_part = MIMEText(html_content, 'html', 'utf-8')
    
    message.attach(text_part)
    message.attach(html_part)
    
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(message)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: User authentication (register, login)
    Args: event - dict with httpMethod, body (email, password, name)
          context - object with attributes: request_id, function_name
    Returns: HTTP response with user data and session token
    '''
    method: str = event.get('httpMethod', 'POST')
    path: str = event.get('path', '/')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
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
    
    body_str = event.get('body', '{}')
    if not body_str or body_str.strip() == '':
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Missing request body'})
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        body_data = json.loads(body_str)
        action = body_data.get('action')
        email = body_data.get('email')
        password = body_data.get('password')
        
        if not email or not password:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Missing email or password'})
            }
        
        if action == 'register':
            name = body_data.get('name')
            if not name:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing name'})
                }
            
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            existing_user = cursor.fetchone()
            
            if existing_user:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Email already registered'})
                }
            
            password_hash = hash_password(password)
            
            cursor.execute(
                """
                INSERT INTO users (email, password_hash, name, email_verified)
                VALUES (%s, %s, %s, false)
                RETURNING id, email, name, created_at
                """,
                (email, password_hash, name)
            )
            
            user = cursor.fetchone()
            user_id = user['id']
            
            verification_token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(hours=24)
            
            cursor.execute(
                """
                INSERT INTO email_verifications (user_id, token, expires_at)
                VALUES (%s, %s, %s)
                """,
                (user_id, verification_token, expires_at)
            )
            
            conn.commit()
            
            send_verification_email(email, verification_token, name)
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'message': 'Registration successful. Please check your email to verify your account.',
                    'email': email
                })
            }
        
        elif action == 'login':
            request_context = event.get('requestContext', {})
            identity = request_context.get('identity', {})
            ip_address = identity.get('sourceIp', 'unknown')
            
            cursor.execute(
                """
                DELETE FROM login_attempts 
                WHERE attempt_time < NOW() - INTERVAL '15 minutes'
                """
            )
            
            cursor.execute(
                """
                SELECT COUNT(*) as attempt_count 
                FROM login_attempts 
                WHERE ip_address = %s 
                AND attempt_time > NOW() - INTERVAL '15 minutes'
                AND success = false
                """,
                (ip_address,)
            )
            
            attempts = cursor.fetchone()
            if attempts['attempt_count'] >= 5:
                return {
                    'statusCode': 429,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Too many login attempts. Please try again in 15 minutes.'})
                }
            
            password_hash = hash_password(password)
            
            cursor.execute(
                "SELECT id, email, name, created_at, email_verified FROM users WHERE email = %s AND password_hash = %s",
                (email, password_hash)
            )
            
            user = cursor.fetchone()
            
            if not user:
                cursor.execute(
                    "INSERT INTO login_attempts (ip_address, email, success) VALUES (%s, %s, false)",
                    (ip_address, email)
                )
                conn.commit()
                
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Invalid email or password'})
                }
            
            if not user['email_verified']:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Email not verified. Please check your email.'})
                }
            
            cursor.execute(
                "INSERT INTO login_attempts (ip_address, email, success) VALUES (%s, %s, true)",
                (ip_address, email)
            )
            conn.commit()
            
            session_token = generate_session_token()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'user': {
                        'id': str(user['id']),
                        'email': user['email'],
                        'name': user['name'],
                        'created_at': user['created_at'].isoformat()
                    },
                    'session_token': session_token
                })
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