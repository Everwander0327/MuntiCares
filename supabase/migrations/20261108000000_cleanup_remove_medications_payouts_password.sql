-- ============================================================
-- Migration: Cleanup — remove medications, payouts, payment
-- ============================================================
-- User-approved cleanup (2026-11-08):
--   - public.medications was never used by the app (patient meds live
--     on medical_histories.medications) and had RLS disabled.
--   - public.payouts + requests.payment_status were leftovers from the
--     removed payments feature (see 20261027000000_remove_payment_and_money).
--   - public.users.password was a legacy plaintext column; Supabase Auth
--     owns credentials. handle_new_auth_user no longer writes it.
-- Applied manually on prod via SQL API on 2026-11-08 and recorded in
-- supabase_migrations.schema_migrations. Idempotent (IF EXISTS).

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

  INSERT INTO public.users (id, email, full_name, role, is_banned, created_at)
  VALUES (new.id, new.email, assigned_name, assigned_role, false, now())
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

DROP TABLE IF EXISTS public.medications;
DROP TABLE IF EXISTS public.payouts;
ALTER TABLE public.requests DROP COLUMN IF EXISTS payment_status;
ALTER TABLE public.users DROP COLUMN IF EXISTS password;
