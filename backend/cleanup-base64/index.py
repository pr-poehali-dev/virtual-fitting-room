import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
# redeploy v2


def get_db_connection():
    """Подключение к БД"""
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)


def verify_admin_jwt(provided_token):
    if not provided_token:
        return (False, 'Token required')
    try:
        secret_key = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = jwt.decode(provided_token, secret_key, algorithms=['HS256'])
        if not payload.get('admin'):
            return (False, 'Invalid token')
        return (True, '')
    except jwt.ExpiredSignatureError:
        return (False, 'Token expired')
    except jwt.InvalidTokenError:
        return (False, 'Invalid token')


def get_cors_origin(event):
    origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
    allowed = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
    return origin if origin in allowed else 'https://fitting-room.ru'


def make_response(status, body, event):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': get_cors_origin(event)
        },
        'isBase64Encoded': False,
        'body': json.dumps(body) if isinstance(body, (dict, list)) else body
    }


def clean_garments_json(garments_text):
    """Парсит JSON garments, заменяет base64 в image на 'Удалено'"""
    try:
        items = json.loads(garments_text)
        changed = False
        for item in items:
            if isinstance(item, dict) and item.get('image', '').startswith('data:'):
                item['image'] = 'Удалено'
                changed = True
        if changed:
            return json.dumps(items, ensure_ascii=False), True
        return garments_text, False
    except:
        return garments_text, False


