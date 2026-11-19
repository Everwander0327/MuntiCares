-- ============================================================
-- Migration: Provider FHIR Export Audit Trail
-- ============================================================
-- Extends public.document_access_events so provider FHIR R4 IPS
-- exports are recorded alongside document opens and shown in the
-- patient's Privacy & Consent Access Log (RA 10173 accountability).
--
-- Production migrations are run manually via the Supabase SQL Editor.
-- This script is idempotent and safe to re-run.
-- ============================================================

BEGIN;

-- 1. Allow 'fhir_export' alongside 'documents' and 'visit_notes'
ALTER TABLE public.document_access_events
  DROP CONSTRAINT IF EXISTS document_access_events_category_check;

ALTER TABLE public.document_access_events
  ADD CONSTRAINT document_access_events_category_check
  CHECK (category IN ('documents', 'visit_notes', 'fhir_export'));

-- 2. Audited provider FHIR export RPC (caller identity & consent verified server-side)
CREATE OR REPLACE FUNCTION public.record_fhir_export(
  p_patient_id uuid,
  p_categories text[] DEFAULT ARRAY['demographics']::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_name text;
  allowed_cats text[] := ARRAY[]::text[];
  summary_title text;
  event_id uuid;
  grant_row record;
BEGIN
  IF actor IS NULL OR p_patient_id IS NULL THEN
    RAISE EXCEPTION 'Provider authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT u.full_name INTO actor_name
  FROM public.users u
  WHERE u.id = actor AND u.role = 'provider';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT c.is_enabled, c.permissions, c.expires_at
  INTO grant_row
  FROM public.consent_access c
  WHERE c.patient_id = p_patient_id
    AND c.provider_id = actor
    AND c.is_enabled = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active patient consent is required to export FHIR records'
      USING ERRCODE = '42501';
  END IF;

  -- Intersect requested categories against the patient's live consent permissions
  allowed_cats := array_append(allowed_cats, 'Demographics');
  IF 'medical_history' = ANY(COALESCE(p_categories, ARRAY[]::text[]))
     AND (grant_row.permissions -> 'medical_history') = 'true'::jsonb THEN
    allowed_cats := array_append(allowed_cats, 'Medical History');
  END IF;
  IF 'visit_notes' = ANY(COALESCE(p_categories, ARRAY[]::text[]))
     AND (grant_row.permissions -> 'visit_notes') = 'true'::jsonb THEN
    allowed_cats := array_append(allowed_cats, 'Visit Notes');
  END IF;
  IF 'documents' = ANY(COALESCE(p_categories, ARRAY[]::text[]))
     AND (grant_row.permissions -> 'documents') = 'true'::jsonb THEN
    allowed_cats := array_append(allowed_cats, 'Documents Metadata');
  END IF;

  summary_title := 'FHIR R4 IPS Bundle (' || array_to_string(allowed_cats, ', ') || ')';

  INSERT INTO public.document_access_events (
    patient_id,
    provider_id,
    provider_name,
    document_title,
    category
  )
  VALUES (
    p_patient_id,
    actor,
    COALESCE(actor_name, 'Provider'),
    summary_title,
    'fhir_export'
  )
  RETURNING id INTO event_id;

  UPDATE public.consent_access
  SET last_access = now()
  WHERE patient_id = p_patient_id AND provider_id = actor;

  RETURN event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_fhir_export(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fhir_export(uuid, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
