"""Worker: забирает задачу из БД, вызывает OpenRouter, сохраняет результат."""

import json
import os
import base64
import zipfile
import io
import re
import requests
import psycopg2
from datetime import datetime

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DB_SCHEMA = 't_p29007832_virtual_fitting_room'

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
    return psycopg2.connect(dsn)


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
5. Перед блоками файлов кратко опиши что было сделано
"""


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

3. Перед блоком файла кратко опиши что было сделано
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


def build_result_zip(original_zip_bytes, updated_text_files):
    result_buffer = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original_zip_bytes), 'r') as original_zf:
        with zipfile.ZipFile(result_buffer, 'w', zipfile.ZIP_DEFLATED) as result_zf:
            processed = set()
            for info in original_zf.infolist():
                if info.is_dir():
                    result_zf.writestr(info, '')
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


def call_openrouter(model, prompt_text):
    response = requests.post(
        OPENROUTER_URL,
        headers={
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': model,
            'messages': [{'role': 'user', 'content': prompt_text}],
            'max_tokens': 64000,
        },
        timeout=540,
    )
    if response.status_code != 200:
        return None, f'OpenRouter ошибка ({response.status_code}): {response.text[:500]}'
    result = response.json()
    ai_text = result.get('choices', [{}])[0].get('message', {}).get('content', '')
    if not ai_text:
        return None, 'Модель не вернула ответ'
    return ai_text, None


def sql_escape(val):
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"


def process_task(task_id):
    safe_id = str(task_id).replace("'", "''")
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                    SET status = 'processing', updated_at = '{now}'
                    WHERE id = '{safe_id}' AND status = 'pending'
                    RETURNING id, mode, model, prompt, filename, file_content, archive_base64"""
            )
            row = cur.fetchone()
            if not row:
                print(f'Task {task_id} not found or already processing')
                return
        conn.commit()
    finally:
        conn.close()

    _, mode, model, prompt, filename, file_content, archive_base64 = row
    print(f'[{task_id}] Задача загружена: mode={mode}, model={model}, archive_size={len(archive_base64) if archive_base64 else 0}')

    ai_text = None
    result_file_content = None
    result_archive_base64 = None
    files_count = None
    error = None

    try:
        if mode == 'chat':
            print(f'[{task_id}] Отправляю в OpenRouter (chat)...')
            ai_text, error = call_openrouter(model, prompt)
            print(f'[{task_id}] OpenRouter ответил: error={error}, len={len(ai_text) if ai_text else 0}')

        elif mode == 'file':
            prompt_text = build_file_prompt(filename or 'file.txt', file_content or '', prompt)
            print(f'[{task_id}] Отправляю в OpenRouter (file), prompt_len={len(prompt_text)}...')
            ai_text, error = call_openrouter(model, prompt_text)
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
                ai_text, error = call_openrouter(model, prompt_text)
                print(f'[{task_id}] OpenRouter ответил: error={error}, len={len(ai_text) if ai_text else 0}')
                if ai_text:
                    updated_files = parse_ai_response(ai_text, text_files)
                    result_zip = build_result_zip(zip_bytes, updated_files)
                    result_archive_base64 = base64.b64encode(result_zip).decode('utf-8')
                    files_count = len(text_files)
    except Exception as e:
        error = str(e)[:1000]

    conn2 = get_db_connection()
    try:
        now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        with conn2.cursor() as cur:
            if error:
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                        SET status = 'failed', error_message = {sql_escape(error)}, updated_at = '{now}'
                        WHERE id = '{safe_id}'"""
                )
            else:
                ai_response_b64 = base64.b64encode(ai_text.encode('utf-8')).decode('ascii') if ai_text else None
                result_file_b64 = base64.b64encode(result_file_content.encode('utf-8')).decode('ascii') if result_file_content else None
                files_count_sql = str(int(files_count)) if files_count is not None else 'NULL'
                cur.execute(
                    f"""UPDATE {DB_SCHEMA}.ai_editor_tasks
                        SET status = 'completed', ai_response = {sql_escape(ai_response_b64)},
                            result_file_content = {sql_escape(result_file_b64)},
                            result_archive_base64 = {sql_escape(result_archive_base64)},
                            files_count = {files_count_sql}, model_used = {sql_escape(model)}, updated_at = '{now}'
                        WHERE id = '{safe_id}'"""
                )
        conn2.commit()
        print(f'Task {task_id} finished: {"failed" if error else "completed"}')
    except Exception as e:
        print(f'Task {task_id} save error: {e}')
    finally:
        conn2.close()


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

    process_task(task_id)

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps({'ok': True, 'task_id': task_id}),
    }