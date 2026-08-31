import json
import os
import hashlib
import secrets
import smtplib
from typing import Dict, Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt

def get_db_connection():
    # Force redeploy v2
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def email_fingerprint(email: str) -> str:
    """Необратимый отпечаток почты: сам адрес не хранится и не восстановим."""
    salt = os.environ.get('JWT_SECRET_KEY', 'bonus-guard')
    normalized = (email or '').strip().lower()
    if not normalized:
        return ''
    return hashlib.sha256(f'{salt}:{normalized}'.encode('utf-8')).hexdigest()


def grant_registration_bonus(cursor, email: str, user_id: str) -> None:
    """Начисляет бонус за регистрацию, если акция включена.

    Повторно на ту же почту бонус не выдаётся: при удалении аккаунта
    остаётся отпечаток, по нему и сверяемся.
    """
    fingerprint = email_fingerprint(email)
    if not fingerprint:
        return

    cursor.execute(
        'SELECT 1 FROM bonus_registration_guard WHERE email_hash = %s',
        (fingerprint,),
    )
    if cursor.fetchone():
        print('[REGISTER] Bonus already granted for this email earlier')
        return

    cursor.execute(
        """SELECT id, code, title, bonus_amount, expires_days
             FROM bonus_promotions
            WHERE is_active = true AND trigger_type = 'registration'
              AND bonus_amount > 0
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
            ORDER BY sort_order ASC
            LIMIT 1"""
    )
    promo = cursor.fetchone()
    if not promo:
        return

    bonus_amount = round(float(promo['bonus_amount']), 2)
    if bonus_amount <= 0:
        return

    cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
    row = cursor.fetchone()
    before = round(float(row['balance']), 2) if row else 0.0
    after = round(before + bonus_amount, 2)

    cursor.execute(
        'UPDATE users SET balance = balance + %s WHERE id = %s',
        (bonus_amount, user_id),
    )
    cursor.execute(
        """INSERT INTO bonus_grants
           (user_id, promotion_id, promotion_code, reason, amount, expires_at, created_by)
           VALUES (%s, %s, %s, %s, %s,
                   CASE WHEN %s::int IS NULL THEN NULL
                        ELSE NOW() + (%s::int || ' days')::interval END,
                   'system')""",
        (user_id, promo['id'], promo['code'], promo['title'], bonus_amount,
         promo['expires_days'], promo['expires_days']),
    )
    cursor.execute(
        """INSERT INTO balance_transactions
           (user_id, type, amount, balance_before, balance_after, description)
           VALUES (%s, 'deposit', %s, %s, %s, %s)""",
        (user_id, bonus_amount, before, after, f"Бонусные рубли: {promo['title']}"),
    )
    cursor.execute(
        """INSERT INTO bonus_registration_guard (email_hash, source)
           VALUES (%s, 'email') ON CONFLICT (email_hash) DO NOTHING""",
        (fingerprint,),
    )
    print(f'[REGISTER] Bonus {bonus_amount} granted to {user_id}')

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

