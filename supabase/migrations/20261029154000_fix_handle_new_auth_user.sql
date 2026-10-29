-- Fix user creation error in public.handle_new_auth_user()
-- 1. public.patients does not have a full_name column (full_name is stored on public.users).
-- 2. Clean up any orphaned public.users row with the same email before inserting so re-registration never conflicts on users_email_key.
-- 3. Allow authenticated UPDATE on (full_name, avatar_url, is_banned, email) on public.users; non-admins remain blocked from modifying privileged columns via trg_protect_users_privileges.

GRANT UPDATE (full_name, avatar_url, is_banned, email) ON public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  assigned_role text;
  assigned_name text;
BEGIN
  assigned_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'patient');

  -- Disallow arbitrary or 'admin' roles at signup. Must be either 'patient' or 'provider'.
  IF assigned_role NOT IN ('patient', 'provider') THEN
    assigned_role := 'patient';
  END IF;

  -- Clean up any orphaned public.users row with the same email that no longer exists in auth.users
  DELETE FROM public.users u
  WHERE lower(u.email) = lower(new.email)
    AND u.id <> new.id
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

  INSERT INTO public.users (id, email, full_name, role, password, is_banned, created_at)
  VALUES (new.id, new.email, assigned_name, assigned_role, '', false, now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    -- Preserve existing role on conflict to prevent re-signup escalation
    role = public.users.role;

  IF assigned_role = 'provider' THEN
    INSERT INTO public.providers (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.patients (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