def handler(event, context):
    """Очистка base64 данных из завершённых задач в БД"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    if method != 'POST':
        return make_response(405, {'error': 'Method not allowed'}, event)

    headers = event.get('headers', {})
    auth_header = headers.get('x-authorization') or headers.get('X-Authorization') or headers.get('authorization') or headers.get('Authorization', '')
    admin_token = None
    if auth_header.startswith('Bearer '):
        admin_token = auth_header[7:]

    if not admin_token:
        return make_response(401, {'error': 'Unauthorized'}, event)

    is_valid, err = verify_admin_jwt(admin_token)
    if not is_valid:
        return make_response(401, {'error': err}, event)

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    report = []

    # 1. nanobananapro_tasks — person_image
    cursor.execute("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(person_image)), 0) as bytes
        FROM nanobananapro_tasks
        WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
    """)
    r = cursor.fetchone()
    if r['cnt'] > 0:
        cursor.execute("""
            UPDATE nanobananapro_tasks SET person_image = 'Удалено'
            WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
        """)
        conn.commit()
    report.append({'table': 'nanobananapro_tasks', 'column': 'person_image', 'cleaned': r['cnt'], 'saved_bytes': int(r['bytes'])})

    # 2. nanobananapro_tasks — garments (JSON)
    cursor.execute("""
        SELECT id, garments, LENGTH(garments) as len
        FROM nanobananapro_tasks
        WHERE status IN ('completed', 'failed') AND garments LIKE '%%data:image%%'
    """)
    rows = cursor.fetchall()
    garments_saved = 0
    garments_count = 0
    for row in rows:
        new_val, changed = clean_garments_json(row['garments'])
        if changed:
            saved = len(row['garments']) - len(new_val)
            cursor.execute("UPDATE nanobananapro_tasks SET garments = %s WHERE id = %s", (new_val, row['id']))
            garments_saved += saved
            garments_count += 1
    if garments_count > 0:
        conn.commit()
    report.append({'table': 'nanobananapro_tasks', 'column': 'garments', 'cleaned': garments_count, 'saved_bytes': garments_saved})

    # 3. nanobananapro_tasks — template_data
    cursor.execute("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(template_data)), 0) as bytes
        FROM nanobananapro_tasks
        WHERE status IN ('completed', 'failed') AND LENGTH(template_data) > 1000
    """)
    r = cursor.fetchone()
    if r['cnt'] > 0:
        cursor.execute("""
            UPDATE nanobananapro_tasks SET template_data = NULL
            WHERE status IN ('completed', 'failed') AND LENGTH(template_data) > 1000
        """)
        conn.commit()
    report.append({'table': 'nanobananapro_tasks', 'column': 'template_data', 'cleaned': r['cnt'], 'saved_bytes': int(r['bytes'])})

    # 4. try_on_history — person_image (архив, без фильтра по статусу)
    cursor.execute("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(person_image)), 0) as bytes
        FROM try_on_history WHERE person_image LIKE 'data:%%'
    """)
    r = cursor.fetchone()
    if r['cnt'] > 0:
        cursor.execute("UPDATE try_on_history SET person_image = 'Удалено' WHERE person_image LIKE 'data:%%'")
        conn.commit()
    report.append({'table': 'try_on_history', 'column': 'person_image', 'cleaned': r['cnt'], 'saved_bytes': int(r['bytes'])})

    # 5. try_on_history — garment_image
    cursor.execute("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(garment_image)), 0) as bytes
        FROM try_on_history WHERE garment_image LIKE 'data:%%'
    """)
    r = cursor.fetchone()
    if r['cnt'] > 0:
        cursor.execute("UPDATE try_on_history SET garment_image = 'Удалено' WHERE garment_image LIKE 'data:%%'")
        conn.commit()
    report.append({'table': 'try_on_history', 'column': 'garment_image', 'cleaned': r['cnt'], 'saved_bytes': int(r['bytes'])})

    # 6. try_on_history — garments (JSON)
    cursor.execute("""
        SELECT id, garments, LENGTH(garments) as len
        FROM try_on_history WHERE garments LIKE '%%data:image%%'
    """)
    rows = cursor.fetchall()
    g_saved = 0
    g_count = 0
    for row in rows:
        new_val, changed = clean_garments_json(row['garments'])
        if changed:
            saved = len(row['garments']) - len(new_val)
            cursor.execute("UPDATE try_on_history SET garments = %s WHERE id = %s", (new_val, row['id']))
            g_saved += saved
            g_count += 1
    if g_count > 0:
        conn.commit()
    report.append({'table': 'try_on_history', 'column': 'garments', 'cleaned': g_count, 'saved_bytes': g_saved})

    # 7. replicate_tasks — person_image
    cursor.execute("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(person_image)), 0) as bytes
        FROM replicate_tasks WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
    """)
    r = cursor.fetchone()
    if r['cnt'] > 0:
        cursor.execute("""
            UPDATE replicate_tasks SET person_image = 'Удалено'
            WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
        """)
        conn.commit()
    report.append({'table': 'replicate_tasks', 'column': 'person_image', 'cleaned': r['cnt'], 'saved_bytes': int(r['bytes'])})

    # 8. replicate_tasks — garments (JSON)
    cursor.execute("""
        SELECT id, garments, LENGTH(garments) as len
        FROM replicate_tasks WHERE status IN ('completed', 'failed') AND garments LIKE '%%data:image%%'
    """)
    rows = cursor.fetchall()
    rg_saved = 0
    rg_count = 0
    for row in rows:
        new_val, changed = clean_garments_json(row['garments'])
        if changed:
            saved = len(row['garments']) - len(new_val)
            cursor.execute("UPDATE replicate_tasks SET garments = %s WHERE id = %s", (new_val, row['id']))
            rg_saved += saved
            rg_count += 1
    if rg_count > 0:
        conn.commit()
    report.append({'table': 'replicate_tasks', 'column': 'garments', 'cleaned': rg_count, 'saved_bytes': rg_saved})

    # 9. seedream_tasks — person_image
    cursor.execute("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(person_image)), 0) as bytes
        FROM seedream_tasks WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
    """)
    r = cursor.fetchone()
    if r['cnt'] > 0:
        cursor.execute("""
            UPDATE seedream_tasks SET person_image = 'Удалено'
            WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
        """)
        conn.commit()
    report.append({'table': 'seedream_tasks', 'column': 'person_image', 'cleaned': r['cnt'], 'saved_bytes': int(r['bytes'])})

    # 10. seedream_tasks — garments (JSON)
    cursor.execute("""
        SELECT id, garments, LENGTH(garments) as len
        FROM seedream_tasks WHERE status IN ('completed', 'failed') AND garments LIKE '%%data:image%%'
    """)
    rows = cursor.fetchall()
    sg_saved = 0
    sg_count = 0
    for row in rows:
        new_val, changed = clean_garments_json(row['garments'])
        if changed:
            saved = len(row['garments']) - len(new_val)
            cursor.execute("UPDATE seedream_tasks SET garments = %s WHERE id = %s", (new_val, row['id']))
            sg_saved += saved
            sg_count += 1
    if sg_count > 0:
        conn.commit()
    report.append({'table': 'seedream_tasks', 'column': 'garments', 'cleaned': sg_count, 'saved_bytes': sg_saved})

    # 11. color_type_history — person_image
    cursor.execute("""
        SELECT COUNT(*) as cnt, COALESCE(SUM(LENGTH(person_image)), 0) as bytes
        FROM color_type_history WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
    """)
    r = cursor.fetchone()
    if r['cnt'] > 0:
        cursor.execute("""
            UPDATE color_type_history SET person_image = 'Удалено'
            WHERE status IN ('completed', 'failed') AND person_image LIKE 'data:%%'
        """)
        conn.commit()
    report.append({'table': 'color_type_history', 'column': 'person_image', 'cleaned': r['cnt'], 'saved_bytes': int(r['bytes'])})

    cursor.close()
    conn.close()

    total_cleaned = sum(r['cleaned'] for r in report)
    total_saved = sum(r['saved_bytes'] for r in report)

    return make_response(200, {
        'success': True,
        'tables': report,
        'total_cleaned': total_cleaned,
        'total_saved_mb': round(total_saved / 1024 / 1024, 2)
    }, event)