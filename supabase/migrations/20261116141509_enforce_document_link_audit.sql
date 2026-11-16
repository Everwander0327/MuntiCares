BEGIN;

UPDATE storage.buckets SET public = false WHERE id = 'medical_documents';

-- Patients keep direct access to their own files and attachments. Provider access
-- goes through the server even when another permissive storage policy applies.
CREATE POLICY medical_documents_audited_provider_reads ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (
    bucket_id <> 'medical_documents'
    OR public.is_admin()
    OR split_part(name, '/', 1) = (SELECT auth.uid())::text
    -- Storage deletion also uses SELECT. Keep the existing owner delete path
    -- without allowing the same owner to download or sign a provider link.
    OR (
      storage.allow_any_operation(ARRAY['object.delete', 'object.delete_many'])
      AND owner = (SELECT auth.uid())
    )
    OR (
      split_part(name, '/', 1) = 'provider_notes'
      AND EXISTS (
        SELECT 1 FROM public.visit_notes vn
        WHERE vn.attachment_url = name AND vn.patient_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY medical_documents_no_anonymous_reads ON storage.objects
  AS RESTRICTIVE FOR SELECT TO anon USING (bucket_id <> 'medical_documents');

REVOKE EXECUTE ON FUNCTION public.record_document_access(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_access(uuid, text) TO service_role;

-- Only the Edge Function's service client can submit the identity it verified
-- with Auth. Reuse the existing consent validation and audit insert together.
CREATE FUNCTION public.record_document_link_issue(
  p_actor_id uuid, p_patient_id uuid, p_file_path text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Provider authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_actor_id::text, true);
  RETURN public.record_document_access(p_patient_id, p_file_path);
END;
$$;

REVOKE ALL ON FUNCTION public.record_document_link_issue(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_link_issue(uuid, uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
