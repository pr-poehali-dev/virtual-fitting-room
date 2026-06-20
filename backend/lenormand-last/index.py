"""Возвращает последний завершённый расклад Ленорман текущего пользователя."""

import json
import os
import base64
import psycopg2

from session_utils import validate_session

DB_SCHEMA = 't_p29007832_virtual_fitting_room'


def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event, context):
    """Возвращает последний завершённый расклад Ленорман текущего пользователя (по сессии)."""

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        'Content-Type': 'application/json',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    if event.get('httpMethod') != 'GET':
        return {'statusCode': 405, 'headers': cors_headers,
                'body': json.dumps({'error': 'GET only'})}

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid:
        return {'statusCode': 401, 'headers': cors_headers,
                'body': json.dumps({'error': error_msg or 'Unauthorized'})}

    safe_uid = str(user_id).replace("'", "''")

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT ai_response, divination_meta, created_at
                    FROM {DB_SCHEMA}.ai_editor_tasks
                    WHERE user_id = '{safe_uid}'
                      AND task_type = 'lenormand'
                      AND status = 'completed'
                    ORDER BY created_at DESC LIMIT 1"""
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return {'statusCode': 200, 'headers': cors_headers,
                'body': json.dumps({'empty': True})}

    ai_response, divination_meta, created_at = row

    text = ''
    if ai_response:
        try:
            text = base64.b64decode(ai_response).decode('utf-8')
        except Exception:
            text = ai_response

    result = {
        'empty': False,
        'ai_response': text,
        'divination_meta': divination_meta or {},
        'created_at': created_at.isoformat() if created_at else '',
    }

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps(result, ensure_ascii=False),
    }
