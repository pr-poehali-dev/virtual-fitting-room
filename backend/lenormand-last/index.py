"""Расклады пользователя: последний, список для личного кабинета и удаление."""

import json
import os
import base64
import html as html_lib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import psycopg2

from session_utils import validate_session

DB_SCHEMA = 't_p29007832_virtual_fitting_room'
PAGE_SIZE_MAX = 50


def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _decode(ai_response):
    if not ai_response:
        return ''
    try:
        return base64.b64decode(ai_response).decode('utf-8')
    except Exception:
        return ai_response


def _send_email(to_email, subject, body_text):
    """Отправляет письмо через тот же почтовый ящик, что и остальные письма сервиса."""
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')

    if not (smtp_host and smtp_user and smtp_password):
        raise Exception('Почта не настроена')

    message = MIMEMultipart('alternative')
    message['Subject'] = subject
    message['From'] = 'virtualfitting@mail.ru'
    message['To'] = to_email

    paragraphs = ''.join(
        f'<p style="margin:0 0 14px;line-height:1.7">{html_lib.escape(par.strip())}</p>'
        for par in body_text.split('\n\n') if par.strip()
    )
    html_content = (
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
        '<body style="font-family:Arial,sans-serif;color:#2f2618;background:#f7f0e1;padding:24px">'
        f'<div style="max-width:640px;margin:0 auto;background:#fffdf7;padding:28px;border-radius:14px">'
        f'<h1 style="font-size:20px;margin:0 0 18px">{html_lib.escape(subject)}</h1>'
        f'{paragraphs}'
        '<p style="margin-top:22px;font-size:12px;color:#8a7f6b">'
        'Толкование создано нейросетью и носит информационно-рекомендательный характер. '
        'Расклад — повод для размышления, а не предсказание.</p>'
        '<p style="font-size:12px;color:#8a7f6b">fitting-room.ru</p>'
        '</div></body></html>'
    )

    message.attach(MIMEText(body_text, 'plain', 'utf-8'))
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


def _email_reading(cur, safe_uid, task_id):
    """Отправляет расклад на почту владельца аккаунта."""
    cur.execute(
        f"SELECT email FROM {DB_SCHEMA}.users WHERE id = '{safe_uid}'"
    )
    row = cur.fetchone()
    if not row or not row[0]:
        return {'sent': False, 'error': 'У аккаунта нет почты'}
    to_email = row[0]

    safe_id = str(task_id).replace("'", "''")
    cur.execute(
        f"""SELECT ai_response, created_at
            FROM {DB_SCHEMA}.ai_editor_tasks
            WHERE id = '{safe_id}'
              AND user_id = '{safe_uid}'
              AND task_type = 'lenormand'"""
    )
    task = cur.fetchone()
    if not task:
        return {'sent': False, 'error': 'Расклад не найден'}

    text = _decode(task[0])
    if not text:
        return {'sent': False, 'error': 'Пустое толкование'}

    _send_email(to_email, 'Ваш расклад на картах', text)
    return {'sent': True, 'email': to_email}


def _last_reading(cur, safe_uid):
    """Последний завершённый расклад — для страницы гаданий."""
    cur.execute(
        f"""SELECT ai_response, divination_meta, created_at, id
            FROM {DB_SCHEMA}.ai_editor_tasks
            WHERE user_id = '{safe_uid}'
              AND task_type = 'lenormand'
              AND status = 'completed'
            ORDER BY created_at DESC LIMIT 1"""
    )
    row = cur.fetchone()
    if not row:
        return {'empty': True}

    ai_response, divination_meta, created_at, task_id = row
    return {
        'empty': False,
        'id': str(task_id),
        'ai_response': _decode(ai_response),
        'divination_meta': divination_meta or {},
        'created_at': created_at.isoformat() if created_at else '',
    }


def _history(cur, safe_uid, limit, offset):
    """Список раскладов для личного кабинета (с текстом толкования)."""
    cur.execute(
        f"""SELECT id, ai_response, divination_meta, cost, created_at
            FROM {DB_SCHEMA}.ai_editor_tasks
            WHERE user_id = '{safe_uid}'
              AND task_type = 'lenormand'
              AND status = 'completed'
            ORDER BY created_at DESC
            LIMIT {limit} OFFSET {offset}"""
    )
    rows = cur.fetchall()

    cur.execute(
        f"""SELECT COUNT(*) FROM {DB_SCHEMA}.ai_editor_tasks
            WHERE user_id = '{safe_uid}'
              AND task_type = 'lenormand'
              AND status = 'completed'"""
    )
    total = cur.fetchone()[0]

    items = []
    for r in rows:
        items.append({
            'id': str(r[0]),
            'ai_response': _decode(r[1]),
            'divination_meta': r[2] or {},
            'cost': r[3] or 0,
            'created_at': r[4].isoformat() if r[4] else '',
        })

    return {'items': items, 'total': total}


def _delete(cur, safe_uid, task_id):
    """Удаляем только свой расклад: проверка владельца обязательна."""
    safe_id = str(task_id).replace("'", "''")
    cur.execute(
        f"""DELETE FROM {DB_SCHEMA}.ai_editor_tasks
            WHERE id = '{safe_id}'
              AND user_id = '{safe_uid}'
              AND task_type = 'lenormand'"""
    )
    return {'deleted': cur.rowcount > 0}


def handler(event, context):
    """Расклады текущего пользователя: последний, история и удаление своего."""

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        'Content-Type': 'application/json',
    }

    method = event.get('httpMethod')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    if method not in ('GET', 'POST'):
        return {'statusCode': 405, 'headers': cors_headers,
                'body': json.dumps({'error': 'GET or POST only'})}

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid:
        return {'statusCode': 401, 'headers': cors_headers,
                'body': json.dumps({'error': error_msg or 'Unauthorized'})}

    safe_uid = str(user_id).replace("'", "''")

    params = event.get('queryStringParameters') or {}
    body = {}
    if method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            body = {}

    action = body.get('action') or params.get('action') or 'last'

    try:
        limit = min(int(params.get('limit') or 20), PAGE_SIZE_MAX)
        offset = max(int(params.get('offset') or 0), 0)
    except (TypeError, ValueError):
        limit, offset = 20, 0

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if action == 'history':
                result = _history(cur, safe_uid, limit, offset)
            elif action == 'email':
                task_id = body.get('id')
                if not task_id:
                    return {'statusCode': 400, 'headers': cors_headers,
                            'body': json.dumps({'error': 'id required'})}
                result = _email_reading(cur, safe_uid, task_id)
            elif action == 'delete':
                task_id = body.get('id')
                if not task_id:
                    return {'statusCode': 400, 'headers': cors_headers,
                            'body': json.dumps({'error': 'id required'})}
                result = _delete(cur, safe_uid, task_id)
                conn.commit()
            else:
                result = _last_reading(cur, safe_uid)
    finally:
        conn.close()

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps(result, ensure_ascii=False),
    }
