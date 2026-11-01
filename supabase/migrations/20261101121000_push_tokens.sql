-- ========================================================
-- Push tokens: the lookup table that lets a call invite
-- reach a device whose app is closed
-- ========================================================
-- Supabase Realtime broadcast is a pub/sub socket. It rings a user only while that
-- user's websocket is alive, so a call placed to a closed app is silent. Fan-out
-- has to start server-side, and the smallest honest version of that is a device
-- token registry the Edge Function can read.
--
-- Tokens are owned by the user who registered them. Nobody else may read them:
-- a push token is a tracking identifier, so cross-user visibility would leak
-- who uses which handset.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_token text NOT NULL,
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_platform_valid CHECK (platform IN ('android', 'ios', 'web')),
  CONSTRAINT push_tokens_user_and_token_distinct UNIQUE (user_id, device_token)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_tokens'::regclass AND conname = 'push_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE public.push_tokens
      ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id)
      REFERENCES public.users (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_tokens FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.push_tokens FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO authenticated;
GRANT ALL ON TABLE public.push_tokens TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_tokens' AND policyname = 'push_tokens_own_rows'
  ) THEN
    -- One policy for every verb: a device may only ever see or prune its own rows.
    CREATE POLICY "push_tokens_own_rows" ON public.push_tokens
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
