"""Проверяет статус задачи AI-редактирования по task_id или возвращает последнюю."""

import json
import os
import base64
import psycopg2

DB_SCHEMA = 't_p29007832_virtual_fitting_room'


def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def build_result(task_id, row):
    status, mode, ai_response, result_file_content, result_archive_base64, files_count, model_used, error_message, filename, created_at = row

    result = {
        'task_id': str(task_id),
        'status': status,
        'mode': mode,
        'filename': filename or '',
        'created_at': created_at.isoformat() if created_at else '',
    }

    if status == 'completed':
        if ai_response:
            try:
                result['ai_response'] = base64.b64decode(ai_response).decode('utf-8')
            except Exception:
                result['ai_response'] = ai_response
        else:
            result['ai_response'] = ''
        result['model_used'] = model_used or ''
        if mode == 'file' and result_file_content:
            try:
                result['result_file_content'] = base64.b64decode(result_file_content).decode('utf-8')
            except Exception:
                result['result_file_content'] = result_file_content
        if mode == 'archive' and result_archive_base64:
            result['result_archive_base64'] = result_archive_base64
            result['files_count'] = files_count
    elif status == 'failed':
        result['error'] = error_message or 'Неизвестная ошибка'

    return result


def handler(event, context):
    """Возвращает статус задачи AI-редактирования по task_id или последнюю задачу (latest=true)."""

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        'Content-Type': 'application/json',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    params = event.get('queryStringParameters') or {}
    task_id = params.get('task_id', '')
    latest = params.get('latest', '')

    if not task_id and latest != 'true':
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'task_id required'})}

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if latest == 'true':
                cur.execute(
                    f"""SELECT id, status, mode, ai_response, result_file_content, result_archive_base64,
                               files_count, model_used, error_message, filename, created_at
                        FROM {DB_SCHEMA}.ai_editor_tasks
                        WHERE status IN ('completed', 'failed', 'processing')
                        ORDER BY created_at DESC LIMIT 1"""
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 404, 'headers': cors_headers, 'body': json.dumps({'error': 'Нет задач'})}
                found_id = row[0]
                data_row = row[1:]
            else:
                safe_id = str(task_id).replace("'", "''")
                cur.execute(
                    f"""SELECT status, mode, ai_response, result_file_content, result_archive_base64,
                               files_count, model_used, error_message, filename, created_at
                        FROM {DB_SCHEMA}.ai_editor_tasks WHERE id = '{safe_id}'"""
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 404, 'headers': cors_headers, 'body': json.dumps({'error': 'Задача не найдена'})}
                found_id = task_id
                data_row = row
    finally:
        conn.close()

    result = build_result(found_id, data_row)

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps(result),
    }