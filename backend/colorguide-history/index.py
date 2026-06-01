import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from session_utils import validate_session


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Возвращает список задач Гида по цвету для текущего пользователя
    Args: event с X-Session-Token и опциональным queryStringParameters.limit; context с request_id
    Returns: HTTP response с массивом задач (id, status, colortype_slug, colortype_name, cdn_url, created_at)
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

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }

    params = event.get('queryStringParameters') or {}
    limit_raw = params.get('limit', '50')
    try:
        limit = max(1, min(int(limit_raw), 200))
    except (TypeError, ValueError):
        limit = 50

    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'

    try:
        conn = psycopg2.connect(dsn)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT id, status, colortype_slug, result_json, cdn_url, created_at, cost, refunded, error_message, service_type
            FROM color_guide_tasks
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        ''', (user_id, limit))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        service_labels = {'colorguide': 'Гид по цвету', 'style': 'Стилевой анализ'}

        tasks = []
        for row in rows:
            service_type = row.get('service_type') or 'colorguide'
            display_name = None
            result_json = row.get('result_json')
            if result_json:
                if isinstance(result_json, str):
                    try:
                        result_json = json.loads(result_json)
                    except Exception:
                        result_json = None
                if isinstance(result_json, dict):
                    # colorguide -> colortype_name, прочие сервисы -> identity
                    display_name = result_json.get('colortype_name') or result_json.get('identity')
            if not display_name and service_type != 'colorguide':
                display_name = service_labels.get(service_type, 'Анализ')

            tasks.append({
                'id': str(row['id']),
                'status': row['status'],
                'service_type': service_type,
                'colortype_slug': row['colortype_slug'],
                'colortype_name': display_name,
                'cdn_url': row['cdn_url'],
                'cost': row['cost'],
                'refunded': row['refunded'],
                'error_message': row.get('error_message'),
                'created_at': row['created_at'].isoformat() if row['created_at'] else None
            })

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'tasks': tasks}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }