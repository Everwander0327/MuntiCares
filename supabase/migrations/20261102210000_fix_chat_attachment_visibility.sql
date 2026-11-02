-- ============================================================
-- Migration: Fix chat attachment visibility for receiver
-- ============================================================
-- Objects in chat_attachments are stored as <sender_id>/<file>.
-- When the receiver calls createSignedUrls to display the attached
-- photo or video, the storage.objects SELECT policy evaluates
-- public.chat_attachment_is_participant(name).
--
-- The previous definition used:
--   split_part(m.content, E'\n', 1) LIKE '%/' || p_path
-- which required a leading slash before p_path (e.g. '%/<sender_id>/<file>').
-- Since m.content stores '<sender_id>/<file>' directly without a leading slash,
-- the check always returned false for the receiver, blocking them from
-- signing URLs and leaving attachments in an endless loading spinner.

CREATE OR REPLACE FUNCTION public.chat_attachment_is_participant(p_path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
      AND (
        trim(split_part(m.content, E'\n', 1)) = trim(p_path)
        OR trim(split_part(m.content, E'\n', 1)) = ltrim(trim(p_path), '/')
        OR trim(split_part(m.content, E'\n', 1)) LIKE '%/' || ltrim(trim(p_path), '/')
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.chat_attachment_is_participant(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.chat_attachment_is_participant(text) TO authenticated;

