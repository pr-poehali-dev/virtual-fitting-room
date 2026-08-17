"""Расклады пользователя: последний, список для личного кабинета и удаление."""

import json
import os
import base64
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


def _last_reading(cur, safe_uid):
    """Последний завершённый расклад — для страницы гаданий."""
    cur.execute(
        f"""SELECT ai_response, divination_meta, created_at
            FROM {DB_SCHEMA}.ai_editor_tasks
            WHERE user_id = '{safe_uid}'
              AND task_type = 'lenormand'
              AND status = 'completed'
            ORDER BY created_at DESC LIMIT 1"""
    )
    row = cur.fetchone()
    if not row:
        return {'empty': True}

    ai_response, divination_meta, created_at = row
    return {
        'empty': False,
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
