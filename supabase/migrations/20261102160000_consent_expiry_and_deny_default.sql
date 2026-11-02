-- ============================================================
-- Migration: Consent expiry + deny-by-default consent
-- ============================================================
-- Two settled product rules had no server implementation:
--   * a missing permission key must DENY access (the shipped policy granted it,
--     because NULL IS NOT FALSE is true)
--   * enabling a grant requires a future expiry; a revoked row may keep a past one
--
-- Existing enabled grants are grandfathered with expires_at NULL ("no expiry"), so
-- applying this does not silently lock out providers the patient approved earlier.
-- The app writes a future expiry on every enable from now on.
-- ============================================================

ALTER TABLE public.consent_access
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.consent_access.expires_at IS
  'When this grant stops working. NULL = no expiry (grants made before this migration).';

CREATE INDEX IF NOT EXISTS consent_access_expiry_idx
  ON public.consent_access (patient_id, provider_id)
  WHERE is_enabled = true;

-- ------------------------------------------------------------
-- Deny-by-default consent in the shipped policies
-- ------------------------------------------------------------
-- medical_histories: a provider sees history only with an enabled grant whose
-- medical_history key is explicitly true and whose expiry has not passed.
DROP POLICY IF EXISTS "medical_histories_select_policy" ON public.medical_histories;
CREATE POLICY "medical_histories_select_policy" ON public.medical_histories
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.consent_access c
      WHERE c.patient_id = medical_histories.patient_id
        AND c.provider_id = auth.uid()
        AND c.is_enabled = true
        AND COALESCE((c.permissions ->> 'medical_history')::boolean, false) = true
        AND (c.expires_at IS NULL OR c.expires_at > now())
    )
  );

-- Re-create the modify policy unchanged (dropped by earlier rollout drift, if any).
DROP POLICY IF EXISTS "medical_histories_modify_own" ON public.medical_histories;
CREATE POLICY "medical_histories_modify_own" ON public.medical_histories
  FOR ALL TO authenticated
  USING (patient_id = auth.uid() OR public.is_admin())
  WITH CHECK (patient_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------
-- Revocation must actually stop writes
-- ------------------------------------------------------------
-- A provider may add a visit note only while the grant that covers it is live.
CREATE OR REPLACE FUNCTION public.guard_visit_note_consent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.consent_access c
    WHERE c.patient_id = NEW.patient_id
      AND c.provider_id = auth.uid()
      AND c.is_enabled = true
      AND COALESCE((c.permissions ->> 'visit_notes')::boolean, false) = true
      AND (c.expires_at IS NULL OR c.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'The patient has not granted access to write visit notes'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visit_notes_consent_guard ON public.visit_notes;
CREATE TRIGGER visit_notes_consent_guard
  BEFORE INSERT OR UPDATE ON public.visit_notes
  FOR EACH ROW EXECUTE FUNCTION public.guard_visit_note_consent();
