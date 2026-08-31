-- Исправляем ошибочно засчитанные траты бонусов.
-- Раньше в расчёт попадали списания, сделанные ДО начисления бонуса,
-- из-за чего свежий подарок сразу показывался израсходованным.
-- Пересчитываем: учитываем только траты после даты начисления.
UPDATE t_p29007832_virtual_fitting_room.bonus_grants g
   SET spent = LEAST(
        g.amount - g.burned,
        COALESCE((
            SELECT SUM(-bt.amount)
              FROM t_p29007832_virtual_fitting_room.balance_transactions bt
             WHERE bt.user_id = g.user_id
               AND bt.type = 'charge'
               AND bt.amount < 0
               AND bt.description <> 'Сгорание бонусных рублей'
               AND bt.created_at >= g.created_at
        ), 0)
   ),
   updated_at = CURRENT_TIMESTAMP
 WHERE g.status IN ('active', 'expired');
