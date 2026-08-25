import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from session_utils import validate_session


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Возвращает полный отчёт Гида по цвету с проверкой владельца
    Args: event с X-Session-Token и queryStringParameters.task_id; context с request_id
    Returns: HTTP response с полным result_json, cdn_url, статусом
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
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }

    params = event.get('queryStringParameters') or {}
    task_id = params.get('task_id')

    body_data = {}
    if method == 'POST':
        try:
            body_data = json.loads(event.get('body') or '{}')
        except Exception:
            body_data = {}
        task_id = body_data.get('task_id') or task_id

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

    # POST — прикрепить готовую картинку к консультации (после отдельной генерации).
    if method == 'POST':
        image_url = str(body_data.get('cdn_url') or '').strip()
        allowed_prefixes = ('https://storage.yandexcloud.net/', 'https://cdn.poehali.dev/')
        if not image_url.startswith(allowed_prefixes):
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'cdn_url is invalid'})
            }
        try:
            conn = psycopg2.connect(dsn)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE color_guide_tasks SET cdn_url = %s WHERE id = %s AND user_id = %s AND service_type = 'consult'",
                (image_url, task_id, str(user_id))
            )
            updated = cursor.rowcount
            conn.commit()
            cursor.close()
            conn.close()
            return {
                'statusCode': 200 if updated else 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'saved': bool(updated)})
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': f'Database error: {str(e)}'})
            }

    try:
        conn = psycopg2.connect(dsn)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT id, user_id, status, colortype_slug, result_json, cdn_url, error_message,
                   cost, refunded, created_at, service_type, form_params, colortype_history_id
            FROM color_guide_tasks WHERE id = %s
        ''', (task_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }

        if str(row['user_id']) != str(user_id):
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Forbidden'})
            }

        result = row.get('result_json')
        if result and isinstance(result, str):
            try:
                result = json.loads(result)
            except Exception:
                result = None

        form_params = row.get('form_params')
        if form_params and isinstance(form_params, str):
            try:
                form_params = json.loads(form_params)
            except Exception:
                form_params = None

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': str(row['id']),
                'status': row['status'],
                'service_type': row.get('service_type') or 'colorguide',
                'colortype_slug': row['colortype_slug'],
                'cdn_url': row['cdn_url'],
                'cost': row['cost'],
                'refunded': row['refunded'],
                'error_message': row.get('error_message'),
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'result': result,
                'form_params': form_params,
                'colortype_history_id': str(row['colortype_history_id']) if row.get('colortype_history_id') else None
            }, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }