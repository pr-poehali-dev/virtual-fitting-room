import json
import os
import psycopg2
from typing import Dict, Any

STALE_TASK_SECONDS = 720
STALE_ERROR_MESSAGE = (
    'Генерация прервалась из-за сбоя связи и не была завершена. '
    'Деньги возвращены на баланс, если они списывались. Попробуйте ещё раз.'
)


def _fail_stale_task(conn, cursor, task_id: str, row):
    """Помечает зависшую задачу как failed и возвращает списанные деньги.
    Задача считается зависшей, если провисела в работе дольше STALE_TASK_SECONDS."""
    user_id, cost, refunded = row[8], row[9], row[10]
    try:
        if cost and cost > 0 and not refunded:
            cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
            u = cursor.fetchone()
            if u:
                balance_before = float(u[0])
                balance_after = balance_before + cost
                cursor.execute('UPDATE users SET balance = balance + %s WHERE id = %s', (cost, user_id))
                cursor.execute('''
                    INSERT INTO balance_transactions
                    (user_id, type, amount, balance_before, balance_after, description)
                    VALUES (%s, 'refund', %s, %s, %s, %s)
                ''', (user_id, cost, balance_before, balance_after, 'Возврат: генерация прервалась'))
                cursor.execute('UPDATE color_guide_tasks SET refunded = TRUE WHERE id = %s', (task_id,))
        cursor.execute(
            "UPDATE color_guide_tasks SET status = 'failed', error_message = %s, updated_at = NOW() WHERE id = %s",
            (STALE_ERROR_MESSAGE, task_id)
        )
        conn.commit()
        print(f'[COLORGUIDE-STATUS] Stale task {task_id} marked as failed')
        return ('failed',) + tuple(row[1:4]) + (STALE_ERROR_MESSAGE,) + tuple(row[5:])
    except Exception as e:
        conn.rollback()
        print(f'[COLORGUIDE-STATUS] Failed to mark stale task {task_id}: {e}')
        return row


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение статуса и результата задачи Гида по цвету
    Args: event с queryStringParameters.task_id; context с request_id
    Returns: HTTP response со статусом и result_json
    '''
    def get_cors_origin(event):
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed = ['https://fitting-room.ru']
        if origin in allowed or origin.endswith('.poehali.dev'):
            return origin
        return 'https://fitting-room.ru'

    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    params = event.get('queryStringParameters') or {}
    task_id = params.get('task_id')
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id required'})
        }

    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'

    try:
        conn = psycopg2.connect(dsn)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT status, colortype_slug, result_json, cdn_url, error_message, service_type, form_params,
                   EXTRACT(EPOCH FROM (NOW() - created_at)), user_id, cost, refunded
            FROM color_guide_tasks WHERE id = %s
        ''', (task_id,))
        row = cursor.fetchone()

        if row and row[0] in ('pending', 'processing') and (row[7] or 0) > STALE_TASK_SECONDS:
            row = _fail_stale_task(conn, cursor, task_id, row)

        cursor.close()
        conn.close()

        if not row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }

        status, colortype_slug, result_json, cdn_url, error_message, service_type, form_params = row[:7]

        # Единая очередь: если задача всё ещё ждёт — будим воркер (он сам решит, стартовать или ждать слот)
        if status == 'pending':
            try:
                import urllib.request
                worker_url = f'https://functions.poehali.dev/12f108e3-fe83-4618-9e8b-48411bb69390?task_id={task_id}'
                req = urllib.request.Request(worker_url, method='GET')
                urllib.request.urlopen(req, timeout=1)
            except Exception:
                pass

        response_body = {
            'task_id': task_id,
            'status': status,
            'colortype_slug': colortype_slug,
            'cdn_url': cdn_url,
            'service_type': service_type
        }
        if result_json:
            if isinstance(result_json, str):
                response_body['result'] = json.loads(result_json)
            else:
                response_body['result'] = result_json
        if form_params:
            response_body['form_params'] = json.loads(form_params) if isinstance(form_params, str) else form_params
        if error_message:
            response_body['error'] = error_message

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps(response_body, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }