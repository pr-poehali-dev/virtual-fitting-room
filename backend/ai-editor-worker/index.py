"""Worker: забирает задачу из БД, вызывает OpenRouter, сохраняет результат."""

import json
import os
import base64
import zipfile
import io
import re
import time
import requests
import psycopg2
from datetime import datetime

OPENROUTER_API_KEY = (os.environ.get("OPENROUTER_API_KEY_NEW") or os.environ.get("OPENROUTER_API_KEY_OLD") or "").strip()
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def get_openrouter_proxies():
    proxy_url = (os.environ.get("OPENROUTER_PROXY_URL") or "").strip()
    if not proxy_url:
        return None
    return {"http": proxy_url, "https": proxy_url}


DB_SCHEMA = 't_p29007832_virtual_fitting_room'

# Как часто сбрасывать в БД уже написанный текст (сек)
PARTIAL_SAVE_SEC = 15
# Через сколько секунд работы аккуратно прерваться и дописать следующим заходом.
# Заметно меньше таймаута облачной функции, чтобы успеть сохранить.
SOFT_DEADLINE_SEC = 210
# Сколько раз максимум дописываем один ответ
MAX_RESUMES = 6

TEXT_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.less',
    '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.md', '.txt', '.rst', '.csv', '.sql', '.sh', '.bash', '.bat', '.ps1',
    '.env', '.gitignore', '.dockerignore', '.editorconfig',
    '.vue', '.svelte', '.astro', '.php', '.rb', '.go', '.rs', '.java',
    '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.cs', '.r', '.lua',
    '.dockerfile', '.tf', '.hcl', '.graphql', '.prisma',
}

SKIP_DIRS = {
    'node_modules', '.git', '__pycache__', '.next', 'dist', 'build',
    '.cache', '.vscode', '.idea', 'vendor', 'venv', '.venv',
}

MAX_FILE_SIZE = 100 * 1024
MAX_TOTAL_TEXT = 400000


def get_db_connection():
    dsn = os.environ.get('DATABASE_URL', '')
    if not dsn:
        raise RuntimeError('DATABASE_URL not set — check function secrets binding')
    conn = psycopg2.connect(dsn)
    conn.set_client_encoding('UTF8')
    return conn


def is_text_file(filename):
    name_lower = filename.lower()
    _, ext = os.path.splitext(name_lower)
    if ext in TEXT_EXTENSIONS:
        return True
    basename = os.path.basename(name_lower)
    return basename in {'makefile', 'dockerfile', 'procfile', 'gemfile', 'rakefile', 'license', 'readme'}


def should_skip_path(filepath):
    parts = filepath.replace('\\', '/').split('/')
    return any(part in SKIP_DIRS for part in parts)


def extract_text_files(zip_bytes):
    files = {}
    total_size = 0
    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
        for info in zf.infolist():
            if info.is_dir() or should_skip_path(info.filename) or not is_text_file(info.filename):
                continue
            if info.file_size > MAX_FILE_SIZE:
                continue
            if total_size + info.file_size > MAX_TOTAL_TEXT:
                break
            try:
                content = zf.read(info.filename).decode('utf-8', errors='replace')
                files[info.filename] = content
                total_size += len(content)
            except Exception:
                continue
    return files


def build_archive_prompt(files, user_prompt):
    file_list = "\n".join(f"- {f}" for f in sorted(files.keys()))
    files_content = ""
    for path, content in sorted(files.items()):
        files_content += f"\n--- FILE: {path} ---\n{content}\n"

    return f"""Ты — опытный разработчик. Тебе дан проект в виде файлов и задача от пользователя.

ФАЙЛЫ ПРОЕКТА:
{file_list}

СОДЕРЖИМОЕ ФАЙЛОВ:
{files_content}

ЗАДАЧА ПОЛЬЗОВАТЕЛЯ:
{user_prompt}

ИНСТРУКЦИИ:
1. Выполни задачу пользователя, изменив нужные файлы
2. Для каждого изменённого или нового файла выведи его ПОЛНОЕ содержимое в формате:

```file:путь/к/файлу
полное содержимое файла
```

3. Выводи ТОЛЬКО изменённые и новые файлы
4. Если нужно удалить файл, напиши: DELETE:путь/к/файлу
5. Перед блоками файлов напиши только КРАТКОЕ описание того, что было сделано, и перечисли названия изменённых/добавленных/удалённых файлов.
6. В описании НЕ дублируй и НЕ вставляй код файлов — весь код должен быть ТОЛЬКО внутри блоков ```file:...```.
"""


