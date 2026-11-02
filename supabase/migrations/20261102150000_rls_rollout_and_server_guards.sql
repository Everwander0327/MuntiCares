-- ============================================================
-- Migration: RLS rollout + server-side role and status guards
-- ============================================================
-- 20261014230000_disable_rls_all.sql turned RLS off on 11 tables and granted
-- anon ALL on the whole public schema. Only patients and medical_histories were
-- re-protected afterwards (20261029171000). Everything still unprotected here is
-- readable and writable by anyone holding the public anon key, which is embedded
-- in the shipped web bundle.
--
-- This migration:
--   1. re-pins public.is_admin() with a search_path (20261029171000 dropped the pin)
--   2. revokes anon everywhere and narrows authenticated table privileges
--   3. enables RLS + least-privilege policies for the 9 remaining tables
--   4. adds triggers so role, approval, trust_score and appointment status can no
--      longer be forged by the account that owns the row
--
-- Deliberately NOT here: patients / medical_histories (already covered),
-- provider_locations (covered by 20261024000000 + 20261025140000).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Admin helper, with the search_path pinned again
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ------------------------------------------------------------
-- 2. Privileges: anon never touches application tables
-- ------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- New tables must not inherit the old blanket grant (Supabase default privileges
-- hand every new public table ALL to anon/authenticated).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ------------------------------------------------------------
-- 3. Enable RLS
-- ------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Helper: does a conversation or visit tie these two accounts together?
CREATE OR REPLACE FUNCTION public.is_my_counterpart(other uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT other IS NOT NULL AND (
    other = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.sender_id = auth.uid() AND m.receiver_id = other
    )
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.receiver_id = auth.uid() AND m.sender_id = other
    )
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE (r.patient_id = auth.uid() AND r.provider_id = other)
         OR (r.provider_id = auth.uid() AND r.patient_id = other)
    )
    OR EXISTS (
      SELECT 1 FROM public.consent_access c
      WHERE (c.patient_id = auth.uid() AND c.provider_id = other)
         OR (c.provider_id = auth.uid() AND c.patient_id = other)
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_my_counterpart(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_counterpart(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4. policies: public.users
-- ------------------------------------------------------------
-- Providers are a browsable directory; patients are only visible to accounts they
-- share a visit, a conversation or a consent grant with.
DROP POLICY IF EXISTS "users_select_own_or_visible" ON public.users;
CREATE POLICY "users_select_own_or_visible" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR role = 'provider'
    OR public.is_my_counterpart(id)
  );

DROP POLICY IF EXISTS "users_insert_self_or_admin" ON public.users;
CREATE POLICY "users_insert_self_or_admin" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "users_update_own_or_admin" ON public.users;
CREATE POLICY "users_update_own_or_admin" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------
-- 5. policies: public.providers
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "providers_select_authenticated" ON public.providers;
CREATE POLICY "providers_select_authenticated" ON public.providers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "providers_insert_own_or_admin" ON public.providers;
CREATE POLICY "providers_insert_own_or_admin" ON public.providers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "providers_update_own_or_admin" ON public.providers;
CREATE POLICY "providers_update_own_or_admin" ON public.providers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "providers_delete_admin" ON public.providers;
CREATE POLICY "providers_delete_admin" ON public.providers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------
-- 6. policies: public.requests
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "requests_select_own" ON public.requests;
CREATE POLICY "requests_select_own" ON public.requests
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

-- Only the patient books their own visit.
DROP POLICY IF EXISTS "requests_insert_patient" ON public.requests;
CREATE POLICY "requests_insert_patient" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "requests_update_participants" ON public.requests;
CREATE POLICY "requests_update_participants" ON public.requests
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin())
  WITH CHECK (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

-- Cancelling a visit deletes it in some admin flows; providers must never delete.
DROP POLICY IF EXISTS "requests_delete_admin" ON public.requests;
CREATE POLICY "requests_delete_admin" ON public.requests
  FOR DELETE TO authenticated
  USING (public.is_admin() OR patient_id = auth.uid());

-- ------------------------------------------------------------
-- 7. policies: public.messages
-- ------------------------------------------------------------
-- This is what closes the chat firehose: postgres_changes over the realtime
-- publication is authorized by these policies, so a subscriber only ever
-- receives rows that involve them.
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- The receiver marks read; the sender may edit or clear their own message.
DROP POLICY IF EXISTS "messages_update_participants" ON public.messages;
CREATE POLICY "messages_update_participants" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
CREATE POLICY "messages_delete_sender" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------
-- 8. policies: public.consent_access
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "consent_select_participants" ON public.consent_access;
CREATE POLICY "consent_select_participants" ON public.consent_access
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin());

-- The patient owns their consent grant; a provider can never widen it.
DROP POLICY IF EXISTS "consent_insert_patient" ON public.consent_access;
CREATE POLICY "consent_insert_patient" ON public.consent_access
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "consent_update_patient" ON public.consent_access;
CREATE POLICY "consent_update_patient" ON public.consent_access
  FOR UPDATE TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "consent_delete_patient" ON public.consent_access;
CREATE POLICY "consent_delete_patient" ON public.consent_access
  FOR DELETE TO authenticated
  USING (patient_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------
-- 9. policies: public.visit_notes
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "visit_notes_select" ON public.visit_notes;
CREATE POLICY "visit_notes_select" ON public.visit_notes
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.consent_access c
      WHERE c.patient_id = visit_notes.patient_id
        AND c.provider_id = auth.uid()
        AND c.is_enabled = true
        AND COALESCE((c.permissions ->> 'visit_notes')::boolean, false) = true
        AND (c.expires_at IS NULL OR c.expires_at > now())
    )
  );

