-- 1. Шаги, брошенные в обработке дольше 5 минут, помечаем неудачными.
--    Функция живёт максимум 2 минуты, так что живых среди них нет.
UPDATE t_p29007832_virtual_fitting_room.divination_dialog_steps
   SET status = 'failed', updated_at = NOW()
 WHERE status IN ('pending', 'processing')
   AND updated_at < NOW() - INTERVAL '5 minutes';

-- 2. Перенумеровываем состоявшиеся ответы подряд, по времени создания.
--    Меняется только номер: тексты, карты и порядок беседы прежние.
WITH ordered AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY dialog_id ORDER BY created_at) AS n
      FROM t_p29007832_virtual_fitting_room.divination_dialog_steps
     WHERE status = 'done'
)
UPDATE t_p29007832_virtual_fitting_room.divination_dialog_steps s
   SET step_no = ordered.n
  FROM ordered
 WHERE s.id = ordered.id AND s.step_no <> ordered.n;

-- 3. Счётчик диалога приводим к числу полученных ответов.
UPDATE t_p29007832_virtual_fitting_room.divination_dialogs d
   SET steps_count = (
           SELECT COUNT(*)
             FROM t_p29007832_virtual_fitting_room.divination_dialog_steps s
            WHERE s.dialog_id = d.id AND s.status = 'done'
       ),
       updated_at = NOW()
 WHERE d.steps_count <> (
           SELECT COUNT(*)
             FROM t_p29007832_virtual_fitting_room.divination_dialog_steps s
            WHERE s.dialog_id = d.id AND s.status = 'done'
       );