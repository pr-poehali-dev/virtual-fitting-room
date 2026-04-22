import json
import os
import re
import boto3
import psycopg2
from typing import Dict, Any, List, Tuple

S3_BUCKET = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
DEFAULT_DAYS = 3

# Регекс для ключа S3 из URL https://storage.yandexcloud.net/{bucket}/{key}
S3_URL_RE = re.compile(r'^https?://storage\.yandexcloud\.net/[^/]+/(.+)$')


def get_cors_origin(event: Dict[str, Any]) -> str:
    origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
    allowed_origins = [
        'https://fitting-room.ru',
        'https://preview--virtual-fitting-room.poehali.dev',
    ]
    return origin if origin in allowed_origins else 'https://fitting-room.ru'


def get_s3_client():
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    if not s3_access_key or not s3_secret_key:
        raise Exception('S3 credentials not configured')
    return boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
    )


def extract_s3_key(url: str) -> str:
    '''Извлекает ключ S3 из URL. Возвращает '' если не наш S3.'''
    if not isinstance(url, str):
        return ''
    m = S3_URL_RE.match(url.strip())
    if not m:
        return ''
    return m.group(1)


def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)


def cleanup_references(days: int) -> Tuple[int, int, int, List[str]]:
    '''
    Очищает референсы старше `days` дней.
    Возвращает (tasks_processed, files_deleted, errors_count, errors_sample)
    '''
    conn = get_db_connection()
    cursor = conn.cursor()

    # Ищем задачи старше N дней, у которых ещё не чистили референсы
    cursor.execute(
        '''
        SELECT id, "references"
        FROM freegen_tasks
        WHERE created_at < NOW() - INTERVAL '%s days'
          AND references_cleaned_at IS NULL
          AND "references" IS NOT NULL
          AND "references" != '[]'
        LIMIT 500
        ''' % int(days)
    )
    rows = cursor.fetchall()

    if not rows:
        cursor.close()
        conn.close()
        return (0, 0, 0, [])

    s3 = get_s3_client()
    tasks_processed = 0
    files_deleted = 0
    errors: List[str] = []

    for row in rows:
        task_id, refs_raw = row
        try:
            refs = json.loads(refs_raw) if isinstance(refs_raw, str) else refs_raw
        except Exception:
            refs = []

        if not isinstance(refs, list):
            refs = []

        for ref in refs:
            key = extract_s3_key(ref) if isinstance(ref, str) else ''
            if not key:
                # Пропускаем base64 и невалидные записи — их чистит cleanup-base64
                continue
            # Удаляем только референсы, НЕ результаты генерации
            if '/freegeneration/refs/' not in key and '/freegeneration/tmp/' not in key:
                continue
            try:
                s3.delete_object(Bucket=S3_BUCKET, Key=key)
                files_deleted += 1
            except Exception as e:
                errors.append(f'{key}: {str(e)[:100]}')

        # Помечаем задачу как очищенную
        try:
            cursor.execute(
                'UPDATE freegen_tasks SET references_cleaned_at = NOW() WHERE id = %s',
                (task_id,),
            )
            tasks_processed += 1
        except Exception as e:
            errors.append(f'task {task_id} update: {str(e)[:100]}')

    conn.commit()
    cursor.close()
    conn.close()

    return (tasks_processed, files_deleted, len(errors), errors[:10])


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Очистка старых S3-референсов свободной генерации. Вызывается по расписанию или вручную админом.
    Args: event - dict с httpMethod, queryStringParameters {days: int, admin_token: str}
          context - объект с request_id
    Returns: HTTP-ответ со статистикой очистки
    '''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    # Получаем параметр days (по умолчанию 3)
    params = event.get('queryStringParameters') or {}
    try:
        days = int(params.get('days') or DEFAULT_DAYS)
    except (ValueError, TypeError):
        days = DEFAULT_DAYS

    if days < 1:
        days = 1
    if days > 365:
        days = 365

    # Проверка авторизации: системный токен через JWT_SECRET_KEY (для крона).
    # Ручная очистка админом идёт через admin-api (action=cleanup_freegen_references).
    headers = event.get('headers', {})
    provided_token = (
        headers.get('x-system-token')
        or headers.get('X-System-Token')
        or params.get('system_token')
    )
    expected = os.environ.get('JWT_SECRET_KEY')

    if not expected or provided_token != expected:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Unauthorized'}),
        }

    try:
        tasks_processed, files_deleted, errors_count, errors_sample = cleanup_references(days)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'ok': True,
                'days': days,
                'tasks_processed': tasks_processed,
                'files_deleted': files_deleted,
                'errors_count': errors_count,
                'errors_sample': errors_sample,
            }),
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Cleanup failed: {str(e)}'}),
        }