-- The writing provider (or the admin) may change a note; the patient cannot edit
-- clinical text.
DROP POLICY IF EXISTS "visit_notes_insert_author" ON public.visit_notes;
CREATE POLICY "visit_notes_insert_author" ON public.visit_notes
  FOR INSERT TO authenticated
  WITH CHECK (provider_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "visit_notes_update_author" ON public.visit_notes;
CREATE POLICY "visit_notes_update_author" ON public.visit_notes
  FOR UPDATE TO authenticated
  USING (provider_id = auth.uid() OR public.is_admin())
  WITH CHECK (provider_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "visit_notes_delete_author" ON public.visit_notes;
CREATE POLICY "visit_notes_delete_author" ON public.visit_notes
  FOR DELETE TO authenticated
  USING (provider_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------
-- 10. policies: public.patient_documents
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "patient_documents_select" ON public.patient_documents;
CREATE POLICY "patient_documents_select" ON public.patient_documents
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.consent_access c
      WHERE c.patient_id = patient_documents.patient_id
        AND c.provider_id = auth.uid()
        AND c.is_enabled = true
        AND COALESCE((c.permissions ->> 'documents')::boolean, false) = true
        AND (c.expires_at IS NULL OR c.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "patient_documents_insert_owner" ON public.patient_documents;
CREATE POLICY "patient_documents_insert_owner" ON public.patient_documents
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "patient_documents_delete_owner" ON public.patient_documents;
CREATE POLICY "patient_documents_delete_owner" ON public.patient_documents
  FOR DELETE TO authenticated
  USING (patient_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------
-- 11. policies: public.provider_reviews
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "provider_reviews_select_all_authenticated" ON public.provider_reviews;
CREATE POLICY "provider_reviews_select_all_authenticated" ON public.provider_reviews
  FOR SELECT TO authenticated
  USING (true);

-- A patient may review only their own completed visit.
DROP POLICY IF EXISTS "provider_reviews_insert_patient" ON public.provider_reviews;
CREATE POLICY "provider_reviews_insert_patient" ON public.provider_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = provider_reviews.request_id
        AND r.patient_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "provider_reviews_delete_admin" ON public.provider_reviews;
CREATE POLICY "provider_reviews_delete_admin" ON public.provider_reviews
  FOR DELETE TO authenticated
  USING (public.is_admin() OR patient_id = auth.uid());

-- ------------------------------------------------------------
-- 12. policies: public.announcements
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_select_authenticated" ON public.announcements;
CREATE POLICY "announcements_select_authenticated" ON public.announcements
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "announcements_write_admin" ON public.announcements;
CREATE POLICY "announcements_write_admin" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 13. trigger: appointment status cannot be forged
-- ------------------------------------------------------------
-- RLS says *which rows* you may touch; this says *which transitions*. Without it
-- a patient could write status='Completed', and a provider could accept a visit
-- that was already cancelled.
CREATE OR REPLACE FUNCTION public.guard_request_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor uuid := auth.uid();
  is_staff boolean;
BEGIN
  -- Service role / cron / SECURITY DEFINER migrations without a JWT actor pass.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.is_admin() INTO is_staff;
  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only an admin may reassign a visit'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF actor = OLD.patient_id THEN
    -- A patient may cancel, and nothing else.
    IF NEW.status <> 'Cancelled' THEN
      RAISE EXCEPTION 'A patient can only cancel a visit, not set it to %', NEW.status
        USING ERRCODE = '42501';
    END IF;
    IF OLD.status NOT IN ('Pending', 'Accepted') THEN
      RAISE EXCEPTION 'A visit that is already % cannot be cancelled by the patient', OLD.status
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF actor = OLD.provider_id THEN
    IF NOT (
      (OLD.status = 'Pending'    AND NEW.status IN ('Accepted', 'Rejected'))
      OR (OLD.status = 'Accepted'   AND NEW.status = 'On The Way')
      OR (OLD.status = 'On The Way' AND NEW.status IN ('Arrived', 'Completed'))
      OR (OLD.status = 'Arrived'    AND NEW.status = 'Completed')
    ) THEN
      RAISE EXCEPTION 'Not allowed to move a visit from % to %', OLD.status, NEW.status
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'This account is not a participant of that visit'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS requests_status_guard ON public.requests;
CREATE TRIGGER requests_status_guard
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_status();

-- ------------------------------------------------------------
-- 14. trigger: provider approval, trust score and rating are server-owned
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_provider_trust_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.trust_score := LEAST(100,
    CASE WHEN COALESCE(NEW.is_approved, false) THEN 30 ELSE 0 END
    + CASE WHEN NEW.professional_id_status = 'verified' THEN 30 ELSE 0 END
    + CASE WHEN COALESCE(NEW.is_profile_complete, false) THEN 20 ELSE 0 END
    + CASE WHEN COALESCE(NEW.rating, 0) >= 4.0 THEN 20 ELSE 0 END
  );
  RETURN NEW;
END;
$$;

-- A provider editing their own profile may never approve themselves, change the
-- verification verdict, move their rating or raise their own trust score: those
-- are silently reverted to the stored values, then trust_score is re-derived.
CREATE OR REPLACE FUNCTION public.guard_provider_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor uuid := auth.uid();
  is_staff boolean;
BEGIN
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.is_admin() INTO is_staff;
  IF is_staff THEN
    RETURN NEW;
  END IF;

  NEW.is_approved := COALESCE(OLD.is_approved, NEW.is_approved);
  NEW.professional_id_status := COALESCE(OLD.professional_id_status, NEW.professional_id_status);
  NEW.rating := COALESCE(OLD.rating, NEW.rating);
  NEW.trust_score := COALESCE(OLD.trust_score, NEW.trust_score);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_self_columns_guard ON public.providers;
CREATE TRIGGER provider_self_columns_guard
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.guard_provider_columns();

DROP TRIGGER IF EXISTS provider_trust_score_derived ON public.providers;
CREATE TRIGGER provider_trust_score_derived
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.compute_provider_trust_score();
