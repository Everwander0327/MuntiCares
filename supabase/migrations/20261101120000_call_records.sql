-- ========================================================
-- Call records: persist teleconsultation history and stop
-- describing a call as a text message that starts with an emoji
-- ========================================================
-- Before this migration a call left no trace: ChatWindow.jsx sent the plain-text
-- message "📹 I've started a video consultation…" and detected a call by sniffing
-- for that emoji prefix. There was no record of who called
-- whom, whether it was answered, or how long it lasted, and the "Join Video Call"
-- button stayed clickable after the caller had hung up.
--
-- This adds a participant-owned `calls` table, tags chat rows with an explicit
-- message_type so the notification bubble can be bound to its call, and moves the
-- 24-hour message expiry that users are promised onto the database, where a client
-- DELETE cannot be skipped, deferred or blocked.
--
-- Retention decision: chat CONTENT still expires after 24 hours, as the banner in
-- ChatWindow.jsx promises. Call METADATA is retained, because a consultation
-- record (who, when, how long, answered or missed) is not message content. No
-- recording, transcript or media is stored.
--
-- No FKs are invented blindly: public.users(id) is uuid-keyed, proven by
-- public.is_admin() comparing users.id = auth.uid() in 20261029171000_patient_rls.sql.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  call_type text NOT NULL,
  status text NOT NULL DEFAULT 'ringing',
  ringing_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  end_reason text,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calls_participants_differ CHECK (caller_id <> callee_id),
  CONSTRAINT calls_type_valid CHECK (call_type IN ('audio', 'video')),
  CONSTRAINT calls_status_valid CHECK (
    status IN ('ringing', 'answered', 'declined', 'missed', 'ended', 'failed')
  ),
  CONSTRAINT calls_answered_needs_timestamp CHECK (answered_at IS NOT NULL OR status <> 'answered'),
  CONSTRAINT calls_answered_not_after_ended CHECK (answered_at IS NULL OR ended_at IS NULL OR answered_at <= ended_at),
  CONSTRAINT calls_duration_non_negative CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.calls'::regclass AND conname = 'calls_caller_id_fkey'
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT calls_caller_id_fkey FOREIGN KEY (caller_id)
      REFERENCES public.users (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.calls'::regclass AND conname = 'calls_callee_id_fkey'
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT calls_callee_id_fkey FOREIGN KEY (callee_id)
      REFERENCES public.users (id) ON DELETE CASCADE;
  END IF;
END $$;

-- Missed-call list for a signed-in user, and the per-conversation call history.
CREATE INDEX IF NOT EXISTS calls_callee_inbox_idx
  ON public.calls (callee_id, status, ringing_at DESC);
CREATE INDEX IF NOT EXISTS calls_conversation_idx
  ON public.calls (caller_id, callee_id, ringing_at DESC);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Anon must never read or write call history. Supabase's default privileges in the
-- public schema grant ALL to anon, so the grant is removed explicitly — RLS alone
-- does not narrow table privileges. The same defaults hand authenticated TRUNCATE,
-- DELETE, REFERENCES, TRIGGER and MAINTAIN, none of which a participant needs.
REVOKE ALL ON TABLE public.calls FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.calls FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.calls TO authenticated;
GRANT ALL ON TABLE public.calls TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calls' AND policyname = 'calls_select_participant'
  ) THEN
    CREATE POLICY "calls_select_participant" ON public.calls
      FOR SELECT TO authenticated
      USING (auth.uid() IN (caller_id, callee_id));
  END IF;

  -- Only the caller may open a call, and never on someone else's behalf.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calls' AND policyname = 'calls_insert_as_caller'
  ) THEN
    CREATE POLICY "calls_insert_as_caller" ON public.calls
      FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = caller_id
        AND auth.uid() <> callee_id
      );
  END IF;

  -- Either participant closes or re-labels the call; participants are immutable,
  -- so a row cannot be reassigned to a different pair by the WITH CHECK clause.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calls' AND policyname = 'calls_update_participant'
  ) THEN
    CREATE POLICY "calls_update_participant" ON public.calls
      FOR UPDATE TO authenticated
      USING (auth.uid() IN (caller_id, callee_id))
      WITH CHECK (auth.uid() IN (caller_id, callee_id));
  END IF;
  -- No DELETE policy on purpose: a consultation record stays auditable.
END $$;

-- Duration is derived server-side; a client that reports its own call length is
-- not an audit trail.
CREATE OR REPLACE FUNCTION public.calls_derive_duration()
RETURNS trigger AS $$
BEGIN
  IF NEW.answered_at IS NOT NULL AND NEW.ended_at IS NOT NULL THEN
    NEW.duration_seconds := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at)))
    )::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS calls_derive_duration ON public.calls;
CREATE TRIGGER calls_derive_duration
  BEFORE UPDATE OF ended_at, answered_at ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.calls_derive_duration();

-- ------------------------------------------------------------
-- Chat rows become explicitly typed
-- ------------------------------------------------------------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS call_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_message_type_valid'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_message_type_valid CHECK (message_type IN ('text', 'call'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_call_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_call_id_fkey FOREIGN KEY (call_id)
      REFERENCES public.calls (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 24-hour expiry, enforced by the database instead of the app
-- ------------------------------------------------------------
-- The old behaviour was a client-side DELETE fired every time a chat was opened,
-- which meant a user who never reopened chat kept messages past the window the
-- banner promises them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'messages 24h expiry') THEN
      PERFORM cron.unschedule('messages 24h expiry');
    END IF;
    PERFORM cron.schedule(
      'messages 24h expiry',
      '*/15 * * * *',
      $CRON$ DELETE FROM public.messages WHERE created_at < now() - interval '24 hours' $CRON$
    );
  ELSE
    RAISE NOTICE 'pg_cron is not installed; chat messages will not expire server-side.';
  END IF;
END $$;

-- A dial that nobody answered, where the caller then closed the chat, would otherwise
-- stay 'ringing' forever and keep a dead call joinable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calls stale ringing sweep') THEN
      PERFORM cron.unschedule('calls stale ringing sweep');
    END IF;
    PERFORM cron.schedule(
      'calls stale ringing sweep',
      '* * * * *',
      $CRON$
        UPDATE public.calls
        SET status = 'missed', ended_at = now()
        WHERE status = 'ringing'
          AND answered_at IS NULL
          AND ringing_at < now() - interval '60 seconds'
      $CRON$
    );
  ELSE
    RAISE NOTICE 'pg_cron is not installed; unanswered calls will not be swept to missed.';
  END IF;
END $$;
