import json
import os
import smtplib
import html as html_lib
from typing import Dict, Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    import psycopg2cffi as psycopg2
    from psycopg2cffi.extras import RealDictCursor

import jwt


def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)


def verify_admin_jwt(provided_token: str):
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


def build_html(subject: str, body_text: str) -> str:
    safe_subject = html_lib.escape(subject)
    paragraphs = ''
    for raw_para in body_text.split('\n\n'):
        para = raw_para.strip()
        if not para:
            continue
        safe = html_lib.escape(para).replace('\n', '<br>')
        paragraphs += f'<p style="margin: 0 0 14px 0;">{safe}</p>'

    return f"""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f7f7f7; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 28px 32px; border-radius: 8px;">
    <h2 style="color: #4F46E5; margin: 0 0 18px 0; font-size: 20px;">{safe_subject}</h2>
    {paragraphs}
    <p style="margin-top: 24px; color: #888; font-size: 13px; font-style: italic;">
      С уважением,<br>команда Fitting Room
    </p>
  </div>
</body>
</html>"""


def send_email_smtp(to_email: str, subject: str, body_text: str) -> None:
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')

    if not (smtp_host and smtp_user and smtp_password):
        raise Exception('SMTP credentials not configured')

    message = MIMEMultipart('alternative')
    message['Subject'] = subject
    message['From'] = 'virtualfitting@mail.ru'
    message['To'] = to_email

    full_text = body_text.rstrip() + '\n\n---\nС уважением,\nкоманда Fitting Room'
    html_content = build_html(subject, body_text)

    message.attach(MIMEText(full_text, 'plain', 'utf-8'))
    message.attach(MIMEText(html_content, 'html', 'utf-8'))

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
    Business: Отправка ручного письма пользователю из админки с записью в лог.
    Args: event - dict with httpMethod, body (user_id, subject, body_text)
          context - object with request_id
    Returns: HTTP response с результатом отправки
    '''
    def get_cors_origin(ev: Dict[str, Any]) -> str:
        origin = ev.get('headers', {}).get('origin') or ev.get('headers', {}).get('Origin', '')
        allowed = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed else 'https://fitting-room.ru'

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'}),
        }

    headers = event.get('headers', {})
    admin_token = None
    auth_header = headers.get('x-authorization') or headers.get('X-Authorization') or headers.get('authorization') or headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        admin_token = auth_header[7:]
    if not admin_token:
        cookie_header = headers.get('x-cookie') or headers.get('X-Cookie') or headers.get('cookie') or headers.get('Cookie', '')
        if cookie_header:
            for cookie in cookie_header.split('; '):
                if cookie.startswith('admin_token='):
                    admin_token = cookie.split('=', 1)[1]
                    break

    if not admin_token:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Unauthorized: Token required'}),
        }

    is_valid, err = verify_admin_jwt(admin_token)
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': err}),
        }

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Invalid JSON body'}),
        }

    user_id = body.get('user_id')
    subject = (body.get('subject') or '').strip()
    body_text = (body.get('body_text') or '').strip()

    if not user_id or not subject or not body_text:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'user_id, subject, body_text are required'}),
        }

    if len(subject) > 200:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Subject too long (max 200)'}),
        }
    if len(body_text) > 20000:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Body too long (max 20000)'}),
        }

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute('SELECT id, email, name FROM users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'User not found'}),
            }

        to_email = user_row['email']
        to_name = user_row.get('name') or ''

        try:
            send_email_smtp(to_email, subject, body_text)
            status = 'sent'
            error_message = None
        except Exception as e:
            status = 'failed'
            error_message = str(e)[:500]
            print(f'[AdminSendEmail] SMTP error: {error_message}')

        cursor.execute(
            '''INSERT INTO admin_emails_log
               (user_id, to_email, to_name, subject, body_text, status, error_message)
               VALUES (%s, %s, %s, %s, %s, %s, %s)''',
            (str(user_id), to_email, to_name, subject, body_text, status, error_message),
        )
        conn.commit()

        if status == 'sent':
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'success': True, 'to_email': to_email}),
            }
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'success': False, 'error': error_message or 'Send failed'}),
        }
    finally:
        cursor.close()
        conn.close()
