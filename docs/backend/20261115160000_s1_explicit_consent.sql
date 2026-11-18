-- PROPOSED ONLY: S1 explicit consent. Do not apply to production.
BEGIN;

CREATE OR REPLACE FUNCTION public.medical_document_is_visible(p_path text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  parts text[];
  first_seg text;
  patient uuid;
BEGIN
  IF p_path IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin() THEN
    RETURN true;
  END IF;

  parts := string_to_array(p_path, '/');
  first_seg := parts[1];

  -- A note attachment belongs to the note: its author, the patient it describes,
  -- or a provider who still holds visit-notes consent for that patient.
  IF first_seg = 'provider_notes' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.visit_notes vn
      WHERE vn.attachment_url = p_path
        AND (
          vn.provider_id = auth.uid()
          OR vn.patient_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.consent_access c
            WHERE c.patient_id = vn.patient_id
              AND c.provider_id = auth.uid()
              AND c.is_enabled = true
              AND c.permissions -> 'visit_notes' = 'true'::jsonb
              AND (c.expires_at IS NULL OR c.expires_at > now())
          )
        )
    );
  END IF;

  -- Patient-owned folder: the first segment is that patient's user id.
  IF first_seg !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}$' THEN
    RETURN false;
  END IF;

  patient := first_seg::uuid;
  IF patient = auth.uid() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.consent_access c
    WHERE c.patient_id = patient
      AND c.provider_id = auth.uid()
      AND c.is_enabled = true
      AND c.permissions -> 'documents' = 'true'::jsonb
      AND (c.expires_at IS NULL OR c.expires_at > now())
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.medical_document_is_visible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medical_document_is_visible(text) TO authenticated;


ALTER TABLE public.medical_histories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medical_histories_select_policy" ON public.medical_histories;
CREATE POLICY "medical_histories_select_policy" ON public.medical_histories
  FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_admin() OR EXISTS (
    SELECT 1 FROM public.consent_access c
    WHERE c.patient_id = medical_histories.patient_id AND c.provider_id = auth.uid()
      AND c.is_enabled = true
      AND c.permissions -> 'medical_history' = 'true'::jsonb
      AND (c.expires_at IS NULL OR c.expires_at > now())
  ));
-- AND this condition with every permissive SELECT/ALL policy, including older ones.
DROP POLICY IF EXISTS "s1_medical_histories_consent" ON public.medical_histories;
CREATE POLICY "s1_medical_histories_consent" ON public.medical_histories
  AS RESTRICTIVE FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_admin() OR EXISTS (
    SELECT 1 FROM public.consent_access c
    WHERE c.patient_id = medical_histories.patient_id AND c.provider_id = auth.uid()
      AND c.is_enabled = true
      AND c.permissions -> 'medical_history' = 'true'::jsonb
      AND (c.expires_at IS NULL OR c.expires_at > now())
  ));

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_documents_select" ON public.patient_documents;
CREATE POLICY "patient_documents_select" ON public.patient_documents
  FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_admin() OR EXISTS (
    SELECT 1 FROM public.consent_access c
    WHERE c.patient_id = patient_documents.patient_id AND c.provider_id = auth.uid()
      AND c.is_enabled = true
      AND c.permissions -> 'documents' = 'true'::jsonb
      AND (c.expires_at IS NULL OR c.expires_at > now())
  ));
-- AND this condition with every permissive SELECT/ALL policy, including older ones.
DROP POLICY IF EXISTS "s1_patient_documents_consent" ON public.patient_documents;
CREATE POLICY "s1_patient_documents_consent" ON public.patient_documents
  AS RESTRICTIVE FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_admin() OR EXISTS (
    SELECT 1 FROM public.consent_access c
    WHERE c.patient_id = patient_documents.patient_id AND c.provider_id = auth.uid()
      AND c.is_enabled = true
      AND c.permissions -> 'documents' = 'true'::jsonb
      AND (c.expires_at IS NULL OR c.expires_at > now())
  ));

DROP POLICY IF EXISTS "medical_documents_select" ON storage.objects;
CREATE POLICY "medical_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'medical_documents' AND public.medical_document_is_visible(name));
-- Scope the extra guard to this bucket; other storage workflows are unaffected.
DROP POLICY IF EXISTS "s1_medical_documents_consent" ON storage.objects;
CREATE POLICY "s1_medical_documents_consent" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'medical_documents' OR public.medical_document_is_visible(name));
COMMIT;
