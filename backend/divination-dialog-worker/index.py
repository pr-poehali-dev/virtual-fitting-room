"""Воркер диалога-гадания: ходит в нейросеть и сохраняет ответ.

Вынесен отдельно, потому что ответ модели идёт дольше лимита
быстрой функции. При ошибке возвращает деньги за шаг.
"""

import json
import os
import time
import uuid

import psycopg2
import requests

from divination.dialog_prompt import build_dialog_prompt, split_answer_and_summary

DB_SCHEMA = 't_p29007832_virtual_fitting_room'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
}


def get_db():
    dsn = os.environ['DATABASE_URL']
    sep = '&' if '?' in dsn else '?'
    return psycopg2.connect(f'{dsn}{sep}options=-c%20search_path%3D{DB_SCHEMA}')


def get_openrouter_proxies():
    proxy_url = (os.environ.get('OPENROUTER_PROXY_URL') or '').strip()
    if not proxy_url:
        return None
    return {'http': proxy_url, 'https': proxy_url}


def call_openrouter(model: str, prompt_text: str):
    api_key = (
        os.environ.get('OPENROUTER_API_KEY_NEW')
        or os.environ.get('OPENROUTER_API_KEY_OLD')
        or ''
    ).strip()
    if not api_key:
        return None, 'Ключ OpenRouter не настроен'

    t0 = time.time()
    try:
        r = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': model,
                'messages': [{'role': 'user', 'content': prompt_text}],
                'max_tokens': 3000,
                'temperature': 0.8,
            },
            timeout=110,
            proxies=get_openrouter_proxies(),
        )
    except Exception as e:
        return None, f'Сеть: {str(e)[:200]}'

    print(
        f'[timing] dialog model={model} prompt_chars={len(prompt_text)} '
        f'total={time.time() - t0:.1f}s status={r.status_code}'
    )

    if r.status_code != 200:
        return None, f'Сервис ответил {r.status_code}: {r.text[:200]}'

    try:
        data = r.json()
        choice = (data.get('choices') or [{}])[0]
        finish = choice.get('finish_reason') or choice.get('native_finish_reason')
        content = (choice.get('message') or {}).get('content')
        if not content or (finish and str(finish).lower() == 'error'):
            # Провайдер ответил 200, но текста нет. Причина лежит рядом с
            # ответом — печатаем её целиком, иначе разбираться потом не по чему
            print(
                f'[openrouter-fail] model={model} finish={finish} '
                f'native={choice.get("native_finish_reason")} '
                f'provider={data.get("provider")} '
                f'err={json.dumps(data.get("error"), ensure_ascii=False)[:400]} '
                f'choice_err={json.dumps(choice.get("error"), ensure_ascii=False)[:400]} '
                f'raw={r.text[:600]}'
            )
            reason = 'Ответ оборван' if content else f'Пустой ответ (finish_reason={finish})'
            return None, reason
        return content, None
    except Exception as e:
        return None, f'Разбор ответа: {str(e)[:200]}'


def call_openrouter_retrying(model: str, prompt_text: str, attempts: int = 3):
    """Мгновенный отказ провайдера — обычно разовый сбой на его стороне.
    Пробуем ещё раз, вместо того чтобы гонять человека нажимать «отправить».
    Повторяем только пустые ответы: содержательные ошибки повтор не лечит."""
    last_error = None
    started = time.time()
    for i in range(attempts):
        # Повтор имеет смысл только для мгновенных отказов. Если время уже
        # потрачено — не рискуем упереться в лимит выполнения функции
        if i and time.time() - started > 60:
            print('[openrouter-retry] времени на повтор не осталось')
            break
        text, error = call_openrouter(model, prompt_text)
        if text and not error:
            if i:
                print(f'[openrouter-retry] успех с попытки {i + 1}')
            return text, None
        last_error = error
        retryable = error and (
            'оборван' in error or 'Пустой ответ' in error or error.startswith('Сеть')
        )
        if not retryable or i == attempts - 1:
            break
        print(f'[openrouter-retry] попытка {i + 1} не удалась ({error}), повтор')
        time.sleep(1.5 * (i + 1))
    return None, last_error


