ALTER TABLE t_p29007832_virtual_fitting_room.color_guide_tasks
ADD COLUMN IF NOT EXISTS forced_colortype_slug character varying(50) NULL;

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.color_guide_tasks.forced_colortype_slug
IS 'Если задан — цветотип уже определён на шаге /colortype, worker не определяет его заново, а только строит гид под этот slug';