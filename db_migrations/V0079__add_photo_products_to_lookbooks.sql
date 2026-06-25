ALTER TABLE t_p29007832_virtual_fitting_room.lookbooks
ADD COLUMN IF NOT EXISTS photo_products jsonb NOT NULL DEFAULT '{}'::jsonb;