def build_plan_prompt(files, user_prompt):
    """Шаг 1: модель только планирует, какие файлы менять. Ответ короткий."""
    file_list = "\n".join(f"- {f}" for f in sorted(files.keys()))
    files_content = ""
    for path, content in sorted(files.items()):
        files_content += f"\n--- FILE: {path} ---\n{content}\n"

    return f"""Ты — опытный разработчик. Тебе дан проект и задача от пользователя.

ФАЙЛЫ ПРОЕКТА:
{file_list}

СОДЕРЖИМОЕ ФАЙЛОВ:
{files_content}

ЗАДАЧА ПОЛЬЗОВАТЕЛЯ:
{user_prompt}

ИНСТРУКЦИИ:
1. НЕ пиши код файлов на этом шаге. Код будет запрошен отдельно.
2. Определи, какие файлы нужно изменить, создать или удалить.
3. Ответь СТРОГО в формате JSON без markdown-обёртки:

{{"summary": "краткое описание что будет сделано",
  "files": [{{"path": "путь/к/файлу", "action": "edit", "what": "что именно изменить"}}],
  "delete": ["путь/к/файлу"]}}

4. action — одно из: edit (изменить существующий), create (создать новый).
5. Включай в files ТОЛЬКО файлы, которые реально нужно изменить или создать.
6. Никакого текста вне JSON.
"""


def build_step_file_prompt(files, user_prompt, target_path, what_to_do, plan_summary):
    """Шаг 2..N: модель возвращает ОДИН файл целиком. Проект виден для контекста."""
    file_list = "\n".join(f"- {f}" for f in sorted(files.keys()))
    files_content = ""
    for path, content in sorted(files.items()):
        files_content += f"\n--- FILE: {path} ---\n{content}\n"

    return f"""Ты — опытный разработчик. Тебе дан проект и задача от пользователя.

ФАЙЛЫ ПРОЕКТА:
{file_list}

СОДЕРЖИМОЕ ФАЙЛОВ:
{files_content}

ЗАДАЧА ПОЛЬЗОВАТЕЛЯ:
{user_prompt}

ОБЩИЙ ПЛАН:
{plan_summary}

ТЕКУЩИЙ ШАГ:
Сейчас работай ТОЛЬКО над файлом: {target_path}
Что нужно сделать в этом файле: {what_to_do}

ИНСТРУКЦИИ:
1. Выведи ПОЛНОЕ итоговое содержимое ТОЛЬКО файла {target_path} в формате:

```file:{target_path}
полное содержимое файла
```

2. НЕ выводи другие файлы — они обрабатываются отдельно.
3. Никаких пояснений до или после блока.
"""


