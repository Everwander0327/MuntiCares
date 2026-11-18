CREATE TABLE public.account_role_choices (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('patient','provider','admin')),
 selected_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_role_choices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_role_choices FROM anon,authenticated;
GRANT ALL ON public.account_role_choices TO service_role;
-- Existing accounts retain their role and are never asked to select it again.
INSERT INTO public.account_role_choices(user_id,role) SELECT u.id,u.role FROM public.users u JOIN auth.users a ON a.id=u.id;
CREATE FUNCTION public.account_role_selected() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.account_role_choices WHERE user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION public.account_role_selected() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_role_selected() TO authenticated;
CREATE FUNCTION public.choose_first_account_role(target_user uuid, chosen_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous text; BEGIN
 IF chosen_role NOT IN ('patient','provider') THEN RAISE EXCEPTION 'Choose patient or provider'; END IF;
 PERFORM 1 FROM public.users WHERE id=target_user AND role<>'admin' AND NOT coalesce(is_banned,false) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 SELECT role INTO previous FROM public.account_role_choices WHERE user_id=target_user;
 IF previous IS NOT NULL THEN
   IF previous=chosen_role THEN RETURN; END IF;
   RAISE EXCEPTION 'Account role has already been selected';
 END IF;
 IF EXISTS(SELECT 1 FROM public.requests WHERE patient_id=target_user OR provider_id=target_user)
 OR EXISTS(SELECT 1 FROM public.medical_histories WHERE patient_id=target_user)
 OR EXISTS(SELECT 1 FROM public.patients WHERE user_id=target_user AND is_profile_complete)
 OR EXISTS(SELECT 1 FROM public.providers WHERE user_id=target_user AND is_profile_complete)
 THEN RAISE EXCEPTION 'Existing account roles cannot be changed during setup'; END IF;
 IF chosen_role='provider' THEN
   INSERT INTO public.providers(user_id) VALUES(target_user) ON CONFLICT(user_id) DO NOTHING;
 ELSE
   INSERT INTO public.patients(user_id) VALUES(target_user) ON CONFLICT(user_id) DO NOTHING;
 END IF;
 UPDATE public.users SET role=chosen_role WHERE id=target_user;
 INSERT INTO public.account_role_choices(user_id,role) VALUES(target_user,chosen_role);
END $$;
REVOKE ALL ON FUNCTION public.choose_first_account_role(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.choose_first_account_role(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.account_setup_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND coalesce(u.encrypted_password,'')<>'' AND u.email_confirmed_at IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.account_role_choices r WHERE r.user_id=u.id)
 AND (coalesce(u.raw_app_meta_data->>'provider','email')<>'google' OR EXISTS(SELECT 1 FROM public.account_setup_completions c WHERE c.user_id=u.id)))
$$;
