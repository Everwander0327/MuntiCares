CREATE TABLE public.account_setup_completions (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_setup_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_setup_completions FROM anon,authenticated;
GRANT ALL ON public.account_setup_completions TO service_role;
CREATE FUNCTION public.account_setup_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND coalesce(u.encrypted_password,'')<>'' AND u.email_confirmed_at IS NOT NULL AND (
 coalesce(u.raw_app_meta_data->>'provider','email')<>'google' OR EXISTS(SELECT 1 FROM public.account_setup_completions c WHERE c.user_id=u.id)))
$$;
REVOKE ALL ON FUNCTION public.account_setup_ready() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_setup_ready() TO authenticated;
CREATE FUNCTION public.complete_google_account_setup(target_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=target_user AND email_confirmed_at IS NOT NULL AND coalesce(encrypted_password,'')<>'') THEN RAISE EXCEPTION 'Password and verified email required'; END IF;
 INSERT INTO public.account_setup_completions(user_id) VALUES(target_user) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.complete_google_account_setup(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_google_account_setup(uuid) TO service_role;
