import json
import os
import psycopg2
from typing import Dict, Any, Optional, List, Tuple
import requests
from datetime import datetime
from googletrans import Translator
import boto3
import time
import uuid
import base64

GENERATION_COST = 50
S3_BUCKET = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')


def translate_to_english(text: str) -> str:
    '''Перевод русского текста на английский'''
    if not text or not text.strip():
        return text
    try:
        translator = Translator()
        detected = translator.detect(text)
        if detected.lang == 'ru':
            translated = translator.translate(text, src='ru', dest='en')
            return translated.text
        return text
    except Exception as e:
        print(f'[Translate] Error: {e}')
        return text


def build_prompt(user_prompt: str, refs_count: int) -> str:
    '''Собрать финальный промпт с пояснением меток @ref1..@refN'''
    translated = translate_to_english(user_prompt)
    if refs_count == 0:
        return translated

    labels = ', '.join([f'ref{i+1}' for i in range(refs_count)])
    prefix = (
        f"The provided reference images are labeled as {labels} in the order given. "
        f"When the user prompt mentions @ref1, @ref2, etc., it refers to the corresponding reference image. "
    )
    # Меняем @ref на ref в самом prompt (оставляем для наглядности)
    user_part = translated
    return prefix + user_part


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


def upload_reference_to_s3(ref_data: str, task_id: str, index: int) -> str:
    '''Загрузить base64-референс во временную папку Яндекс Облака и вернуть URL'''
    # ref_data может быть data URI или чистый base64 или URL
    if ref_data.startswith('http://') or ref_data.startswith('https://'):
        return ref_data

    if ref_data.startswith('data:'):
        header, b64 = ref_data.split(',', 1)
        # Извлекаем content type
        ct = 'image/jpeg'
        if 'image/png' in header:
            ct = 'image/png'
        elif 'image/webp' in header:
            ct = 'image/webp'
    else:
        b64 = ref_data
        ct = 'image/jpeg'

    image_bytes = base64.b64decode(b64)
    ext = 'jpg' if ct == 'image/jpeg' else ct.split('/')[-1]
    key = f'images/freegeneration/tmp/{task_id}/ref{index+1}.{ext}'

    s3 = get_s3_client()
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=image_bytes,
        ContentType=ct,
    )
    url = f'https://storage.yandexcloud.net/{S3_BUCKET}/{key}'
    print(f'[S3] Reference {index+1} uploaded to {url}')
    return url


def delete_tmp_references(task_id: str, count: int) -> None:
    '''Удалить временные референсы после завершения задачи'''
    try:
        s3 = get_s3_client()
        for i in range(count):
            for ext in ('jpg', 'png', 'webp'):
                key = f'images/freegeneration/tmp/{task_id}/ref{i+1}.{ext}'
                try:
                    s3.delete_object(Bucket=S3_BUCKET, Key=key)
                except Exception:
                    pass
        print(f'[S3] Cleaned tmp references for task {task_id}')
    except Exception as e:
        print(f'[S3] Cleanup error (non-critical): {e}')


