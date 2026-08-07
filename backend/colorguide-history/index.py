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
    limit_raw = params.get('limit', '30')
    try:
        limit = max(1, min(int(limit_raw), 100))
    except (TypeError, ValueError):
        limit = 30

    offset_raw = params.get('offset', '0')
    try:
        offset = max(0, int(offset_raw))
    except (TypeError, ValueError):
        offset = 0

    # Фильтр по типам услуг: services=glasses,kibbe,outfit (пусто = показать все)
    allowed_services = {'colorguide', 'style', 'outfit', 'glasses', 'makeup', 'hairstyle', 'kibbe'}
    services_raw = params.get('services') or ''
    selected_services = [s.strip() for s in services_raw.split(',') if s.strip() in allowed_services]

    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'

    try:
        conn = psycopg2.connect(dsn)
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Пустой service_type у старых записей считаем гидом по цвету
        service_expr = "COALESCE(NULLIF(service_type, ''), 'colorguide')"

        # Счётчики по каждому типу услуги (для бейджей фильтра) — всегда по всей истории
        cursor.execute(
            f'SELECT {service_expr} AS svc, COUNT(*) AS cnt '
            'FROM color_guide_tasks WHERE user_id = %s GROUP BY 1',
            (user_id,)
        )
        counts = {row['svc']: row['cnt'] for row in cursor.fetchall()}

        # Условие фильтра по выбранным типам
        filter_sql = ''
        filter_params: list = []
        if selected_services:
            placeholders = ','.join(['%s'] * len(selected_services))
            filter_sql = f' AND {service_expr} IN ({placeholders})'
            filter_params = list(selected_services)

        # Общее число задач с учётом фильтра (для пагинации)
        cursor.execute(
            f'SELECT COUNT(*) AS total FROM color_guide_tasks WHERE user_id = %s{filter_sql}',
            (user_id, *filter_params)
        )
        total = cursor.fetchone()['total']

        # Лёгкий запрос: НЕ тащим тяжёлый result_json, берём только короткое имя через ->>
        cursor.execute(f'''
            SELECT id, status, colortype_slug, cdn_url, created_at, cost, refunded, error_message, service_type,
                   COALESCE(result_json->>'colortype_name', result_json->>'identity') AS display_name
            FROM color_guide_tasks
            WHERE user_id = %s{filter_sql}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        ''', (user_id, *filter_params, limit, offset))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        service_labels = {
            'colorguide': 'Гид по цвету',
            'style': 'Стилевой анализ',
            'outfit': 'Подбор образа',
            'glasses': 'Подбор очков',
            'makeup': 'Подбор макияжа',
            'hairstyle': 'Подбор причёски',
            'kibbe': 'Типаж по Кибби',
        }

        tasks = []
        for row in rows:
            service_type = row.get('service_type') or 'colorguide'
            display_name = row.get('display_name')
            if not display_name and service_type != 'colorguide':
                display_name = service_labels.get(service_type, 'Анализ')

            tasks.append({
                'id': str(row['id']),
                'status': row['status'],
                'service_type': service_type,
                'service_label': service_labels.get(service_type, 'Анализ'),
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
            'body': json.dumps({
                'tasks': tasks,
                'total': total,
                'limit': limit,
                'offset': offset,
                'counts': counts,
                'service_labels': service_labels,
            }, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }