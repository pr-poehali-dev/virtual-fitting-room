import json
import os
import secrets
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, Any
from datetime import datetime, timedelta
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


def get_cors_origin(event: Dict[str, Any]) -> str:
    origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
    allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
    return origin if origin in allowed_origins else 'https://fitting-room.ru'


def fetch_vk_user_info(access_token: str) -> Dict[str, Any]:
    '''
    Проверяет access_token через официальный VK ID API и возвращает данные пользователя.
    Это защита: данные берём с сервера VK, а не доверяем фронтенду.
    '''
    app_id = os.environ.get('VK_APP_ID', '')
    url = 'https://id.vk.com/oauth2/user_info'
    data = urllib.parse.urlencode({
        'access_token': access_token,
        'client_id': app_id,
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {'error': f'http_{e.code}', 'details': e.read().decode('utf-8', 'ignore')}
    except Exception as e:
        return {'error': 'request_failed', 'details': str(e)}


def json_response(status: int, body: Dict[str, Any], event: Dict[str, Any], cookie: str = None) -> Dict[str, Any]:
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': get_cors_origin(event),
        'Access-Control-Allow-Credentials': 'true'
    }
    if cookie:
        headers['X-Set-Cookie'] = cookie
    return {
        'statusCode': status,
        'headers': headers,
        'isBase64Encoded': False,
        'body': json.dumps(body)
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Вход и регистрация через VK ID. Принимает access_token от VK ID SDK,
              проверяет его на сервере VK, находит или создаёт пользователя и выдаёт сессию.
    Args: event - dict с httpMethod, body (action='vk_login', access_token, опционально email/phone)
          context - объект с request_id
    Returns: HTTP-ответ с session_token и данными пользователя
    '''
    method = event.get('httpMethod', 'POST')

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
        return json_response(405, {'error': 'Method not allowed'}, event)

    body_str = event.get('body', '{}')
    if not body_str or body_str.strip() == '':
        return json_response(400, {'error': 'Empty body'}, event)

    body_data = json.loads(body_str)
    access_token = body_data.get('access_token')

    if not access_token:
        return json_response(400, {'error': 'Missing access_token'}, event)

    vk_info = fetch_vk_user_info(access_token)

    user_data = vk_info.get('user') if isinstance(vk_info.get('user'), dict) else vk_info
    vk_user_id = user_data.get('user_id') or user_data.get('id')

    if vk_info.get('error') or not vk_user_id:
        return json_response(401, {'error': 'VK token validation failed', 'details': vk_info.get('error')}, event)

    vk_id = str(vk_user_id)
    first_name = user_data.get('first_name', '')
    last_name = user_data.get('last_name', '')
    full_name = (first_name + ' ' + last_name).strip() or 'Пользователь VK'
    vk_email = user_data.get('email') or body_data.get('email')
    vk_phone = user_data.get('phone') or body_data.get('phone')
    avatar_url = user_data.get('avatar') or user_data.get('photo_200') or ''

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    headers = event.get('headers', {})
    x_forwarded_for = headers.get('x-forwarded-for') or headers.get('X-Forwarded-For', '')
    x_real_ip = headers.get('x-real-ip') or headers.get('X-Real-IP', '')
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(',')[0].strip()
    elif x_real_ip:
        ip_address = x_real_ip
    else:
        ip_address = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
    user_agent = headers.get('user-agent', 'unknown')

    try:
        cursor.execute(
            "SELECT id, email, name, created_at, email_verified, balance, unlimited_access, avatar_url FROM users WHERE vk_id = %s",
            (vk_id,)
        )
        user = cursor.fetchone()

        if not user and vk_email:
            # Пользователь уже регистрировался по этому email — привязываем ВК к его аккаунту,
            # чтобы не создавать дубль
            cursor.execute(
                "SELECT id, email, name, created_at, email_verified, balance, unlimited_access, avatar_url FROM users WHERE email = %s",
                (vk_email,)
            )
            existing = cursor.fetchone()
            if existing:
                cursor.execute(
                    """
                    UPDATE users
                    SET vk_id = %s,
                        oauth_provider = COALESCE(oauth_provider, 'vk'),
                        phone = COALESCE(%s, phone),
                        avatar_url = COALESCE(NULLIF(%s, ''), avatar_url),
                        email_verified = true,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id, email, name, created_at, email_verified, balance, unlimited_access, avatar_url
                    """,
                    (vk_id, vk_phone, avatar_url, existing['id'])
                )
                user = cursor.fetchone()
                conn.commit()

        if not user:
            # Реальный email от ВК сохраняем как есть, иначе ставим техническую заглушку
            new_email = vk_email if vk_email else f'vk{vk_id}@vk.local'
            cursor.execute("SELECT id FROM users WHERE email = %s", (new_email,))
            email_conflict = cursor.fetchone()
            if email_conflict:
                new_email = f'vk{vk_id}@vk.local'

            random_hash = bcrypt.hashpw(secrets.token_urlsafe(24).encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            cursor.execute(
                """
                INSERT INTO users (email, password_hash, name, email_verified, vk_id, oauth_provider, phone, avatar_url)
                VALUES (%s, %s, %s, true, %s, 'vk', %s, %s)
                RETURNING id, email, name, created_at, email_verified, balance, unlimited_access, avatar_url
                """,
                (new_email, random_hash, full_name, vk_id, vk_phone, avatar_url)
            )
            user = cursor.fetchone()
            conn.commit()

        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=7)
        cursor.execute(
            """
            INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (str(user['id']), session_token, expires_at, ip_address, user_agent)
        )
        conn.commit()

        cookie_value = f"session_token={session_token}; Path=/; HttpOnly; Secure; SameSite=None; Domain=.poehali.dev; Max-Age=604800"

        display_email = user['email']
        if isinstance(display_email, str) and display_email.endswith('@vk.local'):
            display_email = ''

        return json_response(200, {
            'session_token': session_token,
            'user': {
                'id': str(user['id']),
                'email': display_email,
                'name': user['name'],
                'created_at': user['created_at'].isoformat() if user.get('created_at') else None,
                'email_verified': bool(user.get('email_verified', True)),
                'balance': float(user['balance']) if user.get('balance') else 0.0,
                'unlimited_access': bool(user.get('unlimited_access', False)),
                'avatar_url': user.get('avatar_url') or ''
            }
        }, event, cookie=cookie_value)
    finally:
        cursor.close()
        conn.close()