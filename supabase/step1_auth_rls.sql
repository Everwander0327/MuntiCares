-- ========================================================
-- MuntiCares Step 1: Auth Bridge & Row Level Security (RLS)
-- Target Project: kumijiwepididcsyqchy (Experimental)
-- ========================================================

-- 1. HELPER FUNCTION: Check if authenticated user is Admin (SECURITY DEFINER prevents recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. TRIGGER: Auto-provision public.users + patient/provider record on Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  assigned_role text;
  assigned_name text;
BEGIN
  assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'patient');
  assigned_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  INSERT INTO public.users (id, email, full_name, role, is_banned, created_at)
  VALUES (new.id, new.email, assigned_name, assigned_role, false, now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    role = COALESCE(EXCLUDED.role, public.users.role);

  IF assigned_role = 'provider' THEN
    INSERT INTO public.providers (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.patients (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. BRIDGE: Populate auth.users with the 18 existing test users (Default Password: MuntiCares2026!)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  crypt('MuntiCares2026!', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  jsonb_build_object('full_name', u.full_name, 'role', u.role),
  u.created_at,
  now(),
  '',
  '',
  '',
  ''
FROM public.users u
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = now();

-- 4. BRIDGE IDENTITIES: Ensure auth.identities has matching records so login succeeds
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  now(),
  now(),
  now()
FROM public.users u
ON CONFLICT DO NOTHING;

-- ========================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS) ACROSS ALL TABLES
-- ========================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ========================================================
-- 6. POLICIES: public.users
-- ========================================================
-- Any authenticated user can view user profiles (needed to display doctor names, patient names, avatars)
CREATE POLICY "users_select_authenticated" ON public.users
  FOR SELECT TO authenticated
  USING (true);

-- User can update their own profile, or admin can update any profile
CREATE POLICY "users_update_own_or_admin" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- ========================================================
-- 7. POLICIES: public.providers
-- ========================================================
-- Authenticated users can view providers (catalog search, booking)
CREATE POLICY "providers_select_authenticated" ON public.providers
  FOR SELECT TO authenticated
  USING (true);

-- Provider can update own profile, admin can update all
CREATE POLICY "providers_update_own_or_admin" ON public.providers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Provider can insert own record
CREATE POLICY "providers_insert_own_or_admin" ON public.providers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 8. POLICIES: public.patients
-- ========================================================
-- Patient can see own profile, providers can see patient profile if they have requests together, or admin
CREATE POLICY "patients_select_policy" ON public.patients
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.requests
      WHERE requests.patient_id = patients.user_id AND requests.provider_id = auth.uid()
    )
  );

CREATE POLICY "patients_insert_own_or_admin" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "patients_update_own_or_admin" ON public.patients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 9. POLICIES: public.requests
-- ========================================================
-- Patients see their requests; Providers see assigned requests; Admin sees all
CREATE POLICY "requests_select_policy" ON public.requests
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

-- Patients or Admins can create requests
CREATE POLICY "requests_insert_policy" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid() OR public.is_admin());

-- Patients can cancel/reschedule; Providers can change status (Accept, OTW, Arrived, Complete); Admin can update all
CREATE POLICY "requests_update_policy" ON public.requests
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin())
  WITH CHECK (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 10. POLICIES: public.consent_access
-- ========================================================
CREATE POLICY "consent_select_policy" ON public.consent_access
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

CREATE POLICY "consent_insert_update_patient" ON public.consent_access
  FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.is_admin())
  WITH CHECK (patient_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 11. POLICIES: public.medical_histories
-- ========================================================
-- Patient sees own; Provider sees only if consent is granted; Admin sees all
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

CREATE POLICY "medical_histories_modify_own" ON public.medical_histories
  FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.is_admin())
  WITH CHECK (patient_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 12. POLICIES: public.visit_notes
-- ========================================================
CREATE POLICY "visit_notes_select_policy" ON public.visit_notes
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.consent_access
      WHERE consent_access.patient_id = visit_notes.patient_id
        AND consent_access.provider_id = auth.uid()
        AND consent_access.is_enabled = true
        AND (consent_access.permissions->>'visit_notes')::boolean IS NOT FALSE
    )
  );

CREATE POLICY "visit_notes_insert_provider" ON public.visit_notes
  FOR INSERT TO authenticated
  WITH CHECK (provider_id = auth.uid() OR public.is_admin());

CREATE POLICY "visit_notes_update_provider" ON public.visit_notes
  FOR UPDATE TO authenticated
  USING (provider_id = auth.uid() OR public.is_admin())
  WITH CHECK (provider_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 13. POLICIES: public.patient_documents
-- ========================================================
CREATE POLICY "documents_select_policy" ON public.patient_documents
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.consent_access
      WHERE consent_access.patient_id = patient_documents.patient_id
        AND consent_access.provider_id = auth.uid()
        AND consent_access.is_enabled = true
        AND (consent_access.permissions->>'documents')::boolean IS NOT FALSE
    )
  );

CREATE POLICY "documents_modify_own" ON public.patient_documents
  FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.is_admin())
  WITH CHECK (patient_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 14. POLICIES: public.provider_reviews
-- ========================================================
-- Everyone authenticated can read verified reviews
CREATE POLICY "reviews_select_all" ON public.provider_reviews
  FOR SELECT TO authenticated
  USING (true);

-- Patients can submit review for their completed requests
CREATE POLICY "reviews_insert_patient" ON public.provider_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.requests
      WHERE requests.id = provider_reviews.request_id
        AND requests.patient_id = auth.uid()
        AND requests.status = 'Completed'
    )
  );

-- ========================================================
-- 15. POLICIES: public.messages
-- ========================================================
CREATE POLICY "messages_select_parties" ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "messages_insert_sender" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update_receiver" ON public.messages
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

CREATE POLICY "messages_delete_parties" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ========================================================
-- 16. POLICIES: public.provider_locations
-- ========================================================
CREATE POLICY "locations_select_policy" ON public.provider_locations
  FOR SELECT TO authenticated
  USING (
    provider_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.requests
      WHERE requests.id = provider_locations.request_id
        AND requests.patient_id = auth.uid()
    )
  );

CREATE POLICY "locations_upsert_provider" ON public.provider_locations
  FOR ALL TO authenticated
  USING (provider_id = auth.uid() OR public.is_admin())
  WITH CHECK (provider_id = auth.uid() OR public.is_admin());

-- ========================================================
-- 17. POLICIES: public.announcements
-- ========================================================
CREATE POLICY "announcements_select_all" ON public.announcements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "announcements_admin_manage" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ========================================================
-- 18. POLICIES: public.transactions
-- ========================================================
CREATE POLICY "transactions_select_parties" ON public.transactions
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

CREATE POLICY "transactions_insert_update" ON public.transactions
  FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin())
  WITH CHECK (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

