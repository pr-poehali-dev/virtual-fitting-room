"""Проверяет статус задачи AI-редактирования по task_id."""

import json
import os
import psycopg2

DB_SCHEMA = 't_p29007832_virtual_fitting_room'


def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event, context):
    """Возвращает текущий статус и результат задачи AI-редактирования."""

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    params = event.get('queryStringParameters') or {}
    task_id = params.get('task_id', '')

    if not task_id:
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'task_id required'})}

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT status, mode, ai_response, result_file_content, result_archive_base64,
                           files_count, model_used, error_message
                    FROM {DB_SCHEMA}.ai_editor_tasks WHERE id = %s""",
                (task_id,)
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return {'statusCode': 404, 'headers': cors_headers, 'body': json.dumps({'error': 'Задача не найдена'})}

    status, mode, ai_response, result_file_content, result_archive_base64, files_count, model_used, error_message = row

    result = {
        'task_id': task_id,
        'status': status,
        'mode': mode,
    }

    if status == 'completed':
        result['ai_response'] = ai_response or ''
        result['model_used'] = model_used or ''
        if mode == 'file' and result_file_content:
            result['result_file_content'] = result_file_content
        if mode == 'archive' and result_archive_base64:
            result['result_archive_base64'] = result_archive_base64
            result['files_count'] = files_count
    elif status == 'failed':
        result['error'] = error_message or 'Неизвестная ошибка'

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps(result),
    }
