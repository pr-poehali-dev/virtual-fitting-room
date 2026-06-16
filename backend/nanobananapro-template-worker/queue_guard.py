"""
Единая глобальная очередь для всех сервисов на nanobanana2.

Считает активные ("processing") задачи во ВСЕХ таблицах задач сразу,
чтобы лимит был общим на примерку + свободную генерацию + стиль-анализ
(+ будущие сервисы). Окно активности — 2 минуты (как в эталонной примерочной),
чтобы зависшие задачи не блокировали очередь навечно.

Использование в воркере перед переводом задачи pending -> processing:

    from queue_guard import count_global_active, GLOBAL_CONCURRENCY
    if count_global_active(cursor) >= GLOBAL_CONCURRENCY:
        # оставить задачу в pending, выйти со статусом queued
        ...
"""

SCHEMA = 't_p29007832_virtual_fitting_room'

# Максимум одновременно обрабатываемых генераций на ВСЕ сервисы nanobanana2.
GLOBAL_CONCURRENCY = 1

# Окно, в течение которого "processing"-задача считается активной.
ACTIVE_WINDOW = "2 minutes"


def count_global_active(cursor) -> int:
    """
    Вернуть количество активных (processing с отправленным запросом в fal.ai)
    задач суммарно по всем таблицам очереди за окно ACTIVE_WINDOW.

    Считает по трём таблицам:
      - nanobananapro_tasks (примерка / капсула / лукбук) -> fal_request_id
      - freegen_tasks (свободная генерация)               -> fal_request_id
      - color_guide_tasks (стиль-анализ / colorguide)     -> updated_at окно

    color_guide_tasks не имеет fal_request_id, поэтому для него активной
    считается processing-задача, обновлённая в пределах окна.
    """
    total = 0

    queries = [
        f'''SELECT COUNT(*) FROM {SCHEMA}.nanobananapro_tasks
            WHERE status = 'processing'
              AND fal_request_id IS NOT NULL
              AND created_at > NOW() - INTERVAL '{ACTIVE_WINDOW}' ''',
        f'''SELECT COUNT(*) FROM {SCHEMA}.freegen_tasks
            WHERE status = 'processing'
              AND fal_request_id IS NOT NULL
              AND created_at > NOW() - INTERVAL '{ACTIVE_WINDOW}' ''',
        f'''SELECT COUNT(*) FROM {SCHEMA}.color_guide_tasks
            WHERE status = 'processing'
              AND updated_at > NOW() - INTERVAL '{ACTIVE_WINDOW}' ''',
    ]

    for q in queries:
        try:
            cursor.execute(q)
            row = cursor.fetchone()
            if row and row[0]:
                total += int(row[0])
        except Exception as e:
            # Не блокируем очередь, если одна из таблиц недоступна.
            print(f'[queue_guard] count error (non-critical): {e}')

    return total
