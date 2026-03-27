"""Принимает запрос на AI-редактирование, сохраняет задачу в БД и запускает worker."""

import json
import os
import psycopg2
import uuid
import base64
from datetime import datetime

DB_SCHEMA = 't_p29007832_virtual_fitting_room'


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