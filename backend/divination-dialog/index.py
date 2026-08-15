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


def trigger_worker(step_id):
    """Будит воркер, который сходит в нейросеть. Ответ не ждём."""
    try:
        import urllib.request
        worker_url = os.environ.get(
            'DIALOG_WORKER_URL',
            'https://functions.poehali.dev/a5284fc1-21a4-45a5-8e29-4672324b9193',
        )
        if not worker_url:
            return
        req = urllib.request.Request(f'{worker_url}?step_id={step_id}', method='GET')
        urllib.request.urlopen(req, timeout=2)
    except Exception as e:
        print(f'Worker trigger (non-critical): {e}')


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
    """Создаёт диалог. Незакрытые беседы при этом НЕ удаляются."""
    system = body.get('system')
    if system not in ('lenormand', 'tarot'):
        system = 'lenormand'
    spread_id = body.get('spread') or f'{system}_dialog'
    if not pricing.is_dialog_spread(spread_id):
        return resp(400, {'error': 'Этот расклад не поддерживает диалог'}, event)

    model = body.get('model')
    if model not in pricing.ALLOWED_MODELS:
        model = pricing.DEFAULT_MODEL

    # Сколько карт тянуть на один вопрос (1..6)
    try:
        cards_per_step = int(body.get('cards_per_step') or 1)
    except (TypeError, ValueError):
        cards_per_step = 1
    cards_per_step = max(1, min(6, cards_per_step))

    # Режим колоды: full — каждый вопрос из полной колоды,
    # single — одна колода на весь диалог (карты не повторяются)
    deck_mode = body.get('deck_mode')
    if deck_mode not in ('full', 'single'):
        deck_mode = 'full'

    ctx = {
        'gender': body.get('gender') or 'female',
        'period': body.get('period') or 'now',
        'spheres': body.get('spheres') or [],
        'comment': (body.get('comment') or '').strip(),
    }

    dialog_id = str(uuid.uuid4())
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""INSERT INTO {DB_SCHEMA}.divination_dialogs
                    (id, user_id, deck, spread, model, status, context,
                     deck_mode, cards_per_step)
                    VALUES (%s, %s, %s, %s, %s, 'active', %s::jsonb, %s, %s)""",
                (dialog_id, user_id, system, spread_id, model,
                 json.dumps(ctx, ensure_ascii=False), deck_mode, cards_per_step),
            )
        conn.commit()
    finally:
        conn.close()

    return resp(200, {
        'dialog_id': dialog_id,
        'spread': spread_id,
        'model': model,
        'deck_mode': deck_mode,
        'cards_per_step': cards_per_step,
        'step_price': pricing.get_price(spread_id, model),
        'max_steps': pricing.DIALOG_MAX_STEPS,
    }, event)


def action_ask(body, user_id, event):
    """Создаёт шаг диалога и списывает деньги. Ответ нейросети готовит воркер."""
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
                f"""SELECT user_id, deck, spread, model, status, steps_count,
                           cards_per_step
                    FROM {DB_SCHEMA}.divination_dialogs WHERE id = %s""",
                (dialog_id,),
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {'error': 'Диалог не найден'}, event)

            (owner, deck, spread_id, model, status, steps_count,
             cards_per_step) = row
            if str(owner) != str(user_id):
                return resp(403, {'error': 'Чужой диалог'}, event)
            if status != 'active':
                return resp(400, {'error': 'Диалог уже закрыт'}, event)
            if steps_count >= pricing.DIALOG_MAX_STEPS:
                return resp(400, {
                    'error': f'Достигнут предел в {pricing.DIALOG_MAX_STEPS} вопросов. '
                             f'Начните новый диалог.'
                }, event)

            # Сколько карт допустимо на один вопрос — задано при создании диалога
            spread = get_spread(spread_id)
            limit = min(int(cards_per_step or 1), spread['size'])
            if len(cards) > limit:
                cards = cards[:limit]

            # Цену берём только с сервера
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

            cur.execute(
                f"""SELECT COALESCE(MAX(step_no), 0)
                    FROM {DB_SCHEMA}.divination_dialog_steps
                    WHERE dialog_id = %s""",
                (dialog_id,),
            )
            step_no = (cur.fetchone()[0] or 0) + 1
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
    finally:
        conn.close()

    # Нейросеть отвечает дольше лимита функции — работу доделывает воркер
    trigger_worker(step_id)

    return resp(200, {
        'status': 'pending',
        'step_id': step_id,
        'step_no': step_no,
        'question': question,
        'cards': cards,
        'cost': cost,
        'steps_left': pricing.DIALOG_MAX_STEPS - step_no,
    }, event)


def action_step_status(body, user_id, event):
    """Готов ли ответ на шаг диалога."""
    step_id = (body.get('step_id') or '').strip()
    try:
        uuid.UUID(step_id)
    except (ValueError, AttributeError):
        return resp(404, {'error': 'Шаг не найден'}, event)

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT s.status, s.answer_text, s.step_no, s.question, s.cards, d.user_id
                    FROM {DB_SCHEMA}.divination_dialog_steps s
                    JOIN {DB_SCHEMA}.divination_dialogs d ON d.id = s.dialog_id
                    WHERE s.id = %s""",
                (step_id,),
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {'error': 'Шаг не найден'}, event)
            status, answer, step_no, question, cards, owner = row
            if str(owner) != str(user_id):
                return resp(403, {'error': 'Чужой диалог'}, event)
    finally:
        conn.close()

    if status == 'failed':
        return resp(200, {
            'status': 'failed',
            'error': 'Не удалось получить ответ. Деньги возвращены на баланс. '
                     'Попробуйте задать вопрос ещё раз.',
        }, event)

    return resp(200, {
        'status': status,
        'step_no': step_no,
        'question': question,
        'cards': cards if isinstance(cards, list) else [],
        'answer': answer or '',
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


def action_last(body, user_id, event):
    """Последний незакрытый диалог пользователя — чтобы продолжить после перезагрузки."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT id, deck, spread, model, steps_count, context,
                           deck_mode, cards_per_step
                    FROM {DB_SCHEMA}.divination_dialogs
                    WHERE user_id = %s AND status = 'active'
                    ORDER BY created_at DESC LIMIT 1""",
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                return resp(200, {'empty': True}, event)

            (dialog_id, deck, spread_id, model, steps_count, ctx,
             deck_mode, cards_per_step) = row
            cur.execute(
                f"""SELECT step_no, question, cards, answer_text
                    FROM {DB_SCHEMA}.divination_dialog_steps
                    WHERE dialog_id = %s AND status = 'done'
                    ORDER BY step_no""",
                (dialog_id,),
            )
            steps = [{
                'step_no': r[0],
                'question': r[1],
                'cards': r[2] if isinstance(r[2], list) else [],
                'answer': r[3] or '',
            } for r in cur.fetchall()]
    finally:
        conn.close()

    if not steps:
        return resp(200, {'empty': True}, event)

    return resp(200, {
        'empty': False,
        'dialog_id': dialog_id,
        'system': deck,
        'spread': spread_id,
        'model': model,
        'context': ctx if isinstance(ctx, dict) else {},
        'deck_mode': deck_mode,
        'cards_per_step': cards_per_step,
        # Уже вытянутые карты — нужны для режима «одна колода»
        'used_cards': [c for st in steps for c in (st.get('cards') or [])],
        'step_price': pricing.get_price(spread_id, model),
        'max_steps': pricing.DIALOG_MAX_STEPS,
        'steps': steps,
    }, event)


def action_list(body, user_id, event):
    """Все беседы пользователя: незакрытые + последняя закрытая."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT d.id, d.deck, d.spread, d.model, d.status, d.steps_count,
                           d.deck_mode, d.cards_per_step, d.created_at,
                           (SELECT question FROM {DB_SCHEMA}.divination_dialog_steps
                             WHERE dialog_id = d.id AND status = 'done'
                             ORDER BY step_no LIMIT 1) AS first_question,
                           (SELECT question FROM {DB_SCHEMA}.divination_dialog_steps
                             WHERE dialog_id = d.id AND status = 'done'
                             ORDER BY step_no DESC LIMIT 1) AS last_question
                    FROM {DB_SCHEMA}.divination_dialogs d
                    WHERE d.user_id = %s AND d.steps_count > 0
                    ORDER BY d.status = 'active' DESC, d.created_at DESC""",
                (user_id,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    items = []
    closed_seen = False
    for r in rows:
        status = r[4]
        # Показываем все незакрытые и только последнюю закрытую
        if status != 'active':
            if closed_seen:
                continue
            closed_seen = True
        items.append({
            'dialog_id': str(r[0]),
            'system': r[1],
            'spread': r[2],
            'model': r[3],
            'status': status,
            'steps_count': r[5],
            'deck_mode': r[6],
            'cards_per_step': r[7],
            'created_at': r[8].isoformat() if r[8] else None,
            'first_question': r[9] or '',
            'last_question': r[10] or '',
            'step_price': pricing.get_price(r[2], r[3]),
        })

    return resp(200, {'items': items, 'max_steps': pricing.DIALOG_MAX_STEPS}, event)


def action_close(body, user_id, event):
    """Закрывает диалог. Прежняя закрытая беседа при этом удаляется —
    хранится только последняя закрытая. Незакрытые не трогаем."""
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
            # Оставляем только последнюю закрытую беседу
            cur.execute(
                f"""SELECT id FROM {DB_SCHEMA}.divination_dialogs
                    WHERE user_id = %s AND status = 'closed'
                    ORDER BY updated_at DESC OFFSET 1""",
                (user_id,),
            )
            old_ids = [str(r[0]) for r in cur.fetchall()]
            for old_id in old_ids:
                cur.execute(
                    f"DELETE FROM {DB_SCHEMA}.divination_dialog_steps WHERE dialog_id = %s",
                    (old_id,),
                )
                cur.execute(
                    f"DELETE FROM {DB_SCHEMA}.divination_dialogs WHERE id = %s",
                    (old_id,),
                )
        conn.commit()
    finally:
        conn.close()
    return resp(200, {'status': 'closed', 'deleted_old': len(old_ids)}, event)


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
    if action == 'step_status':
        return action_step_status(body, user_id, event)
    if action == 'list':
        return action_list(body, user_id, event)
    if action == 'last':
        return action_last(body, user_id, event)
    if action == 'history':
        return action_history(body, user_id, event)
    if action == 'close':
        return action_close(body, user_id, event)

    return resp(400, {'error': 'Неизвестное действие'}, event)
