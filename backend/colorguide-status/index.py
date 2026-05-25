import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение статуса и результата задачи Гида по цвету
    Args: event с queryStringParameters.task_id; context с request_id
    Returns: HTTP response со статусом и result_json
    '''
    def get_cors_origin(event):
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed else 'https://fitting-room.ru'

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
            SELECT status, colortype_slug, result_json, cdn_url, error_message
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

        status, colortype_slug, result_json, cdn_url, error_message = row

        response_body = {
            'task_id': task_id,
            'status': status,
            'colortype_slug': colortype_slug,
            'cdn_url': cdn_url
        }
        if result_json:
            if isinstance(result_json, str):
                response_body['result'] = json.loads(result_json)
            else:
                response_body['result'] = result_json
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