def parse_plan_response(response_text):
    """Достаёт JSON-план из ответа модели, даже если он обёрнут в markdown."""
    text = (response_text or '').strip()
    fenced = re.search(r'```(?:json)?\s*(.*?)```', text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None

    files = []
    for item in data.get('files') or []:
        if not isinstance(item, dict):
            continue
        path = (item.get('path') or '').strip()
        if not path:
            continue
        files.append({
            'path': path,
            'action': (item.get('action') or 'edit').strip(),
            'what': (item.get('what') or '').strip(),
        })

    deletes = [str(p).strip() for p in (data.get('delete') or []) if str(p).strip()]
    return {
        'summary': (data.get('summary') or '').strip(),
        'files': files,
        'delete': deletes,
    }


def build_file_prompt(filename, file_content, user_prompt):
    return f"""Ты — опытный разработчик. Тебе дан файл и задача от пользователя.

ФАЙЛ: {filename}
СОДЕРЖИМОЕ:
{file_content}

ЗАДАЧА ПОЛЬЗОВАТЕЛЯ:
{user_prompt}

ИНСТРУКЦИИ:
1. Выполни задачу пользователя
2. Выведи ПОЛНОЕ содержимое отредактированного файла в формате:

```file:{filename}
полное содержимое файла
```

3. Перед блоком файла напиши только КРАТКОЕ описание того, что было сделано, и перечисли названия изменённых файлов.
4. В описании НЕ дублируй и НЕ вставляй код файла — весь код должен быть ТОЛЬКО внутри блока ```file:...```.
"""


def parse_ai_response(response_text, original_files):
    updated_files = dict(original_files)
    file_pattern = re.compile(r'```file:(.+?)\n(.*?)```', re.DOTALL)
    for filepath, content in file_pattern.findall(response_text):
        updated_files[filepath.strip()] = content.rstrip('\n')
    delete_pattern = re.compile(r'DELETE:(.+?)(?:\n|$)')
    for filepath in delete_pattern.findall(response_text):
        updated_files.pop(filepath.strip(), None)
    return updated_files


def parse_single_file_response(response_text, filename, original_content):
    file_pattern = re.compile(r'```file:.+?\n(.*?)```', re.DOTALL)
    match = file_pattern.search(response_text)
    if match:
        return match.group(1).rstrip('\n')
    code_pattern = re.compile(r'```\w*\n(.*?)```', re.DOTALL)
    match = code_pattern.search(response_text)
    if match:
        return match.group(1).rstrip('\n')
    return original_content


def build_result_zip(original_zip_bytes, updated_text_files, deleted_paths=None):
    deleted = set(deleted_paths or ())
    result_buffer = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original_zip_bytes), 'r') as original_zf:
        with zipfile.ZipFile(result_buffer, 'w', zipfile.ZIP_DEFLATED) as result_zf:
            processed = set()
            for info in original_zf.infolist():
                if info.is_dir():
                    result_zf.writestr(info, '')
                    continue
                if info.filename in deleted:
                    processed.add(info.filename)
                    continue
                if info.filename in updated_text_files:
                    result_zf.writestr(info.filename, updated_text_files[info.filename].encode('utf-8'))
                    processed.add(info.filename)
                else:
                    result_zf.writestr(info, original_zf.read(info.filename))
            for filepath, content in updated_text_files.items():
                if filepath not in processed:
                    result_zf.writestr(filepath, content.encode('utf-8'))
    return result_buffer.getvalue()


