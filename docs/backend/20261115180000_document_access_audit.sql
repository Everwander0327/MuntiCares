-- PROPOSED ONLY: document link audit. Do not apply without deployment approval.
BEGIN;
CREATE TABLE public.document_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  provider_name text NOT NULL,
  document_title text NOT NULL,
  category text NOT NULL CHECK (category IN ('documents','visit_notes')),
  accessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_access_events_patient_time ON public.document_access_events(patient_id, accessed_at DESC);
ALTER TABLE public.document_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_access_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_access_events TO authenticated;
CREATE POLICY document_access_events_read ON public.document_access_events
  FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_admin());

-- Caller cannot supply actor, timestamp, title, or permission categories.
CREATE FUNCTION public.record_document_access(p_patient_id uuid, p_file_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  actor_name text;
  title text;
  category_name text;
  event_id uuid;
BEGIN
  SELECT u.full_name INTO actor_name FROM public.users u
  WHERE u.id = actor AND u.role = 'provider';
  IF actor IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'Provider authentication required' USING ERRCODE = '42501';
  END IF;
  -- Recheck S1 authorization, including the preserved note-author workflow.
  IF NOT public.medical_document_is_visible(p_file_path) OR NOT EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'medical_documents' AND o.name = p_file_path
  ) THEN
    RAISE EXCEPTION 'Document access is not permitted' USING ERRCODE = '42501';
  END IF;
  SELECT d.document_title INTO title FROM public.patient_documents d
  WHERE d.patient_id = p_patient_id AND d.file_path = p_file_path LIMIT 1;
  IF FOUND AND split_part(p_file_path, '/', 1) = p_patient_id::text THEN
    category_name := 'documents';
  ELSE
    -- Only note attachments may use the separate visit-notes permission/author path.
    IF split_part(p_file_path, '/', 1) <> 'provider_notes' OR NOT EXISTS (
      SELECT 1 FROM public.visit_notes vn
      WHERE vn.patient_id = p_patient_id AND vn.attachment_url = p_file_path
        AND (vn.provider_id = actor OR EXISTS (
          SELECT 1 FROM public.consent_access c WHERE c.patient_id = vn.patient_id
            AND c.provider_id = actor AND c.is_enabled = true
            AND c.permissions -> 'visit_notes' = 'true'::jsonb
            AND (c.expires_at IS NULL OR c.expires_at > now())
        ))
    ) THEN
      RAISE EXCEPTION 'Document does not belong to this patient' USING ERRCODE = '42501';
    END IF;
    title := 'Visit note attachment';
    category_name := 'visit_notes';
  END IF;
  INSERT INTO public.document_access_events(patient_id,provider_id,provider_name,document_title,category)
  VALUES(p_patient_id,actor,COALESCE(actor_name,'Provider'),COALESCE(title,'Medical document'),category_name)
  RETURNING id INTO event_id;
  -- Server-managed summary for the existing provider cards; never widens consent.
  UPDATE public.consent_access SET last_access = now()
  WHERE patient_id = p_patient_id AND provider_id = actor;
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_document_access(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_document_access(uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
