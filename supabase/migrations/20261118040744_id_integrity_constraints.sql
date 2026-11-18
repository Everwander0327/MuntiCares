-- No data removal or cascading Auth deletion.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.medical_histories WHERE patient_id IS NOT NULL GROUP BY patient_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Resolve duplicate medical histories before applying'; END IF;
 IF EXISTS (SELECT 1 FROM public.users u WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id=u.id)) THEN RAISE EXCEPTION 'Resolve orphan profiles before applying'; END IF;
END $$;
ALTER TABLE public.medical_histories ADD CONSTRAINT medical_histories_patient_id_key UNIQUE (patient_id);
ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE NO ACTION NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_auth_user_id_fkey;
