# Replicate Async Processing Setup

## Архитектура

Система асинхронной обработки Replicate состоит из 3 функций:

1. **replicate-async-start** - Создаёт задачу в БД и возвращает task_id мгновенно
2. **replicate-async-worker** - Обрабатывает ОДНУ задачу из очереди (pending → processing → completed/failed)
3. **replicate-async-status** - Проверяет статус задачи по task_id

## Как это работает

1. Пользователь нажимает "Создать образ"
2. Frontend вызывает `replicate-async-start` → получает task_id
3. `replicate-async-start` автоматически триггерит worker один раз
4. Worker берёт первую pending задачу и обрабатывает её (может занять 1-5 минут)
5. Frontend каждые 3 секунды проверяет статус через `replicate-async-status`
6. Когда статус = 'completed', показывается результат

## Важно: Worker Monitoring

Worker нужно вызывать периодически, чтобы обрабатывать очередь задач.

### Вариант 1: UptimeRobot (бесплатный)

1. Зарегистрируйтесь на https://uptimerobot.com
2. Создайте новый монитор:
   - Type: HTTP(s)
   - URL: `https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e`
   - Monitoring Interval: 1 minute (бесплатно)
   - Alert When: не важно (нам нужны только запросы)

### Вариант 2: Cron-job.org (бесплатный)

1. Зарегистрируйтесь на https://cron-job.org
2. Создайте задачу:
   - URL: `https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e`
   - Interval: Every 30 seconds (бесплатно)

### Вариант 3: GitHub Actions (бесплатный)

Создайте `.github/workflows/replicate-worker.yml`:

```yaml
name: Replicate Worker Cron

on:
  schedule:
    - cron: '*/5 * * * *'  # Каждые 5 минут
  workflow_dispatch:  # Ручной запуск

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Worker
        run: |
          curl -X GET https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e
```

## Таблица БД

```sql
CREATE TABLE replicate_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    person_image TEXT NOT NULL,
    garments TEXT NOT NULL,
    prompt_hints TEXT,
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

## Тестирование

1. Создайте задачу через frontend
2. Проверьте что worker вызывается автоматически (один раз)
3. Если задач много, настройте мониторинг выше для регулярных вызовов
4. Worker обрабатывает по 1 задаче за вызов

## URLs

- Start: https://functions.poehali.dev/c1cb3f04-f40a-4044-87fd-568d0271e1fe
- Worker: https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e
- Status: https://functions.poehali.dev/cde034e8-99be-4910-9ea6-f06cc94a6377
