"""Проверяет статус задачи AI-редактирования по task_id или возвращает последнюю."""

import json
import os
import base64
import psycopg2

from session_utils import validate_session

DB_SCHEMA = 't_p29007832_virtual_fitting_room'


def get_db_connection():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.set_client_encoding('UTF8')
    return conn


def build_progress(mode, status, plan_files, step_index):
    """Человекопонятный прогресс пошаговой архивной задачи."""
    if mode != 'archive' or status not in ('pending', 'processing'):
        return None

    if not plan_files:
        return {'stage': 'planning', 'text': 'Анализирую проект и составляю план'}

    if isinstance(plan_files, str):
        try:
            plan_files = json.loads(plan_files)
        except ValueError:
            return None

    targets = (plan_files or {}).get('targets') or []
    total = len(targets)
    idx = step_index or 0

    if total and idx < total:
        current = targets[idx].get('path') or ''
        return {
            'stage': 'files',
            'current': idx + 1,
            'total': total,
            'file': current,
            'text': f'Файл {idx + 1} из {total}: {current}',
        }

    return {'stage': 'packing', 'total': total, 'text': 'Собираю архив'}


def build_result(task_id, row):
    (status, mode, ai_response, result_file_content, result_archive_base64,
     files_count, model_used, error_message, filename, created_at,
     task_type, divination_meta, plan_files, step_index) = row

    result = {
        'task_id': str(task_id),
        'status': status,
        'mode': mode,
        'filename': filename or '',
        'created_at': created_at.isoformat() if created_at else '',
        'task_type': task_type or 'editor',
    }

    if divination_meta is not None:
        result['divination_meta'] = divination_meta

    progress = build_progress(mode, status, plan_files, step_index)
    if progress:
        result['progress'] = progress

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


def trigger_next_step(task_id):
    """Пинает воркер для следующего шага. Ошибки некритичны — следующий опрос повторит."""
    try:
        import urllib.request
        worker_url = 'https://functions.poehali.dev/d3e4e0ce-9999-45d3-82b4-15d3eeb45425'
        req = urllib.request.Request(f'{worker_url}?task_id={task_id}', method='GET')
        urllib.request.urlopen(req, timeout=2)
    except Exception as e:
        print(f'Step trigger (non-critical): {e}')


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
                # «Последняя задача» — строго своя и только AI-редактора.
                # Гостям (без сессии) ничего не показываем.
                is_valid, user_id, _ = validate_session(event)
                if not is_valid:
                    return {'statusCode': 200, 'headers': cors_headers,
                            'body': json.dumps({'empty': True})}
                safe_uid = str(user_id).replace("'", "''")
                cur.execute(
                    f"""SELECT id, status, mode, ai_response, result_file_content, result_archive_base64,
                               files_count, model_used, error_message, filename, created_at,
                               task_type, divination_meta, plan_files, step_index
                        FROM {DB_SCHEMA}.ai_editor_tasks
                        WHERE status IN ('completed', 'failed', 'processing')
                          AND user_id = '{safe_uid}'
                          AND task_type = 'editor'
                        ORDER BY created_at DESC LIMIT 1"""
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 200, 'headers': cors_headers,
                            'body': json.dumps({'empty': True})}
                found_id = row[0]
                data_row = row[1:]
            else:
                safe_id = str(task_id).replace("'", "''")
                cur.execute(
                    f"""SELECT status, mode, ai_response, result_file_content, result_archive_base64,
                               files_count, model_used, error_message, filename, created_at,
                               task_type, divination_meta, plan_files, step_index
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

    # Архивные задачи выполняются по шагам: каждый опрос статуса продвигает
    # следующий шаг. Вызов fire-and-forget, ответ не ждём.
    if data_row[0] in ('pending', 'processing') and data_row[1] == 'archive':
        trigger_next_step(found_id)

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps(result),
    }