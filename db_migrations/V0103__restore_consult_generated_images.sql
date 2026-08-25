-- Восстановление связок картинок с консультациями: прикрепление сорвалось
-- из-за ошибки в запросе воркера, сами задачи генерации связку сохранили.
UPDATE t_p29007832_virtual_fitting_room.color_guide_tasks c
SET result_json = jsonb_set(
        COALESCE(c.result_json, '{}'::jsonb),
        '{generated_images}',
        (
            SELECT COALESCE(jsonb_agg(f.result_url ORDER BY f.created_at), '[]'::jsonb)
            FROM t_p29007832_virtual_fitting_room.freegen_tasks f
            WHERE f.consult_task_id = c.id
              AND f.status = 'completed'
              AND f.result_url IS NOT NULL
        ),
        true
    ),
    cdn_url = (
        SELECT f.result_url
        FROM t_p29007832_virtual_fitting_room.freegen_tasks f
        WHERE f.consult_task_id = c.id
          AND f.status = 'completed'
          AND f.result_url IS NOT NULL
        ORDER BY f.created_at DESC
        LIMIT 1
    )
WHERE c.service_type = 'consult'
  AND c.result_json->'generated_images' IS NULL
  AND EXISTS (
        SELECT 1 FROM t_p29007832_virtual_fitting_room.freegen_tasks f
        WHERE f.consult_task_id = c.id
          AND f.status = 'completed'
          AND f.result_url IS NOT NULL
  );