def submit_to_fal_queue(prompt: str, reference_urls: List[str], aspect_ratio: str) -> Tuple[str, str]:
    '''Отправить задачу в очередь fal.ai и вернуть (request_id, response_url)'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')

    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json',
    }

    if reference_urls:
        endpoint = 'https://queue.fal.run/fal-ai/nano-banana-2/edit'
        payload = {
            'image_urls': reference_urls,
            'prompt': prompt,
            'aspect_ratio': aspect_ratio,
            'num_images': 1,
            'resolution': '1K',
            'output_format': 'png',
        }
    else:
        endpoint = 'https://queue.fal.run/fal-ai/nano-banana-2'
        payload = {
            'prompt': prompt,
            'aspect_ratio': aspect_ratio,
            'num_images': 1,
            'resolution': '1K',
            'output_format': 'png',
        }

    print(f'[fal.ai] POST {endpoint} | aspect={aspect_ratio} | refs={len(reference_urls)}')
    response = requests.post(endpoint, headers=headers, json=payload, timeout=30)

    if response.status_code == 200:
        result = response.json()
        if 'request_id' in result and 'response_url' in result:
            return (result['request_id'], result['response_url'])

    raise Exception(f'Failed to submit to fal.ai queue: {response.status_code} - {response.text[:300]}')


def check_fal_status(response_url: str) -> Optional[dict]:
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
    if response.status_code >= 500:
        error_text = response.text[:200] if response.text else 'Unknown server error'
        return {'status': 'FAILED', 'error': f'fal.ai server error {response.status_code}: {error_text}'}
    raise Exception(f'Failed to check status: {response.status_code}')


def upload_result_to_s3(image_url: str, user_id: str) -> str:
    '''Скачать результат с fal.ai и загрузить в папку freegeneration Яндекс Облака'''
    img_response = requests.get(image_url, timeout=30)
    if img_response.status_code != 200:
        raise Exception(f'Failed to download result: {img_response.status_code}')
    image_data = img_response.content

    timestamp = time.strftime('%Y%m%d_%H%M%S')
    milliseconds = int(time.time() * 1000) % 1000000
    random_suffix = uuid.uuid4().hex[:8]
    filename = f'freegen_{timestamp}_{milliseconds}_{user_id}_{random_suffix}.png'
    s3_key = f'images/freegeneration/{user_id}/{filename}'

    s3 = get_s3_client()
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=image_data,
        ContentType='image/png',
    )
    cdn_url = f'https://storage.yandexcloud.net/{S3_BUCKET}/{s3_key}'
    print(f'[S3] Result uploaded: {cdn_url}')
    return cdn_url


def refund_balance_if_needed(conn, user_id: str, task_id: str) -> None:
    '''Возврат 50 руб, если не unlimited и ещё не возвращено'''
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT refunded FROM t_p29007832_virtual_fitting_room.freegen_tasks WHERE id = %s', (task_id,))
        row = cursor.fetchone()
        if row and row[0]:
            cursor.close()
            return

        cursor.execute('SELECT unlimited_access, balance FROM users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            cursor.close()
            return

        unlimited_access = user_row[0]
        balance_before = float(user_row[1])

        if unlimited_access:
            cursor.execute('UPDATE t_p29007832_virtual_fitting_room.freegen_tasks SET refunded = true WHERE id = %s', (task_id,))
            conn.commit()
            cursor.close()
            return

        balance_after = balance_before + GENERATION_COST
        cursor.execute('UPDATE users SET balance = balance + %s WHERE id = %s', (GENERATION_COST, user_id))
        cursor.execute('UPDATE t_p29007832_virtual_fitting_room.freegen_tasks SET refunded = true WHERE id = %s', (task_id,))
        cursor.execute('''
            INSERT INTO balance_transactions
            (user_id, type, amount, balance_before, balance_after, description, try_on_id)
            VALUES (%s, 'refund', %s, %s, %s, 'Возврат: технический сбой свободной генерации', NULL)
        ''', (user_id, GENERATION_COST, balance_before, balance_after))
        conn.commit()
        print(f'[Refund] Refunded {GENERATION_COST}₽ to user {user_id} for task {task_id}')
        cursor.close()
    except Exception as e:
        print(f'[Refund] Error: {e}')


def save_to_history(conn, user_id: str, cdn_url: str, prompt: str, references_json: str, aspect_ratio: str, task_id: str) -> Optional[str]:
    '''Сохранить в freegen_history'''
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT unlimited_access FROM users WHERE id = %s', (user_id,))
        row = cursor.fetchone()
        unlimited = row[0] if row else False
        cost = 0 if unlimited else GENERATION_COST

        cursor.execute('''
            INSERT INTO t_p29007832_virtual_fitting_room.freegen_history
            (user_id, prompt, "references", aspect_ratio, result_image, cost, task_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            user_id,
            prompt,
            references_json,
            aspect_ratio,
            cdn_url,
            cost,
            task_id,
            datetime.utcnow(),
        ))
        hid = cursor.fetchone()
        history_id = str(hid[0]) if hid else None
        conn.commit()
        cursor.close()
        print(f'[History] Saved to freegen_history id={history_id}')
        return history_id
    except psycopg2.errors.UniqueViolation:
        print(f'[History] Task {task_id} already saved, skipping')
        cursor.close()
        return None
    except Exception as e:
        print(f'[History] Error: {e}')
        try:
            cursor.close()
        except Exception:
            pass
        return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Обработчик задачи свободной генерации NanoBanana 2 по task_id (асинхронный воркер)
    Args: event - dict с queryStringParameters (task_id)
          context - объект с request_id
    Returns: HTTP-ответ со статусом обработки
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
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    query_params = event.get('queryStringParameters') or {}
    task_id = query_params.get('task_id')
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id parameter is required'}),
        }

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'}),
        }

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, prompt, "references", aspect_ratio, fal_request_id, fal_response_url, user_id, status, saved_to_history
            FROM t_p29007832_virtual_fitting_room.freegen_tasks
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

        task_id, prompt, references_json, aspect_ratio, fal_request_id, fal_response_url, user_id, task_status, saved_to_history = row
        references = json.loads(references_json) if references_json else []

        if saved_to_history:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'status': 'already_processed'}),
            }

        # --- PENDING: отправить в fal.ai
        if task_status == 'pending':
            if not fal_request_id:
                cursor.execute('''
                    UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                    SET status = 'processing', updated_at = %s
                    WHERE id = %s AND status = 'pending'
                    RETURNING id
                ''', (datetime.utcnow(), task_id))
                updated = cursor.fetchone()
                conn.commit()

                if not updated:
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'task_already_processing'}),
                    }

                try:
                    # Загрузить референсы как URL
                    ref_urls = []
                    for i, ref in enumerate(references):
                        url = upload_reference_to_s3(ref, task_id, i)
                        ref_urls.append(url)

                    final_prompt = build_prompt(prompt or '', len(ref_urls))
                    print(f'[Freegen] Prompt: {final_prompt[:200]}')

                    request_id, response_url = submit_to_fal_queue(final_prompt, ref_urls, aspect_ratio or '1:1')

                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                        SET fal_request_id = %s, fal_response_url = %s, updated_at = %s
                        WHERE id = %s
                    ''', (request_id, response_url, datetime.utcnow(), task_id))
                    conn.commit()
                    task_status = 'processing'
                    fal_response_url = response_url

                except Exception as e:
                    error_msg = str(e)
                    print(f'[Freegen] Submit failed: {error_msg}')
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg[:500], datetime.utcnow(), task_id))
                    conn.commit()
                    refund_balance_if_needed(conn, user_id, task_id)
                    delete_tmp_references(task_id, len(references))

        # --- PROCESSING: проверить статус
        if task_status == 'processing' and fal_response_url:
            try:
                status_data = check_fal_status(fal_response_url)
                fal_status = status_data.get('status', status_data.get('state', 'UNKNOWN'))

                if fal_status.upper() == 'COMPLETED' or 'images' in status_data or 'image' in status_data:
                    fal_result_url = None
                    if 'images' in status_data and len(status_data['images']) > 0:
                        fal_result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            fal_result_url = status_data['image']['url']
                        else:
                            fal_result_url = status_data['image']

                    if fal_result_url:
                        print(f'[Freegen] Task {task_id} completed, fal URL: {fal_result_url[:60]}')
                        try:
                            cdn_url = upload_result_to_s3(fal_result_url, user_id)

                            cursor.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                                SET saved_to_history = true
                                WHERE id = %s AND saved_to_history = false
                                RETURNING id
                            ''', (task_id,))
                            atomic = cursor.fetchone()
                            conn.commit()

                            if atomic:
                                save_to_history(conn, user_id, cdn_url, prompt or '', references_json, aspect_ratio or '1:1', task_id)

                            cursor.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                                SET status = 'completed', result_url = %s, updated_at = %s
                                WHERE id = %s
                            ''', (cdn_url, datetime.utcnow(), task_id))
                            conn.commit()

                            delete_tmp_references(task_id, len(references))
                        except Exception as save_err:
                            print(f'[Freegen] Save error: {save_err}')
                            cursor.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                                SET status = 'completed', result_url = %s, updated_at = %s, error_message = %s
                                WHERE id = %s
                            ''', (fal_result_url, datetime.utcnow(), f'S3 save failed: {str(save_err)[:200]}', task_id))
                            conn.commit()

                elif fal_status.upper() in ('FAILED', 'EXPIRED'):
                    error_raw = status_data.get('error', 'Generation failed')
                    error_msg = f'Ошибка генерации: {str(error_raw)[:200]}'
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    refund_balance_if_needed(conn, user_id, task_id)
                    delete_tmp_references(task_id, len(references))

            except Exception as e:
                err = str(e)
                print(f'[Freegen] Check error: {err}')
                try:
                    cursor.execute('SELECT created_at FROM t_p29007832_virtual_fitting_room.freegen_tasks WHERE id = %s', (task_id,))
                    crow = cursor.fetchone()
                    if crow:
                        age = (datetime.utcnow() - crow[0]).total_seconds()
                        if age > 660:
                            cursor.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.freegen_tasks
                                SET status = 'failed', error_message = %s, updated_at = %s
                                WHERE id = %s AND status = 'processing'
                            ''', (f'Timeout after {int(age)}s: {err[:150]}', datetime.utcnow(), task_id))
                            conn.commit()
                            refund_balance_if_needed(conn, user_id, task_id)
                            delete_tmp_references(task_id, len(references))
                except Exception as ie:
                    print(f'[Freegen] Fallback error: {ie}')

        cursor.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'status': 'ok', 'task_id': task_id}),
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'}),
        }