def call_openrouter(model, prompt_text, on_partial=None, soft_deadline=None):
    """Запрашивает модель в потоковом режиме.

    Ответ приходит частями, поэтому соединение не простаивает и шлюз не рвёт его
    по таймауту бездействия. Куски склеиваются в единый текст — результат
    полностью совпадает с обычным (непотоковым) ответом.

    on_partial — колбэк, которому раз в PARTIAL_SAVE_SEC отдаётся накопленный
    текст: так уже написанное переживёт обрыв функции.
    soft_deadline — момент (time.time()), после которого поток обрывается
    аккуратно: возвращаем написанное с пометкой incomplete, чтобы дописать
    следующим запуском, а не потерять всё по таймауту облака.
    """
    t0 = time.time()
    response = requests.post(
        OPENROUTER_URL,
        headers={
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
        },
        json={
            'model': model,
            'messages': [{'role': 'user', 'content': prompt_text}],
            'max_tokens': 100000,
            'stream': True,
        },
        timeout=(30, 570),
        proxies=get_openrouter_proxies(),
        stream=True,
    )

    t_headers = time.time() - t0
    if response.status_code != 200:
        return None, f'OpenRouter ошибка ({response.status_code}): {response.text[:500]}', False

    # Без явной кодировки поток декодируется как latin-1 и кириллица ломается.
    response.encoding = 'utf-8'

    chunks = []
    stream_error = None
    t_first_chunk = None
    truncated = False
    last_save = time.time()

    for raw_line in response.iter_lines(decode_unicode=True):
        # Не даём облаку убить функцию на полуслове: сохраняем и выходим сами
        if soft_deadline and time.time() > soft_deadline:
            truncated = True
            break
        if on_partial and chunks and time.time() - last_save >= PARTIAL_SAVE_SEC:
            on_partial(''.join(chunks))
            last_save = time.time()
        if not raw_line:
            continue
        if raw_line.startswith(':'):
            continue
        if not raw_line.startswith('data: '):
            continue

        payload = raw_line[6:].strip()
        if payload == '[DONE]':
            break

        try:
            parsed = json.loads(payload)
        except ValueError:
            continue

        if parsed.get('error'):
            err = parsed['error']
            stream_error = err.get('message') if isinstance(err, dict) else str(err)
            # Полный текст отказа — иначе потом не разобрать, кто и почему отказал
            print(
                f'[openrouter-fail] model={model} provider={parsed.get("provider")} '
                f'err={json.dumps(err, ensure_ascii=False)[:400]}'
            )
            break

        for choice in parsed.get('choices') or []:
            piece = (choice.get('delta') or {}).get('content')
            if piece:
                if t_first_chunk is None:
                    t_first_chunk = time.time() - t0
                chunks.append(piece)

    total = time.time() - t0
    print(
        f'[timing] model={model} prompt_chars={len(prompt_text)} '
        f'headers={t_headers:.1f}s first_chunk={t_first_chunk if t_first_chunk is None else round(t_first_chunk, 1)}s '
        f'total={total:.1f}s out_chars={sum(len(c) for c in chunks)} truncated={truncated}'
    )

    ai_text = ''.join(chunks)

    if stream_error:
        # Часть текста уже написана — сохраняем её и дописываем следующим заходом
        if ai_text:
            return ai_text, None, True
        return None, f'OpenRouter ошибка: {stream_error[:500]}', False

    if not ai_text:
        print(f'[openrouter-fail] model={model} поток пуст, ни одного знака')
        return None, 'Модель не вернула ответ', False
    return ai_text, None, truncated


def call_openrouter_retrying(model, prompt_text, on_partial=None, soft_deadline=None,
                             attempts=3):
    """Повторяет запрос, если модель не написала НИ ОДНОГО знака.

    Мгновенный пустой отказ провайдера — обычно разовый сбой на его стороне.
    Как только пошёл текст, повторов нет: написанное дороже, а второй заход
    к модели — это второй платный запрос.
    """
    started = time.time()
    last_error = None
    for i in range(attempts):
        text, error, truncated = call_openrouter(
            model, prompt_text, on_partial=on_partial, soft_deadline=soft_deadline
        )
        if text or not error:
            if i:
                print(f'[openrouter-retry] успех с попытки {i + 1}')
            return text, error, truncated
        last_error = error
        # Текста нет вообще. Повторяем, только если это был мгновенный отказ
        # и в запасе достаточно времени до предела выполнения функции
        spent = time.time() - started
        no_time = soft_deadline and time.time() + 30 > soft_deadline
        if i == attempts - 1 or spent > 60 or no_time:
            break
        print(f'[openrouter-retry] попытка {i + 1} пуста ({error}), повтор')
        time.sleep(1.5 * (i + 1))
    return None, last_error, False


def sql_escape(val):
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"


def refund_lenormand(task_id):
    """Возвращает деньги пользователю за неудавшийся расклад Ленорман.
    Идемпотентно: возврат происходит только если refunded=false и cost>0."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT user_id, cost, refunded, task_type
                    FROM {DB_SCHEMA}.ai_editor_tasks WHERE id = %s""",
                (task_id,)
            )
            row = cur.fetchone()
            if not row:
                return
            user_id, cost, refunded, task_type = row
            if task_type != 'lenormand' or refunded or not cost or cost <= 0 or not user_id:
                return

            cur.execute(f'SELECT balance FROM {DB_SCHEMA}.users WHERE id = %s', (user_id,))
            brow = cur.fetchone()
            if not brow:
                return
            balance_before = float(brow[0])
            balance_after = balance_before + cost

            cur.execute(f'UPDATE {DB_SCHEMA}.users SET balance = balance + %s WHERE id = %s', (cost, user_id))
            cur.execute(
                f"""INSERT INTO {DB_SCHEMA}.balance_transactions
                   (user_id, type, amount, balance_before, balance_after, description)
                   VALUES (%s, 'refund', %s, %s, %s, %s)""",
                (user_id, cost, balance_before, balance_after, 'Возврат: Расклад Ленорман (ошибка обработки)')
            )
            cur.execute(
                f"UPDATE {DB_SCHEMA}.ai_editor_tasks SET refunded = true WHERE id = %s",
                (task_id,)
            )
        conn.commit()
        print(f'[{task_id}] Refunded {cost} for failed lenormand task')
    except Exception as e:
        print(f'[{task_id}] Refund failed: {e}')
    finally:
        conn.close()


