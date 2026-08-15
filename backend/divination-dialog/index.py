"""Диалог-гадание: вопрос + карты -> ответ нейросети, с учётом предыстории.

Поддерживает действия:
- start   : создать диалог
- ask     : задать вопрос с картами и получить ответ (списывает деньги)
- history : получить диалог со всеми шагами
- close   : закрыть диалог
"""

import json
import os
import uuid
from datetime import datetime

import psycopg2
import requests

from session_utils import validate_session
from divination import pricing
from divination.spreads import get_spread
from divination.dialog_prompt import build_dialog_prompt, split_answer_and_summary

DB_SCHEMA = 't_p29007832_virtual_fitting_room'

ALLOWED_ORIGINS = [
    'https://fitting-room.ru',
    'https://preview--virtual-fitting-room.poehali.dev',
]


def get_cors_origin(event):
    headers = event.get('headers', {}) or {}
    origin = headers.get('origin') or headers.get('Origin', '')
    return origin if origin in ALLOWED_ORIGINS else 'https://fitting-room.ru'


def make_cors_headers(event):
    return {
        'Access-Control-Allow-Origin': get_cors_origin(event),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
    }


def get_db():
    dsn = os.environ['DATABASE_URL']
    sep = '&' if '?' in dsn else '?'
    return psycopg2.connect(f'{dsn}{sep}options=-c%20search_path%3D{DB_SCHEMA}')


def resp(status, body, event):
    return {
        'statusCode': status,
        'headers': make_cors_headers(event),
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False),
    }


def get_openrouter_proxies():
    proxy_url = (os.environ.get('OPENROUTER_PROXY_URL') or '').strip()
    if not proxy_url:
        return None
    return {'http': proxy_url, 'https': proxy_url}


def call_openrouter(model: str, prompt_text: str):
    """Возвращает (текст, ошибка)."""
    api_key = (
        os.environ.get('OPENROUTER_API_KEY_NEW')
        or os.environ.get('OPENROUTER_API_KEY_OLD')
        or ''
    ).strip()
    if not api_key:
        return None, 'Ключ OpenRouter не настроен'

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
                'max_tokens': 2000,
                'temperature': 0.8,
            },
            timeout=120,
            proxies=get_openrouter_proxies(),
        )
    except Exception as e:
        return None, f'Сеть: {str(e)[:200]}'

    if r.status_code != 200:
        return None, f'Сервис ответил {r.status_code}'

    try:
        data = r.json()
        choice = (data.get('choices') or [{}])[0]
        finish = choice.get('finish_reason') or choice.get('native_finish_reason')
        content = (choice.get('message') or {}).get('content')
        if not content:
            return None, f'Пустой ответ (finish_reason={finish})'
        if finish and str(finish).lower() == 'error':
            return None, 'Ответ оборван'
        return content, None
    except Exception as e:
        return None, f'Разбор ответа: {str(e)[:200]}'


def load_history(cur, dialog_id):
    cur.execute(
        f"""SELECT step_no, question, cards, summary
            FROM {DB_SCHEMA}.divination_dialog_steps
            WHERE dialog_id = %s AND status = 'done'
            ORDER BY step_no""",
        (dialog_id,),
    )
    history = []
    for step_no, question, cards, summary in cur.fetchall():
        history.append({
            'step_no': step_no,
            'question': question,
            'cards': cards if isinstance(cards, list) else [],
            'summary': summary or '',
        })
    return history


