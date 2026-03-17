"""AI-редактор кода: принимает ZIP-архив и промпт, отправляет в Claude через OpenRouter, возвращает отредактированный архив."""

import json
import os
import base64
import zipfile
import io
import re
import requests

ALLOWED_EMAIL = "apollinaria-b@yandex.ru"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

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


def is_text_file(filename):
    name_lower = filename.lower()
    _, ext = os.path.splitext(name_lower)
    if ext in TEXT_EXTENSIONS:
        return True
    basename = os.path.basename(name_lower)
    if basename in {'makefile', 'dockerfile', 'procfile', 'gemfile', 'rakefile', 'license', 'readme'}:
        return True
    return False


def should_skip_path(filepath):
    parts = filepath.replace('\\', '/').split('/')
    for part in parts:
        if part in SKIP_DIRS:
            return True
    return False


def extract_text_files(zip_bytes):
    files = {}
    total_size = 0

    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            if should_skip_path(info.filename):
                continue
            if not is_text_file(info.filename):
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


def build_prompt(files, user_prompt):
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


def parse_ai_response(response_text, original_files):
    updated_files = dict(original_files)
    
    file_pattern = re.compile(r'```file:(.+?)\n(.*?)```', re.DOTALL)
    matches = file_pattern.findall(response_text)
    
    for filepath, content in matches:
        filepath = filepath.strip()
        updated_files[filepath] = content.rstrip('\n')

    delete_pattern = re.compile(r'DELETE:(.+?)(?:\n|$)')
    deletes = delete_pattern.findall(response_text)
    for filepath in deletes:
        filepath = filepath.strip()
        updated_files.pop(filepath, None)

    return updated_files


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


def handler(event, context):
    """AI-редактор кода: принимает ZIP-архив и промпт, возвращает отредактированный архив."""
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {
            'statusCode': 405,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Method not allowed'}),
        }

    raw_body = event.get('body') or '{}'
    body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    archive_b64 = body.get('archive_base64', '')
    user_prompt = body.get('prompt', '')
    model = body.get('model', 'anthropic/claude-sonnet-4')

    if not archive_b64 or not user_prompt:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Нужен архив и промпт'}),
        }

    allowed_models = {
        'anthropic/claude-sonnet-4',
        'anthropic/claude-opus-4',
    }
    if model not in allowed_models:
        model = 'anthropic/claude-sonnet-4'

    zip_bytes = base64.b64decode(archive_b64)

    text_files = extract_text_files(zip_bytes)
    if not text_files:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Не найдено текстовых файлов в архиве'}),
        }

    prompt = build_prompt(text_files, user_prompt)

    response = requests.post(
        OPENROUTER_URL,
        headers={
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': model,
            'messages': [
                {'role': 'user', 'content': prompt},
            ],
            'max_tokens': 64000,
        },
        timeout=300,
    )

    if response.status_code != 200:
        error_text = response.text[:500]
        return {
            'statusCode': 502,
            'headers': cors_headers,
            'body': json.dumps({'error': f'OpenRouter ошибка: {error_text}'}),
        }

    result = response.json()
    ai_text = result.get('choices', [{}])[0].get('message', {}).get('content', '')

    if not ai_text:
        return {
            'statusCode': 502,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Модель не вернула ответ'}),
        }

    updated_files = parse_ai_response(ai_text, text_files)
    result_zip = build_result_zip(zip_bytes, updated_files)
    result_b64 = base64.b64encode(result_zip).decode('utf-8')

    return {
        'statusCode': 200,
        'headers': cors_headers,
        'body': json.dumps({
            'ai_response': ai_text,
            'result_archive_base64': result_b64,
            'files_count': len(text_files),
            'model_used': model,
        }),
    }