def refund_step(conn, step_id, dialog_id, cost, user_id):
    """Возвращает деньги за неудавшийся шаг (один раз)."""
    if not cost or float(cost) <= 0:
        return
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT refunded FROM {DB_SCHEMA}.divination_dialog_steps WHERE id = %s",
            (step_id,),
        )
        row = cur.fetchone()
        if not row or row[0]:
            return
        cur.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
        bal_row = cur.fetchone()
        before = float(bal_row[0]) if bal_row else 0
        cur.execute(
            'UPDATE users SET balance = balance + %s WHERE id = %s', (cost, user_id)
        )
        cur.execute(
            f"""INSERT INTO {DB_SCHEMA}.balance_transactions
                (user_id, type, amount, balance_before, balance_after, description)
                VALUES (%s, 'refund', %s, %s, %s, %s)""",
            (user_id, cost, before, before + float(cost),
             'Возврат: диалог-гадание (ошибка)'),
        )
        cur.execute(
            f"""UPDATE {DB_SCHEMA}.divination_dialog_steps
                SET refunded = true WHERE id = %s""",
            (step_id,),
        )
    conn.commit()


def process_step(step_id: str) -> dict:
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT s.dialog_id, s.step_no, s.question, s.cards, s.status, s.cost,
                           d.user_id, d.spread, d.model, d.context
                    FROM {DB_SCHEMA}.divination_dialog_steps s
                    JOIN {DB_SCHEMA}.divination_dialogs d ON d.id = s.dialog_id
                    WHERE s.id = %s""",
                (step_id,),
            )
            row = cur.fetchone()
            if not row:
                return {'error': 'step not found'}

            (dialog_id, step_no, question, cards, status, cost,
             user_id, spread_id, model, ctx) = row

            if status != 'pending':
                return {'status': status, 'skipped': True}

            # Атомарно занимаем шаг, чтобы не обработать дважды
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.divination_dialog_steps
                    SET status = 'processing', updated_at = NOW()
                    WHERE id = %s AND status = 'pending'""",
                (step_id,),
            )
            if cur.rowcount == 0:
                return {'status': 'busy'}

            # Предыстория: только готовые шаги до текущего
            cur.execute(
                f"""SELECT step_no, question, cards, summary
                    FROM {DB_SCHEMA}.divination_dialog_steps
                    WHERE dialog_id = %s AND status = 'done' AND step_no < %s
                    ORDER BY step_no""",
                (dialog_id, step_no),
            )
            history = [{
                'step_no': h[0],
                'question': h[1],
                'cards': h[2] if isinstance(h[2], list) else [],
                'summary': h[3] or '',
            } for h in cur.fetchall()]
        conn.commit()

        prompt_text = build_dialog_prompt(
            spread_id,
            question,
            cards if isinstance(cards, list) else [],
            history,
            context=ctx if isinstance(ctx, dict) else None,
        )
        # Сохраняем отправленный текст — так его видно в базе для проверки
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.divination_dialog_steps
                    SET prompt = %s WHERE id = %s""",
                (prompt_text, step_id),
            )
        conn.commit()

        ai_text, error = call_openrouter_retrying(model, prompt_text)

        if error or not ai_text:
            print(f'[{step_id}] Ошибка: {error}')
            with conn.cursor() as cur:
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.divination_dialog_steps
                        SET status = 'failed', updated_at = NOW() WHERE id = %s""",
                    (step_id,),
                )
            conn.commit()
            refund_step(conn, step_id, dialog_id, cost, user_id)
            return {'status': 'failed', 'error': error}

        answer, summary = split_answer_and_summary(ai_text)
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.divination_dialog_steps
                    SET status = 'done', answer_text = %s, summary = %s, updated_at = NOW()
                    WHERE id = %s""",
                (answer, summary, step_id),
            )
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.divination_dialogs
                    SET steps_count = %s, total_spent = total_spent + %s, updated_at = NOW()
                    WHERE id = %s""",
                (step_no, cost, dialog_id),
            )
        conn.commit()
        return {'status': 'done', 'step_no': step_no}
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    """Готовит ответ нейросети на шаг диалога-гадания."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'isBase64Encoded': False, 'body': ''}

    params = event.get('queryStringParameters') or {}
    step_id = params.get('step_id')
    if not step_id and event.get('body'):
        try:
            step_id = (json.loads(event['body']) or {}).get('step_id')
        except json.JSONDecodeError:
            step_id = None

    if not step_id:
        return {'statusCode': 400, 'headers': CORS, 'isBase64Encoded': False,
                'body': json.dumps({'error': 'step_id is required'})}

    try:
        uuid.UUID(str(step_id))
    except ValueError:
        return {'statusCode': 404, 'headers': CORS, 'isBase64Encoded': False,
                'body': json.dumps({'error': 'step not found'})}

    result = process_step(str(step_id))
    return {
        'statusCode': 200,
        'headers': CORS,
        'isBase64Encoded': False,
        'body': json.dumps(result, ensure_ascii=False),
    }