def action_start(body, user_id, event):
    system = body.get('system')
    if system not in ('lenormand', 'tarot'):
        system = 'lenormand'
    spread_id = body.get('spread') or 'lenormand_line3'
    if not pricing.is_dialog_spread(spread_id):
        return resp(400, {'error': 'Этот расклад не поддерживает диалог'}, event)

    model = body.get('model')
    if model not in pricing.ALLOWED_MODELS:
        model = pricing.DEFAULT_MODEL

    dialog_id = str(uuid.uuid4())
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""INSERT INTO {DB_SCHEMA}.divination_dialogs
                    (id, user_id, deck, spread, model, status)
                    VALUES (%s, %s, %s, %s, %s, 'active')""",
                (dialog_id, user_id, system, spread_id, model),
            )
        conn.commit()
    finally:
        conn.close()

    return resp(200, {
        'dialog_id': dialog_id,
        'spread': spread_id,
        'model': model,
        'step_price': pricing.get_price(spread_id, model),
        'max_steps': pricing.DIALOG_MAX_STEPS,
    }, event)


def action_ask(body, user_id, event):
    dialog_id = (body.get('dialog_id') or '').strip()
    question = (body.get('question') or '').strip()
    cards = body.get('cards') or []
    cards = [c for c in cards if isinstance(c, str) and c.strip()]

    if not dialog_id:
        return resp(400, {'error': 'Нет диалога'}, event)
    try:
        uuid.UUID(dialog_id)
    except ValueError:
        return resp(404, {'error': 'Диалог не найден'}, event)
    if not question:
        return resp(400, {'error': 'Напишите вопрос'}, event)
    if not cards:
        return resp(400, {'error': 'Вытяните карты'}, event)

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT user_id, deck, spread, model, status, steps_count
                    FROM {DB_SCHEMA}.divination_dialogs WHERE id = %s""",
                (dialog_id,),
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {'error': 'Диалог не найден'}, event)

            owner, deck, spread_id, model, status, steps_count = row
            if str(owner) != str(user_id):
                return resp(403, {'error': 'Чужой диалог'}, event)
            if status != 'active':
                return resp(400, {'error': 'Диалог уже закрыт'}, event)
            if steps_count >= pricing.DIALOG_MAX_STEPS:
                return resp(400, {
                    'error': f'Достигнут предел в {pricing.DIALOG_MAX_STEPS} вопросов. '
                             f'Начните новый диалог.'
                }, event)

            spread = get_spread(spread_id)
            if len(cards) > spread['size']:
                cards = cards[:spread['size']]

            # Списание: цену берём только с сервера
            price = pricing.get_price(spread_id, model)
            cur.execute(
                'SELECT balance, unlimited_access FROM users WHERE id = %s',
                (user_id,),
            )
            user_row = cur.fetchone()
            if not user_row:
                return resp(404, {'error': 'Пользователь не найден'}, event)

            balance = float(user_row[0])
            unlimited = user_row[1]
            cost = 0 if unlimited else price
            if not unlimited and balance < cost:
                return resp(402, {
                    'error': 'Недостаточно средств',
                    'required': cost,
                    'current': balance,
                }, event)

            history = load_history(cur, dialog_id)
            step_no = len(history) + 1
            step_id = str(uuid.uuid4())

            if cost > 0:
                cur.execute(
                    'UPDATE users SET balance = balance - %s WHERE id = %s',
                    (cost, user_id),
                )
                cur.execute(
                    f"""INSERT INTO {DB_SCHEMA}.balance_transactions
                        (user_id, type, amount, balance_before, balance_after, description)
                        VALUES (%s, 'charge', %s, %s, %s, %s)""",
                    (user_id, cost, balance, balance - cost,
                     f'Диалог-гадание, вопрос {step_no}'),
                )

            cur.execute(
                f"""INSERT INTO {DB_SCHEMA}.divination_dialog_steps
                    (id, dialog_id, step_no, question, cards, status, cost)
                    VALUES (%s, %s, %s, %s, %s::jsonb, 'pending', %s)""",
                (step_id, dialog_id, step_no, question,
                 json.dumps(cards, ensure_ascii=False), cost),
            )
        conn.commit()

        prompt_text = build_dialog_prompt(spread_id, question, cards, history)
        ai_text, error = call_openrouter(model, prompt_text)

        with conn.cursor() as cur:
            if error or not ai_text:
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.divination_dialog_steps
                        SET status = 'failed', refunded = %s, updated_at = NOW()
                        WHERE id = %s""",
                    (cost > 0, step_id),
                )
                if cost > 0:
                    cur.execute(
                        'UPDATE users SET balance = balance + %s WHERE id = %s',
                        (cost, user_id),
                    )
                    cur.execute(
                        f"""INSERT INTO {DB_SCHEMA}.balance_transactions
                            (user_id, type, amount, balance_before, balance_after, description)
                            VALUES (%s, 'refund', %s, %s, %s, %s)""",
                        (user_id, cost, balance - cost, balance,
                         'Возврат: диалог-гадание (ошибка)'),
                    )
                conn.commit()
                return resp(200, {
                    'status': 'failed',
                    'error': 'Не удалось получить ответ. Деньги возвращены на баланс. '
                             'Попробуйте задать вопрос ещё раз.',
                }, event)

            answer, summary = split_answer_and_summary(ai_text)
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
    finally:
        conn.close()

    return resp(200, {
        'status': 'done',
        'step_no': step_no,
        'question': question,
        'cards': cards,
        'answer': answer,
        'cost': cost,
        'steps_left': pricing.DIALOG_MAX_STEPS - step_no,
    }, event)


def action_history(body, user_id, event):
    dialog_id = (body.get('dialog_id') or '').strip()
    try:
        uuid.UUID(dialog_id)
    except (ValueError, AttributeError):
        return resp(404, {'error': 'Диалог не найден'}, event)

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT user_id, deck, spread, model, status, steps_count, total_spent
                    FROM {DB_SCHEMA}.divination_dialogs WHERE id = %s""",
                (dialog_id,),
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {'error': 'Диалог не найден'}, event)
            owner, deck, spread_id, model, status, steps_count, total_spent = row
            if str(owner) != str(user_id):
                return resp(403, {'error': 'Чужой диалог'}, event)

            cur.execute(
                f"""SELECT step_no, question, cards, answer_text, status
                    FROM {DB_SCHEMA}.divination_dialog_steps
                    WHERE dialog_id = %s AND status = 'done'
                    ORDER BY step_no""",
                (dialog_id,),
            )
            steps = [{
                'step_no': s[0],
                'question': s[1],
                'cards': s[2] if isinstance(s[2], list) else [],
                'answer': s[3] or '',
            } for s in cur.fetchall()]
    finally:
        conn.close()

    return resp(200, {
        'dialog_id': dialog_id,
        'system': deck,
        'spread': spread_id,
        'model': model,
        'status': status,
        'steps_count': steps_count,
        'total_spent': float(total_spent or 0),
        'step_price': pricing.get_price(spread_id, model),
        'max_steps': pricing.DIALOG_MAX_STEPS,
        'steps': steps,
    }, event)


