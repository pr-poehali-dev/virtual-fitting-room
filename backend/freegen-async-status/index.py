import json
import os
import psycopg2
import requests
from typing import Dict, Any
from datetime import datetime


def check_fal_status(response_url: str) -> dict:
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json',
    }
    response = requests.get(response_url, headers=headers, timeout=10)
    if response.status_code == 200:
        return response.json()
    raise Exception(f'Failed to check status: {response.status_code}')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Проверка статуса задачи свободной генерации NanoBanana 2, с опцией force_check на fal.ai
    Args: event - dict с queryStringParameters (task_id, force_check)
          context - объект с request_id
    Returns: HTTP-ответ со статусом и result_url при завершении
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'

    method: str = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'}),
        }

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'}),
        }

    params = event.get('queryStringParameters', {}) or {}
    task_id = params.get('task_id')
    force_check = params.get('force_check') == 'true'

    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id is required'}),
        }

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT status, result_url, error_message, fal_response_url
            FROM freegen_tasks
            WHERE id = %s
        ''', (task_id,))
        row = cursor.fetchone()

        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'}),
            }

        status, result_url, error_message, fal_response_url = row

        if force_check and status == 'processing' and fal_response_url:
            try:
                fal_data = check_fal_status(fal_response_url)
                fal_status = fal_data.get('status', fal_data.get('state', 'UNKNOWN'))

                if fal_status == 'COMPLETED' or 'images' in fal_data or 'image' in fal_data:
                    # Результат готов на fal.ai — но НЕ сохраняем fal URL в БД.
                    # Триггерим worker: он скачает, загрузит в S3, обновит БД и сохранит в history.
                    # Фронт в следующем polling получит S3 URL.
                    try:
                        import urllib.request
                        worker_url = f'https://functions.poehali.dev/8b34e115-88be-4740-887a-36c388980955?task_id={task_id}'
                        req = urllib.request.Request(worker_url, method='GET')
                        urllib.request.urlopen(req, timeout=2)
                        print(f'[Status] Worker triggered for completed fal task {task_id}')
                    except Exception as we:
                        print(f'[Status] Worker trigger failed: {we}')
                    # Оставляем статус processing до тех пор, пока worker не запишет S3 URL

                elif fal_status in ('FAILED', 'EXPIRED'):
                    error_msg = fal_data.get('error', 'Generation failed')
                    cursor.execute('''
                        UPDATE freegen_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (str(error_msg)[:500], datetime.utcnow(), task_id))
                    conn.commit()
                    status = 'failed'
                    error_message = str(error_msg)
            except Exception as e:
                print(f'[Status] Force check error: {e}')

        # Доп. защита: если в БД по ошибке оказался fal URL вместо S3 — не отдаём его фронту.
        # Пусть фронт продолжит polling, пока worker не заменит URL на S3.
        if result_url and isinstance(result_url, str):
            if 'fal.media' in result_url or 'fal.run' in result_url or 'queue.fal.run' in result_url:
                # Триггерим worker ещё раз — пусть доскачает в S3
                try:
                    import urllib.request
                    worker_url = f'https://functions.poehali.dev/8b34e115-88be-4740-887a-36c388980955?task_id={task_id}'
                    req = urllib.request.Request(worker_url, method='GET')
                    urllib.request.urlopen(req, timeout=2)
                except Exception:
                    pass
                # Временно откатываем статус на processing для фронта
                status = 'processing'
                result_url = None

        cursor.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': status,
                'result_url': result_url,
                'error_message': error_message,
            }),
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'}),
        }