# Replicate Async Processing Setup

## Архитектура (ИСПРАВЛЕНО)

Система теперь состоит из 4 функций:

1. **replicate-async-start** - Создаёт задачу, возвращает task_id, триггерит worker
2. **replicate-async-worker** - Запускает prediction (НЕ ждёт результата, возвращается за 1-2 сек)
3. **replicate-prediction-checker** - Проверяет статусы predictions, продолжает цепочки
4. **replicate-async-status** - Возвращает статус задачи для frontend

## Как это работает

**Пример: пользователь добавляет 3 вещи**

1. Frontend → `start` → создаёт задачу → task_id
2. `start` триггерит `worker`
3. `worker` запускает prediction для вещи #1 → сохраняет prediction_id → возвращается (1-2 сек)
4. **Checker** (каждые 30-60 сек) проверяет prediction:
   - Готова? → Запускает вещь #2 (current_step: 2/3)
   - Ошибка? → Помечает failed
   - Последняя готова? → Помечает completed
5. Frontend проверяет статус каждые 3 секунды
6. Когда completed → показывает результат

## ⚠️ КРИТИЧНО: Настройте Checker!

**Без периодического вызова checker цепочки не будут продолжаться!**

### Вариант 1: UptimeRobot (рекомендуется)

Создайте 2 монитора на https://uptimerobot.com:

**Монитор 1: Worker** (обрабатывает pending)
- URL: `https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e`
- Interval: 1 minute

**Монитор 2: Checker** (проверяет predictions)
- URL: `https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d`
- Interval: 1 minute

### Вариант 2: Cron-job.org

Создайте 2 задачи на https://cron-job.org:

1. Worker → Every 1 minute
2. Checker → Every 30 seconds (важнее!)

### Вариант 3: GitHub Actions

`.github/workflows/replicate-cron.yml`:

```yaml
name: Replicate Cron

on:
  schedule:
    - cron: '*/1 * * * *'
  workflow_dispatch:

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e
          sleep 10
          curl https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d
```

## Тестирование прямо сейчас

```bash
# 1. Создайте задачу через frontend (2-3 вещи)

# 2. Проверьте что worker запустился
curl https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e
# Должен вернуть: {"task_id": "...", "prediction_id": "...", "step": "1/3"}

# 3. Подождите 30-60 секунд (Replicate генерирует)

# 4. Вызовите checker
curl https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d
# Должен вернуть: {"message": "Checked 1 predictions", "checked": 1}

# 5. Повторяйте шаг 4 каждые 30-60 сек пока не увидите completed
```

## SQL для мониторинга

```sql
-- Текущие задачи
SELECT id, status, current_step, total_steps, 
       ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at))) as sec_ago
FROM replicate_tasks 
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC;

-- Сброс зависших (> 10 минут)
UPDATE replicate_tasks
SET status = 'pending', prediction_id = NULL, current_step = 0
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

## URLs

- Start: https://functions.poehali.dev/c1cb3f04-f40a-4044-87fd-568d0271e1fe
- Worker: https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e
- **Checker**: https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d ⚠️
- Status: https://functions.poehali.dev/cde034e8-99be-4910-9ea6-f06cc94a6377

## Почему так сложно?

Cloud Functions имеют лимит **30 секунд**, а Replicate генерация занимает **1-3 минуты**. Поэтому:

1. Worker **запускает** prediction (1 сек) и выходит
2. Checker **проверяет** статус каждые 30-60 сек
3. Каждый вызов < 5 сек = укладывается в лимит ✅

Старая версия пыталась ждать результат внутри worker → timeout 30 сек ❌
