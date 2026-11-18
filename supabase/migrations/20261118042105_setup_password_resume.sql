CREATE FUNCTION public.account_setup_password_set() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND coalesce(encrypted_password,'')<>'')
$$;
REVOKE ALL ON FUNCTION public.account_setup_password_set() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_setup_password_set() TO authenticated;
