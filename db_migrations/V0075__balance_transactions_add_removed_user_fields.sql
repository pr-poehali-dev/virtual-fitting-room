ALTER TABLE t_p29007832_virtual_fitting_room.balance_transactions
  ADD COLUMN IF NOT EXISTS removed_user_email character varying(255),
  ADD COLUMN IF NOT EXISTS removed_user_name character varying(255);