BEGIN;
DO $$
DECLARE fixture uuid := gen_random_uuid(); profile_id uuid; rejected boolean;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(fixture,fixture::text||'@id-test.invalid','{"full_name":"ID test","role":"patient"}','{"provider":"email"}');
 SELECT id INTO profile_id FROM public.users WHERE id=fixture;
 IF profile_id IS DISTINCT FROM fixture THEN RAISE EXCEPTION 'Signup profile ID mismatch'; END IF;
 INSERT INTO public.medical_histories(patient_id,past_surgeries) VALUES(fixture,'test');
 rejected:=false;
 BEGIN INSERT INTO public.medical_histories(patient_id,past_surgeries) VALUES(fixture,'duplicate');
 EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Duplicate patient history was allowed'; END IF;
 rejected:=false;
 BEGIN INSERT INTO public.users(id,email,full_name,role) VALUES(gen_random_uuid(),fixture::text||'-orphan@id-test.invalid','orphan','patient');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Orphan profile was allowed'; END IF;
 rejected:=false;
 BEGIN DELETE FROM auth.users WHERE id=fixture;
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Auth deletion silently removed or orphaned a profile'; END IF;
 DELETE FROM public.users WHERE id=fixture;
 DELETE FROM auth.users WHERE id=fixture;
END $$;
ROLLBACK;
SELECT 'Signup ID, unique patient history, orphan rejection and explicit deletion order passed' AS verification;
