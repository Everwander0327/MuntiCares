-- ========================================================
-- Re-enable RLS on patient PII tables
-- ========================================================
-- 20261014230000_disable_rls_all.sql turned RLS off and granted anon ALL on
-- every table, which exposes patient phone numbers, home addresses and medical
-- history to anyone holding the public anon key.
--
-- Current state of the linked project: RLS is already enabled on both tables
-- and the policies below already exist (they were applied by hand from
-- supabase/PROD_MIGRATION_AUTH_RLS.sql). This migration therefore converges the
-- remaining gap — the anon grants — and only creates a policy when it is
-- missing, so re-running it never drops a live policy.
--
-- Scope is deliberately narrow: requests, messages and tracking tables are not
-- touched; they still need their own review before RLS is enabled there.
-- ========================================================

-- SECURITY DEFINER so the admin check does not recurse through users' RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_histories ENABLE ROW LEVEL SECURITY;

-- The anon role must never touch patient PII; signed-in users get table access
-- and are then narrowed by the policies below.
REVOKE ALL ON TABLE public.patients FROM anon;
REVOKE ALL ON TABLE public.medical_histories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.medical_histories TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'patients_select_policy'
  ) THEN
    CREATE POLICY "patients_select_policy" ON public.patients
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.requests
          WHERE requests.patient_id = patients.user_id
            AND requests.provider_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'patients_insert_own_or_admin'
  ) THEN
    CREATE POLICY "patients_insert_own_or_admin" ON public.patients
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() OR public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'patients_update_own_or_admin'
  ) THEN
    CREATE POLICY "patients_update_own_or_admin" ON public.patients
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid() OR public.is_admin())
      WITH CHECK (user_id = auth.uid() OR public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'medical_histories' AND policyname = 'medical_histories_select_policy'
  ) THEN
    CREATE POLICY "medical_histories_select_policy" ON public.medical_histories
      FOR SELECT TO authenticated
      USING (
        patient_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.consent_access
          WHERE consent_access.patient_id = medical_histories.patient_id
            AND consent_access.provider_id = auth.uid()
            AND consent_access.is_enabled = true
            AND (consent_access.permissions->>'medical_history')::boolean IS NOT FALSE
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'medical_histories' AND policyname = 'medical_histories_modify_own'
  ) THEN
    CREATE POLICY "medical_histories_modify_own" ON public.medical_histories
      FOR ALL TO authenticated
      USING (patient_id = auth.uid() OR public.is_admin())
      WITH CHECK (patient_id = auth.uid() OR public.is_admin());
  END IF;
END $$;