def save_session_to_db(cursor, conn, user_id: str, token: str, ip_address: str, user_agent: str):
    '''
    Save session token to database for validation and revocation
    '''
    expires_at = datetime.now() + timedelta(days=7)
    cursor.execute(
        """
        INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_id, token, expires_at, ip_address, user_agent)
    )
    conn.commit()

def validate_session_token(cursor, token: str) -> tuple[bool, str]:
    '''
    Validate session token from database
    Returns: (is_valid, user_id or error_message)
    '''
    if not token:
        return (False, 'Token required')
    
    cursor.execute(
        """
        SELECT user_id, expires_at FROM sessions 
        WHERE token = %s
        """,
        (token,)
    )
    session = cursor.fetchone()
    
    if not session:
        return (False, 'Invalid token')
    
    if datetime.now() > session['expires_at']:
        return (False, 'Token expired')
    
    # Update last_used_at
    cursor.execute(
        "UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token = %s",
        (token,)
    )
    
    return (True, str(session['user_id']))

def check_rate_limit(cursor, conn, ip_address: str, email: str) -> tuple[bool, str]:
    '''
    Check rate limiting - max 5 failed attempts per IP in 15 minutes
    OR max 10 failed attempts per email in 1 hour
    Returns: (is_allowed, error_message)
    '''
    # Check IP-based rate limit
    cursor.execute(
        """
        SELECT COUNT(*) as attempt_count
        FROM user_login_attempts
        WHERE ip_address = %s
        AND attempt_time > NOW() - INTERVAL '15 minutes'
        AND success = false
        """,
        (ip_address,)
    )
    result = cursor.fetchone()
    ip_failed_attempts = result['attempt_count'] if result else 0
    
    if ip_failed_attempts >= 5:
        return (False, 'Too many failed login attempts from this IP. Please try again in 15 minutes.')
    
    # Check email-based rate limit
    cursor.execute(
        """
        SELECT COUNT(*) as attempt_count
        FROM user_login_attempts
        WHERE email = %s
        AND attempt_time > NOW() - INTERVAL '1 hour'
        AND success = false
        """,
        (email,)
    )
    result = cursor.fetchone()
    email_failed_attempts = result['attempt_count'] if result else 0
    
    if email_failed_attempts >= 10:
        return (False, 'Too many failed login attempts for this account. Please try again in 1 hour or reset your password.')
    
    return (True, '')

def log_login_attempt(cursor, conn, ip_address: str, email: str, success: bool):
    '''
    Log login attempt for rate limiting
    '''
    cursor.execute(
        """
        INSERT INTO user_login_attempts (ip_address, email, success, attempt_time)
        VALUES (%s, %s, %s, NOW())
        """,
        (ip_address, email, success)
    )
    conn.commit()

def send_verification_email(email: str, token: str, user_name: str):
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    
    site_url = 'https://fitting-room.ru'
    verify_url = f"{site_url}/verify-email?token={token}"
    
    message = MIMEMultipart('alternative')
    message['Subject'] = 'Подтвердите email - Виртуальная примерочная'
    message['From'] = 'virtualfitting@mail.ru'
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
    
    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(message)
    else:
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
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        return origin if origin else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'POST')
    path: str = event.get('path', '/')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
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
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Missing request body'})
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get real IP address (behind proxy/CDN)
    headers = event.get('headers', {})
    x_forwarded_for = headers.get('x-forwarded-for') or headers.get('X-Forwarded-For', '')
    x_real_ip = headers.get('x-real-ip') or headers.get('X-Real-IP', '')
    
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(',')[0].strip()
    elif x_real_ip:
        ip_address = x_real_ip
    else:
        ip_address = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
    
    try:
        body_data = json.loads(body_str)
        action = body_data.get('action')
        
        # validate and logout don't require email/password
        if action not in ['validate', 'logout']:
            email = body_data.get('email')
            password = body_data.get('password')
            
            if not email or not password:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing email or password'})
                }
        else:
            email = None
            password = None
        
        if action == 'register':
            name = body_data.get('name')
            if not name:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
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
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
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

            # Бонус за регистрацию. Отдельно и после создания аккаунта:
            # любой сбой здесь не мешает человеку зарегистрироваться
            try:
                grant_registration_bonus(cursor, email, user_id)
            except Exception as bonus_error:
                print(f'[REGISTER] Bonus skipped: {bonus_error}')

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
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'message': 'Registration successful. Please check your email to verify your account.',
                    'email': email
                })
            }
        
        elif action == 'login':
            # Get real IP address (behind proxy/CDN)
            headers = event.get('headers', {})
            x_forwarded_for = headers.get('x-forwarded-for') or headers.get('X-Forwarded-For', '')
            x_real_ip = headers.get('x-real-ip') or headers.get('X-Real-IP', '')
            
            # X-Forwarded-For may contain multiple IPs: "client, proxy1, proxy2"
            # Take the first one (real client IP)
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0].strip()
            elif x_real_ip:
                ip_address = x_real_ip
            else:
                # Fallback to context IP (may be proxy IP)
                request_context = event.get('requestContext', {})
                identity = request_context.get('identity', {})
                ip_address = identity.get('sourceIp', 'unknown')
            
            # Clean old attempts
            cursor.execute(
                """
                DELETE FROM login_attempts 
                WHERE attempt_time < NOW() - INTERVAL '1 hour'
                """
            )
            
            # Check IP-based rate limit (5 attempts in 15 minutes)
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
            
            ip_attempts = cursor.fetchone()
            if ip_attempts['attempt_count'] >= 5:
                return {
                    'statusCode': 429,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Too many login attempts from this IP. Please try again in 15 minutes.'})
                }
            
            # Check email-based rate limit (10 attempts in 1 hour)
            cursor.execute(
                """
                SELECT COUNT(*) as attempt_count 
                FROM login_attempts 
                WHERE email = %s 
                AND attempt_time > NOW() - INTERVAL '1 hour'
                AND success = false
                """,
                (email,)
            )
            
            email_attempts = cursor.fetchone()
            if email_attempts['attempt_count'] >= 10:
                return {
                    'statusCode': 429,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Too many failed login attempts for this account. Please try again in 1 hour or reset your password.'})
                }
            
            # Get user with password hash
            cursor.execute(
                "SELECT id, email, name, created_at, email_verified, password_hash, balance, unlimited_access, avatar_url FROM users WHERE email = %s",
                (email,)
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
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Invalid email or password'})
                }
            
            # Check password - support both SHA-256 (old) and bcrypt (new)
            stored_hash = user['password_hash']
            password_correct = False
            
            if isinstance(stored_hash, str) and len(stored_hash) == 64 and all(c in '0123456789abcdef' for c in stored_hash):
                # Old SHA-256 format
                password_sha256 = hashlib.sha256(password.encode('utf-8')).hexdigest()
                password_correct = (password_sha256 == stored_hash)
            else:
                # New bcrypt format
                if isinstance(stored_hash, str):
                    stored_hash_bytes = stored_hash.encode('utf-8')
                else:
                    stored_hash_bytes = stored_hash
                
                try:
                    password_correct = bcrypt.checkpw(password.encode('utf-8'), stored_hash_bytes)
                except ValueError:
                    password_correct = False
            
            if not password_correct:
                cursor.execute(
                    "INSERT INTO login_attempts (ip_address, email, success) VALUES (%s, %s, false)",
                    (ip_address, email)
                )
                conn.commit()
                
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Invalid email or password'})
                }
            
            if not user['email_verified']:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
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
            user_agent = event.get('headers', {}).get('user-agent', 'unknown')
            
            # Save session to DB for validation
            save_session_to_db(cursor, conn, str(user['id']), session_token, ip_address, user_agent)
            
            # Set session token in httpOnly cookie (secure)
            cookie_value = f"session_token={session_token}; Path=/; HttpOnly; Secure; SameSite=None; Domain=.poehali.dev; Max-Age=604800"
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true',
                    'X-Set-Cookie': cookie_value
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'session_token': session_token,
                    'user': {
                        'id': str(user['id']),
                        'email': user['email'],
                        'name': user['name'],
                        'created_at': user['created_at'].isoformat(),
                        'email_verified': user['email_verified'],
                        'balance': float(user['balance']) if user.get('balance') else 0.0,
                        'unlimited_access': bool(user.get('unlimited_access', False)),
                        'avatar_url': user.get('avatar_url') or ''
                    }
                })
            }
        
        elif action == 'logout':
            # Get session token from cookie or header
            headers = event.get('headers', {})
            cookie_header = headers.get('x-cookie') or headers.get('X-Cookie', '')
            session_token = headers.get('x-session-token') or headers.get('X-Session-Token')
            
            # Try to extract from cookie if not in header
            if not session_token and cookie_header:
                for cookie in cookie_header.split(';'):
                    cookie = cookie.strip()
                    if cookie.startswith('session_token='):
                        session_token = cookie.split('=', 1)[1]
                        break
            
            # Delete session from database if token exists
            if session_token:
                try:
                    cursor.execute(
                        "DELETE FROM sessions WHERE token = %s",
                        (session_token,)
                    )
                    conn.commit()
                except Exception as e:
                    print(f'Error deleting session: {e}')
            
            # Clear session cookie
            cookie_value = "session_token=; Path=/; HttpOnly; Secure; SameSite=None; Domain=.poehali.dev; Max-Age=0"
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true',
                    'X-Set-Cookie': cookie_value
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'Logged out successfully'})
            }
        
        elif action == 'validate':
            headers = event.get('headers', {})
            cookie_header = headers.get('x-cookie') or headers.get('X-Cookie', '')
            session_token = headers.get('x-session-token') or headers.get('X-Session-Token')
            
            if not session_token and cookie_header:
                for cookie in cookie_header.split(';'):
                    cookie = cookie.strip()
                    if cookie.startswith('session_token='):
                        session_token = cookie.split('=', 1)[1]
                        break
            
            if not session_token:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'No session token found'})
                }
            
            # Validate token
            is_valid, result = validate_session_token(cursor, session_token)
            
            if not is_valid:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': result})
                }
            
            user_id = result
            
            # Get user data
            cursor.execute(
                "SELECT id, email, name, created_at, email_verified, balance, unlimited_access, avatar_url FROM users WHERE id = %s",
                (user_id,)
            )
            
            user = cursor.fetchone()
            
            if not user:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'User not found'})
                }
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'session_token': session_token,
                    'user': {
                        'id': str(user['id']),
                        'email': '' if (isinstance(user['email'], str) and user['email'].endswith('@vk.local')) else user['email'],
                        'name': user['name'],
                        'created_at': user['created_at'].isoformat(),
                        'email_verified': user['email_verified'],
                        'balance': float(user['balance']) if user.get('balance') else 0.0,
                        'unlimited_access': bool(user.get('unlimited_access', False)),
                        'avatar_url': user.get('avatar_url') or ''
                    }
                })
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
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
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()