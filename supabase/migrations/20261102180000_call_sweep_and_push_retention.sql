-- ============================================================
-- Migration: Call sweep window + push token retention
-- ============================================================

-- ------------------------------------------------------------
-- 1. Unanswered calls: sweep at 5 minutes, not 60 seconds
-- ------------------------------------------------------------
-- The callee has a 90 second join window in the chat bubble and the caller stops
-- waiting at 45 seconds. Sweeping at 60 seconds closed the row while someone was
-- still connecting, so an answered call could never be written as answered (the
-- calls_answered_not_after_ended rule rejected it and the record stayed 'missed').
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
          AND ringing_at < now() - interval '5 minutes'
      $CRON$
    );
  ELSE
    RAISE NOTICE 'pg_cron is not installed; unanswered calls will not be swept to missed.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Push tokens: prune handsets that have not been seen in 60 days
-- ------------------------------------------------------------
-- FCM only reports a dead registration on a send that fails with 404/400, and the
-- app deletes its own row at logout. A device that was simply abandoned keeps its
-- row forever, and every consultation invite is then pushed to it.
CREATE INDEX IF NOT EXISTS push_tokens_last_seen_idx
  ON public.push_tokens (last_seen_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push tokens stale sweep') THEN
      PERFORM cron.unschedule('push tokens stale sweep');
    END IF;
    PERFORM cron.schedule(
      'push tokens stale sweep',
      '15 4 * * *',
      $CRON$
        DELETE FROM public.push_tokens
        WHERE last_seen_at < now() - interval '60 days'
      $CRON$
    );
  ELSE
    RAISE NOTICE 'pg_cron is not installed; stale push tokens will not be pruned.';
  END IF;
END $$;