STEP_LOCK_TIMEOUT_SEC = 300


def process_archive_step(task_id, model, prompt, archive_base64):
    """Обрабатывает ОДИН шаг архивной задачи и возвращает (done, error).

    Шаг 1 — план (какие файлы менять), далее по одному файлу за вызов.
    Каждый вызов короткий, поэтому не упирается в лимит соединения.
    """
    safe_id = str(task_id).replace("'", "''")

    zip_bytes = base64.b64decode(archive_base64)
    text_files = extract_text_files(zip_bytes)
    if not text_files:
        return True, 'Не найдено текстовых файлов в архиве'

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT plan_files, done_files, step_index, plan_summary
                    FROM {DB_SCHEMA}.ai_editor_tasks WHERE id = '{safe_id}'"""
            )
            row = cur.fetchone()
    finally:
        conn.close()

    plan_files = row[0] if row and row[0] else None
    done_files = (row[1] if row and row[1] else {}) or {}
    step_index = (row[2] if row and row[2] is not None else 0)
    plan_summary = (row[3] if row and row[3] else '') or ''

    if isinstance(plan_files, str):
        plan_files = json.loads(plan_files)
    if isinstance(done_files, str):
        done_files = json.loads(done_files)

    # --- Шаг 1: построить план ---
    if plan_files is None:
        print(f'[{task_id}] Шаг: планирование, файлов на входе={len(text_files)}')
        plan_text, error, _ = call_openrouter(model, build_plan_prompt(text_files, prompt))
        if error:
            return True, error
        plan = parse_plan_response(plan_text)
        if not plan:
            return True, 'Модель вернула некорректный план'

        targets = plan['files']
        deletes = plan['delete']
        print(f'[{task_id}] План: файлов к изменению={len(targets)}, к удалению={len(deletes)}')

        if not targets and not deletes:
            # Менять нечего — сразу отдаём исходный архив.
            result_zip = build_result_zip(zip_bytes, dict(text_files))
            save_archive_result(
                task_id, model,
                plan['summary'] or 'Изменения не потребовались',
                result_zip, len(text_files),
            )
            return True, None

        payload = {'targets': targets, 'delete': deletes}
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                        SET plan_files = {sql_escape(json.dumps(payload, ensure_ascii=False))}::jsonb,
                            plan_summary = {sql_escape(plan['summary'])},
                            done_files = '{{}}'::jsonb,
                            step_index = 0,
                            step_lock = NULL,
                            updated_at = '{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}'
                        WHERE id = '{safe_id}'"""
                )
            conn.commit()
        finally:
            conn.close()
        return False, None

    # --- Шаг 2..N: по одному файлу ---
    targets = plan_files.get('targets') or []
    deletes = plan_files.get('delete') or []

    if step_index < len(targets):
        target = targets[step_index]
        path = target.get('path')
        print(f'[{task_id}] Шаг {step_index + 1}/{len(targets)}: файл {path}')

        prompt_text = build_step_file_prompt(
            text_files, prompt, path, target.get('what') or '', plan_summary
        )
        ai_text, error, _ = call_openrouter(model, prompt_text)
        if error:
            return True, error

        content = parse_single_file_response(ai_text, path, text_files.get(path, ''))
        done_files[path] = content

        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                        SET done_files = {sql_escape(json.dumps(done_files, ensure_ascii=False))}::jsonb,
                            step_index = {step_index + 1},
                            step_lock = NULL,
                            updated_at = '{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}'
                        WHERE id = '{safe_id}'"""
                )
            conn.commit()
        finally:
            conn.close()
        return False, None

    # --- Финал: собрать архив ---
    print(f'[{task_id}] Сборка архива: изменено файлов={len(done_files)}')
    updated_files = dict(text_files)
    updated_files.update(done_files)
    for path in deletes:
        updated_files.pop(path, None)

    result_zip = build_result_zip(zip_bytes, updated_files, deletes)

    lines = [plan_summary] if plan_summary else []
    if done_files:
        lines.append('\nИзменённые файлы:')
        lines += [f'- {p}' for p in sorted(done_files.keys())]
    if deletes:
        lines.append('\nУдалённые файлы:')
        lines += [f'- {p}' for p in deletes]

    save_archive_result(task_id, model, '\n'.join(lines), result_zip, len(text_files))
    return True, None


def save_archive_result(task_id, model, summary_text, result_zip, files_count):
    safe_id = str(task_id).replace("'", "''")
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    result_b64 = base64.b64encode(result_zip).decode('utf-8')
    summary_b64 = base64.b64encode(summary_text.encode('utf-8')).decode('ascii')

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                    SET status = 'completed',
                        ai_response = {sql_escape(summary_b64)},
                        result_archive_base64 = {sql_escape(result_b64)},
                        files_count = {int(files_count)},
                        model_used = {sql_escape(model)},
                        step_lock = NULL,
                        updated_at = '{now}'
                    WHERE id = '{safe_id}'"""
            )
        conn.commit()
    finally:
        conn.close()


