ALTER TABLE t_p29007832_virtual_fitting_room.outfit_profiles
    ALTER COLUMN user_id TYPE UUID USING (NULL::uuid);

ALTER TABLE t_p29007832_virtual_fitting_room.outfit_profiles
    ADD CONSTRAINT fk_outfit_profiles_user
    FOREIGN KEY (user_id)
    REFERENCES t_p29007832_virtual_fitting_room.users(id);