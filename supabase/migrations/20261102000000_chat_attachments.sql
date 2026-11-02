-- ============================================================
-- Migration: Chat Attachments (Photos & Videos)
-- Bucket: chat_attachments (PRIVATE)
-- Table: public.messages (allows 'image', 'video', 'file')
-- ============================================================
-- Objects are stored under <sender_id>/<file>. Reads go through short-lived
-- signed URLs, so the bucket must never be public: a chat photo of a patient is
-- PHI, and a public bucket would also outlive the 24h message retention promise.

-- 1. Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_attachments',
  'chat_attachments',
  false,
  52428800, -- 50 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/ogg',
    'video/3gpp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/ogg',
    'video/3gpp'
  ];

-- 2. Membership test: the path was attached by or to me in some message.
--    SECURITY DEFINER so the check can read messages regardless of that table's RLS state.
CREATE OR REPLACE FUNCTION public.chat_attachment_is_participant(p_path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
      AND split_part(m.content, E'\n', 1) LIKE '%/' || p_path
  );
$$;

REVOKE EXECUTE ON FUNCTION public.chat_attachment_is_participant(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.chat_attachment_is_participant(text) TO authenticated;

-- 3. Storage policies: owners write and remove their own folder, participants read.
DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat_attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
CREATE POLICY "chat_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat_attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.chat_attachment_is_participant(name)
    )
  );

DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;
CREATE POLICY "chat_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat_attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Expand message_type check constraint on public.messages
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_valid;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_valid
  CHECK (message_type IN ('text', 'call', 'image', 'video', 'file'));