def fail_task(task_id, error):
    safe_id = str(task_id).replace("'", "''")
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                    SET status = 'failed', error_message = {sql_escape(str(error)[:1000])},
                        step_lock = NULL, updated_at = '{now}'
                    WHERE id = '{safe_id}'"""
            )
        conn.commit()
    finally:
        conn.close()


def is_archive_task(task_id):
    """True только для незавершённых архивных задач (chat/lenormand сюда не попадают)."""
    safe_id = str(task_id).replace("'", "''")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT mode, status FROM {DB_SCHEMA}.ai_editor_tasks
                    WHERE id = '{safe_id}'"""
            )
            row = cur.fetchone()
    except Exception:
        return False
    finally:
        conn.close()
    if not row:
        return False
    return row[0] == 'archive' and row[1] in ('pending', 'processing')


def process_archive_task(task_id):
    """Берёт архивную задачу под замок и выполняет один шаг."""
    safe_id = str(task_id).replace("'", "''")
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                    SET status = 'processing', step_lock = '{now}', updated_at = '{now}'
                    WHERE id = '{safe_id}'
                      AND status IN ('pending', 'processing')
                      AND (step_lock IS NULL
                           OR step_lock < NOW() - INTERVAL '{STEP_LOCK_TIMEOUT_SEC} seconds')
                    RETURNING model, prompt, archive_base64"""
            )
            row = cur.fetchone()
            if not row:
                return
        conn.commit()
    finally:
        conn.close()

    model, prompt, archive_base64 = row

    try:
        done, error = process_archive_step(task_id, model, prompt, archive_base64)
    except Exception as e:
        done, error = True, str(e)[:1000]

    if error:
        print(f'[{task_id}] Ошибка шага: {error}')
        fail_task(task_id, error)


def build_continue_prompt(original_prompt, done_text):
    """Просит модель дописать оборванный ответ ровно с места разрыва.

    Хвост уже написанного отдаём целиком (последние 4000 знаков), чтобы модель
    подхватила мысль и не начала пересказывать сначала.
    """
    tail = done_text[-4000:]
    return (
        f'{original_prompt}\n\n'
        '=== ВАЖНО ===\n'
        'Ты уже начал писать этот ответ, но он оборвался на середине. '
        'Ниже — КОНЕЦ уже написанного текста. Продолжи ровно с того места, '
        'где он обрывается: не здоровайся заново, не повторяй написанное, '
        'не пересказывай начало и не пиши вступление. Просто продолжи фразу '
        'и доведи ответ до конца.\n\n'
        f'=== КОНЕЦ УЖЕ НАПИСАННОГО ===\n{tail}\n=== ПРОДОЛЖИ ОТСЮДА ==='
    )


def save_partial(task_id, text, bump=False):
    """Складывает уже написанный кусок в БД, чтобы он пережил обрыв функции.
    Заодно обновляет stream_lock — признак того, что воркер жив."""
    safe_id = str(task_id).replace("'", "''")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                    SET partial_text = {sql_escape(text)},
                        stream_lock = NOW(),
                        resume_count = resume_count + {1 if bump else 0},
                        updated_at = NOW()
                    WHERE id = '{safe_id}'"""
            )
        conn.commit()
    except Exception as e:
        print(f'[{task_id}] partial save (non-critical): {e}')
    finally:
        conn.close()


