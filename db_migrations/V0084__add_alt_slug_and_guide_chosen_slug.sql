ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
ADD COLUMN IF NOT EXISTS forced_colortype_slug_alt character varying(50) NULL;

ALTER TABLE t_p29007832_virtual_fitting_room.color_type_history
ADD COLUMN IF NOT EXISTS guide_chosen_slug character varying(50) NULL;

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.color_guide_tasks.forced_colortype_slug_alt
IS 'Второй кандидат цветотипа (при расхождении ИИ и формулы). Если задан вместе с forced_colortype_slug — Gemini выбирает один из двух по фото';

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.color_type_history.guide_chosen_slug
IS 'Цветотип (slug), который Gemini утвердил во втором раунде для гида. Используется для выбора активной вкладки на странице палитры';