def action_close(body, user_id, event):
    dialog_id = (body.get('dialog_id') or '').strip()
    try:
        uuid.UUID(dialog_id)
    except (ValueError, AttributeError):
        return resp(404, {'error': 'Диалог не найден'}, event)

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.divination_dialogs
                    SET status = 'closed', updated_at = NOW()
                    WHERE id = %s AND user_id = %s""",
                (dialog_id, user_id),
            )
        conn.commit()
    finally:
        conn.close()
    return resp(200, {'status': 'closed'}, event)


def handler(event: dict, context) -> dict:
    """Диалог-гадание на картах: вопрос, карты и ответ с учётом предыстории."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': make_cors_headers(event),
                'isBase64Encoded': False, 'body': ''}

    if method != 'POST':
        return resp(405, {'error': 'Method not allowed'}, event)

    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return resp(400, {'error': 'Некорректный запрос'}, event)

    action = body.get('action') or ''

    is_valid, user_id, err = validate_session(event)
    if not is_valid:
        return resp(401, {'error': err or 'Нужен вход'}, event)

    if action == 'start':
        return action_start(body, user_id, event)
    if action == 'ask':
        return action_ask(body, user_id, event)
    if action == 'history':
        return action_history(body, user_id, event)
    if action == 'close':
        return action_close(body, user_id, event)

    return resp(400, {'error': 'Неизвестное действие'}, event)
