"""Принимает запрос на AI-редактирование, сохраняет задачу в БД и запускает worker."""

import json
import os
import psycopg2
import uuid
import base64
from datetime import datetime

from session_utils import validate_session
from lenormand import build_lenormand_prompt

DB_SCHEMA = 't_p29007832_virtual_fitting_room'

LENORMAND_COST = 50
LENORMAND_MODELS = {'anthropic/claude-sonnet-4.6', 'google/gemini-2.5-flash'}


def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def sql_escape(val):
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"


def sql_escape_b64(val):
    if val is None:
        return 'NULL'
    encoded = base64.b64encode(val.encode('utf-8')).decode('ascii')
    return "'" + encoded + "'"


def trigger_worker(task_id):
    try:
        import urllib.request
        worker_url = 'https://functions.poehali.dev/d3e4e0ce-9999-45d3-82b4-15d3eeb45425'
        req = urllib.request.Request(f'{worker_url}?task_id={task_id}', method='GET')
        urllib.request.urlopen(req, timeout=2)
    except Exception as e:
        print(f'Worker trigger (non-critical): {e}')


def handle_lenormand(event, body, cors_headers):
    """Создаёт задачу гадания Ленорман: проверяет авторизацию, списывает баланс,
    собирает промпт и сохраняет задачу в ai_editor_tasks."""

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid:
        return {'statusCode': 401, 'headers': cors_headers,
                'body': json.dumps({'error': error_msg or 'Unauthorized'})}

    model = body.get('model', 'anthropic/claude-sonnet-4.6')
    if model not in LENORMAND_MODELS:
        model = 'anthropic/claude-sonnet-4.6'

    meta = body.get('divination_meta') or {}
    meta['system'] = 'lenormand'
    layout = meta.get('layout') or []
    filled = [c for c in layout if isinstance(c, str) and c.strip()]
    if not filled:
        return {'statusCode': 400, 'headers': cors_headers,
                'body': json.dumps({'error': 'Не выбраны карты для расклада'})}

    prompt = build_lenormand_prompt(meta)
    task_id = str(uuid.uuid4())
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT balance, unlimited_access FROM users WHERE id = %s', (user_id,))
            user_row = cur.fetchone()
            if not user_row:
                return {'statusCode': 404, 'headers': cors_headers,
                        'body': json.dumps({'error': 'User not found'})}

            balance = float(user_row[0])
            unlimited_access = user_row[1]
            cost = 0 if unlimited_access else LENORMAND_COST

            if not unlimited_access and balance < cost:
                return {'statusCode': 402, 'headers': cors_headers,
                        'body': json.dumps({'error': 'Insufficient balance',
                                            'required': cost, 'current': balance})}

            if cost > 0:
                cur.execute('UPDATE users SET balance = balance - %s WHERE id = %s', (cost, user_id))

            meta_json = json.dumps(meta, ensure_ascii=False)
            cur.execute(
                f"""INSERT INTO {DB_SCHEMA}.ai_editor_tasks
                    (id, status, mode, model, prompt, task_type, user_id, cost,
                     refunded, divination_meta, created_at, updated_at)
                    VALUES (%s, 'pending', 'chat', %s, %s, 'lenormand', %s, %s,
                            false, %s::jsonb, %s, %s)""",
                (task_id, model, prompt, user_id, cost, meta_json, now, now)
            )

            if cost > 0:
                balance_after = balance - cost
                cur.execute(
                    """INSERT INTO balance_transactions
                       (user_id, type, amount, balance_before, balance_after, description)
                       VALUES (%s, 'charge', %s, %s, %s, %s)""",
                    (user_id, -cost, balance, balance_after, 'Расклад Ленорман')
                )
            elif unlimited_access:
                cur.execute(
                    """INSERT INTO balance_transactions
                       (user_id, type, amount, balance_before, balance_after, description)
                       VALUES (%s, 'charge', 0, %s, %s, %s)""",
                    (user_id, balance, balance, 'Расклад Ленорман (безлимитный доступ)')
                )
        conn.commit()
    finally:
        conn.close()

    trigger_worker(task_id)

    return {'statusCode': 200, 'headers': cors_headers,
            'body': json.dumps({'task_id': task_id, 'status': 'pending'})}


def handler(event, context):
    """Создаёт задачу AI-редактирования и возвращает task_id мгновенно."""

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        'Content-Type': 'application/json',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': cors_headers, 'body': json.dumps({'error': 'POST only'})}

    body = json.loads(event.get('body', '{}') or '{}')
    task_type = body.get('task_type', 'editor')

    if task_type == 'lenormand':
        return handle_lenormand(event, body, cors_headers)

    mode = body.get('mode', 'chat')
    model = body.get('model', 'anthropic/claude-sonnet-4.6')
    prompt = body.get('prompt', '').strip()

    allowed_models = {
        'anthropic/claude-sonnet-4',
        'anthropic/claude-sonnet-4.5',
        'anthropic/claude-sonnet-4.6',
        'anthropic/claude-opus-4',
        'anthropic/claude-opus-4.6',
    }
    if model not in allowed_models:
        model = 'anthropic/claude-sonnet-4.6'

    if not prompt:
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'Нужен промпт'})}

    if mode not in ('chat', 'file', 'archive'):
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'Неверный mode'})}

    if mode == 'file' and not body.get('file_content'):
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'Файл пустой'})}

    if mode == 'archive' and not body.get('archive_base64'):
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'Нужен архив'})}

    task_id = str(uuid.uuid4())
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    file_content_val = body.get('file_content', '') if mode == 'file' else None
    archive_val = body.get('archive_base64', '') if mode == 'archive' else None

    prompt_b64 = sql_escape_b64(prompt)
    file_content_b64 = sql_escape_b64(file_content_val) if file_content_val else 'NULL'
    archive_b64 = sql_escape(archive_val) if archive_val else 'NULL'

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            sql = f"""INSERT INTO {DB_SCHEMA}.ai_editor_tasks
                    (id, status, mode, model, prompt, filename, file_content, archive_base64, created_at, updated_at)
                    VALUES (
                        {sql_escape(task_id)}, 'pending', {sql_escape(mode)}, {sql_escape(model)},
                        convert_from(decode({prompt_b64}, 'base64'), 'UTF8'),
                        {sql_escape(body.get('filename', ''))},
                        {('convert_from(decode(' + file_content_b64 + ", 'base64'), 'UTF8')") if file_content_val else 'NULL'},
                        {archive_b64},
                        {sql_escape(now)}, {sql_escape(now)}
                    )"""
            cur.execute(sql)
        conn.commit()
    finally:
        conn.close()

    try:
        import urllib.request
        worker_url = 'https://functions.poehali.dev/d3e4e0ce-9999-45d3-82b4-15d3eeb45425'
        req = urllib.request.Request(f'{worker_url}?task_id={task_id}', method='GET')
        urllib.request.urlopen(req, timeout=2)
    except Exception as e:
        print(f'Worker trigger (non-critical): {e}')

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps({
            'task_id': task_id,
            'status': 'pending',
        }),
    }