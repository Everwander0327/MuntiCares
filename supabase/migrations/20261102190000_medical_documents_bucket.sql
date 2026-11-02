-- ============================================================
-- Migration: medical_documents storage bucket
-- ============================================================
-- The app has written to this bucket since the pre-session upload and the clinical
-- note attachment were built (src/features/patient/components/PreSessionUploadModal.jsx,
-- src/features/provider/components/PatientRecordModal.jsx), but no migration ever
-- created it: it existed only as a hand-made bucket, so uploads failed silently and
-- whatever rules it had were unaudited.
--
-- Layout:
--   <patient_user_id>/<request_id>/<file>  uploaded by the patient
--   provider_notes/<provider_user_id>_<file>  attached to a progress note
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical_documents',
  'medical_documents',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'text/plain',
    'video/mp4'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------
-- Visibility rule, shared by SELECT on objects
-- ------------------------------------------------------------
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
              AND COALESCE((c.permissions ->> 'visit_notes')::boolean, false) = true
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
      AND COALESCE((c.permissions ->> 'documents')::boolean, false) = true
      AND (c.expires_at IS NULL OR c.expires_at > now())
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.medical_document_is_visible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medical_document_is_visible(text) TO authenticated;

-- ------------------------------------------------------------
-- Storage policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "medical_documents_insert" ON storage.objects;
CREATE POLICY "medical_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical_documents'
    AND (
      -- a patient may only file under their own id
      (storage.foldername(name))[1] = auth.uid()::text
      -- a provider may only file their own note attachments
      -- (storage.foldername() drops the file name, so read it from the path)
      OR (
        (storage.foldername(name))[1] = 'provider_notes'
        AND split_part((string_to_array(name, '/'))[2], '_', 1) = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "medical_documents_select" ON storage.objects;
CREATE POLICY "medical_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical_documents'
    AND (owner = auth.uid() OR public.medical_document_is_visible(name))
  );

DROP POLICY IF EXISTS "medical_documents_delete" ON storage.objects;
CREATE POLICY "medical_documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'medical_documents'
    AND (
      owner = auth.uid()
      OR public.is_admin()
      -- the patient may clear documents filed in their own folder
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
