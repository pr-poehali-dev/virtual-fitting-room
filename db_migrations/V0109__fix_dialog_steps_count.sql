-- Счётчик шагов диалога должен равняться числу полученных ответов.
-- Раньше в него попадал номер последнего шага, поэтому сорванные
-- попытки навсегда съедали лимит вопросов у человека.
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