def trigger_self(task_id):
    """Пинает воркер, чтобы он дописал оборванный ответ. Ответ не ждём:
    если пинг не дойдёт, следующий опрос статуса всё равно продолжит работу."""
    try:
        import urllib.request
        url = 'https://functions.poehali.dev/d3e4e0ce-9999-45d3-82b4-15d3eeb45425'
        req = urllib.request.Request(f'{url}?task_id={task_id}', method='GET')
        urllib.request.urlopen(req, timeout=2)
    except Exception as e:
        print(f'[{task_id}] self trigger (non-critical): {e}')


def process_task(task_id):
    task_started = time.time()
    safe_id = str(task_id).replace("'", "''")
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Берём задачу под замок. Живой воркер обновляет stream_lock каждые
            # PARTIAL_SAVE_SEC, поэтому «протухший» замок = функция оборвалась,
            # и длинный ответ можно дописать с места обрыва.
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                    SET status = 'processing', updated_at = '{now}', stream_lock = NOW()
                    WHERE id = '{safe_id}'
                      AND (status = 'pending'
                           OR (mode = 'chat' AND status = 'processing'
                               AND resume_count < {MAX_RESUMES}
                               AND (stream_lock IS NULL
                                    OR stream_lock < NOW() - INTERVAL '60 seconds')))
                    RETURNING id, mode, model, prompt, filename, file_content, archive_base64,
                              partial_text, resume_count"""
            )
            row = cur.fetchone()
            if not row:
                print(f'Task {task_id} not found or already processing')
                return
        conn.commit()
    finally:
        conn.close()

    (_, mode, model, prompt, filename, file_content, archive_base64,
     partial_text, resume_count) = row
    print(f'[{task_id}] Задача загружена: mode={mode}, model={model}, archive_size={len(archive_base64) if archive_base64 else 0}')

    ai_text = None
    result_file_content = None
    result_archive_base64 = None
    files_count = None
    error = None

    try:
        if mode == 'chat':
            done_before = partial_text or ''
            # Продолжаем с места обрыва: модель видит начало и дописывает хвост
            ask = prompt if not done_before else build_continue_prompt(prompt, done_before)
            print(f'[{task_id}] Отправляю в OpenRouter (chat), уже написано={len(done_before)}, попытка={resume_count}...')

            new_text, error, truncated = call_openrouter_retrying(
                model,
                ask,
                on_partial=lambda txt: save_partial(task_id, done_before + txt),
                soft_deadline=task_started + SOFT_DEADLINE_SEC,
            )
            print(f'[{task_id}] OpenRouter ответил: error={error}, len={len(new_text) if new_text else 0}, truncated={truncated}')

            if new_text:
                ai_text = done_before + new_text

            # Связь оборвалась, но начало уже написано — не теряем его,
            # дописываем следующим заходом вместо возврата денег
            if error and done_before:
                error = None
                ai_text = done_before
                truncated = True

            # Дописали не всё — сохраняем черновик и просим себя же продолжить.
            # Если попытки исчерпаны, отдаём человеку то, что есть: почти
            # полный расклад лучше, чем ошибка и возврат денег.
            if truncated and ai_text:
                if resume_count + 1 < MAX_RESUMES:
                    save_partial(task_id, ai_text, bump=True)
                    print(f'[{task_id}] Сохранено {len(ai_text)} знаков, продолжу следующим заходом')
                    trigger_self(task_id)
                    return
                print(f'[{task_id}] Лимит продолжений исчерпан, отдаю {len(ai_text)} знаков')

        elif mode == 'file':
            prompt_text = build_file_prompt(filename or 'file.txt', file_content or '', prompt)
            print(f'[{task_id}] Отправляю в OpenRouter (file), prompt_len={len(prompt_text)}...')
            ai_text, error, _ = call_openrouter_retrying(model, prompt_text)
            print(f'[{task_id}] OpenRouter ответил: error={error}, len={len(ai_text) if ai_text else 0}')
            if ai_text:
                result_file_content = parse_single_file_response(ai_text, filename or 'file.txt', file_content or '')

        elif mode == 'archive':
            print(f'[{task_id}] Распаковка архива...')
            zip_bytes = base64.b64decode(archive_base64)
            text_files = extract_text_files(zip_bytes)
            print(f'[{task_id}] Извлечено файлов: {len(text_files)}, общий размер: {sum(len(v) for v in text_files.values())} символов')
            if not text_files:
                error = 'Не найдено текстовых файлов в архиве'
            else:
                prompt_text = build_archive_prompt(text_files, prompt)
                print(f'[{task_id}] Отправляю в OpenRouter (archive), prompt_len={len(prompt_text)}...')
                ai_text, error, _ = call_openrouter_retrying(model, prompt_text)
                print(f'[{task_id}] OpenRouter ответил: error={error}, len={len(ai_text) if ai_text else 0}')
                if ai_text:
                    updated_files = parse_ai_response(ai_text, text_files)
                    result_zip = build_result_zip(zip_bytes, updated_files)
                    result_archive_base64 = base64.b64encode(result_zip).decode('utf-8')
                    files_count = len(text_files)
    except Exception as e:
        error = str(e)[:1000]

    conn2 = get_db_connection()
    _is_lenormand = False
    try:
        now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        with conn2.cursor() as cur:
            if error:
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                        SET status = 'failed', error_message = {sql_escape(error)}, updated_at = '{now}'
                        WHERE id = '{safe_id}'"""
                )
                cur.execute(
                    f"SELECT task_type FROM {DB_SCHEMA}.ai_editor_tasks WHERE id = '{safe_id}'"
                )
                _tt = cur.fetchone()
                _is_lenormand = bool(_tt and _tt[0] == 'lenormand')
            else:
                ai_response_b64 = base64.b64encode(ai_text.encode('utf-8')).decode('ascii') if ai_text else None
                result_file_b64 = base64.b64encode(result_file_content.encode('utf-8')).decode('ascii') if result_file_content else None
                files_count_sql = str(int(files_count)) if files_count is not None else 'NULL'
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                        SET status = 'completed', partial_text = NULL, stream_lock = NULL,
                            ai_response = {sql_escape(ai_response_b64)},
                            result_file_content = {sql_escape(result_file_b64)},
                            result_archive_base64 = {sql_escape(result_archive_base64)},
                            files_count = {files_count_sql}, model_used = {sql_escape(model)}, updated_at = '{now}'
                        WHERE id = '{safe_id}'"""
                )
        conn2.commit()
        print(
            f'Task {task_id} finished: {"failed" if error else "completed"} '
            f'[timing] mode={mode} model={model} total={time.time() - task_started:.1f}s'
        )
    except Exception as e:
        print(f'Task {task_id} save error: {e}')
    finally:
        conn2.close()

    if error and _is_lenormand:
        refund_lenormand(task_id)


def handler(event, context):
    """Worker: обрабатывает задачу AI-редактирования из БД."""

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    params = event.get('queryStringParameters') or {}
    task_id = params.get('task_id', '')

    if not task_id:
        return {'statusCode': 400, 'headers': cors_headers, 'body': json.dumps({'error': 'task_id required'})}

    if is_archive_task(task_id):
        process_archive_task(task_id)
    else:
        process_task(task_id)

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps({'ok': True, 'task_id': task_id}),
    }