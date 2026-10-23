-- Live Tracking v2
-- - Per-visit destination (with versioning so ETA refreshes when the patient edits it)
-- - Explicit provider tracking sessions with heartbeat + server-side expiry
-- - Private Realtime channels and RLS for live location tables
-- - Live location is deleted as soon as tracking ends

-- ---------------------------------------------------------------------------
-- 1. Per-visit destination
-- ---------------------------------------------------------------------------
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS dest_address text,
  ADD COLUMN IF NOT EXISTS dest_source text,
  ADD COLUMN IF NOT EXISTS dest_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dest_updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Tracking sessions (one current session per request)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_sessions (
  request_id  uuid PRIMARY KEY REFERENCES public.requests(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'ended', 'expired')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  stop_reason text,
  CONSTRAINT tracking_sessions_session_id_key UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS tracking_sessions_provider_idx
  ON public.tracking_sessions(provider_id);
CREATE INDEX IF NOT EXISTS tracking_sessions_stale_idx
  ON public.tracking_sessions(last_seen_at)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 3. Latest location payload shared by Realtime + persisted fallback
-- ---------------------------------------------------------------------------
ALTER TABLE public.provider_locations
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS seq bigint,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;

CREATE INDEX IF NOT EXISTS provider_locations_session_seq_idx
  ON public.provider_locations(session_id, seq DESC);

ALTER TABLE public.provider_locations
  DROP CONSTRAINT IF EXISTS provider_locations_session_fk;
ALTER TABLE public.provider_locations
  ADD CONSTRAINT provider_locations_session_fk
  FOREIGN KEY (session_id)
  REFERENCES public.tracking_sessions(session_id)
  ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Helpers (is_admin already exists in production; make local/staging safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Destination RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_tracking_destination(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_request  public.requests%ROWTYPE;
  v_lat      double precision;
  v_lng      double precision;
  v_address  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT (
    v_request.patient_id = v_uid
    OR v_request.provider_id = v_uid
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_request.dest_lat IS NOT NULL AND v_request.dest_lng IS NOT NULL THEN
    RETURN jsonb_build_object(
      'prepared', true,
      'dest_lat', v_request.dest_lat,
      'dest_lng', v_request.dest_lng,
      'dest_address', v_request.dest_address,
      'dest_source', v_request.dest_source,
      'dest_version', v_request.dest_version
    );
  END IF;

  SELECT latitude, longitude, address
    INTO v_lat, v_lng, v_address
    FROM public.patients
   WHERE user_id = v_request.patient_id
   LIMIT 1;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN jsonb_build_object('prepared', false);
  END IF;

  UPDATE public.requests
     SET dest_lat = v_lat,
         dest_lng = v_lng,
         dest_address = COALESCE(dest_address, v_address),
         dest_source = COALESCE(dest_source, 'patient_home'),
         dest_version = COALESCE(dest_version, 0) + 1,
         dest_updated_at = now()
   WHERE id = p_request_id
   RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'prepared', true,
    'dest_lat', v_request.dest_lat,
    'dest_lng', v_request.dest_lng,
    'dest_address', v_request.dest_address,
    'dest_source', v_request.dest_source,
    'dest_version', v_request.dest_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tracking_destination(
  p_request_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_address text DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_request public.requests%ROWTYPE;
  v_source  text := COALESCE(NULLIF(p_source, ''), 'manual');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid destination coordinates';
  END IF;

  IF v_source NOT IN ('manual', 'booking', 'patient_home') THEN
    v_source := 'manual';
  END IF;

  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT (v_request.patient_id = v_uid OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the patient can update the visit destination';
  END IF;

  IF v_request.status IN ('Arrived', 'Completed', 'Cancelled', 'Rejected') THEN
    RAISE EXCEPTION 'This visit is already closed';
  END IF;

  UPDATE public.requests
     SET dest_lat = p_lat,
         dest_lng = p_lng,
         dest_address = NULLIF(p_address, ''),
         dest_source = v_source,
         dest_version = COALESCE(dest_version, 0) + 1,
         dest_updated_at = now()
   WHERE id = p_request_id
   RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'dest_lat', v_request.dest_lat,
    'dest_lng', v_request.dest_lng,
    'dest_address', v_request.dest_address,
    'dest_source', v_request.dest_source,
    'dest_version', v_request.dest_version
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Session RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_tracking_session(
  p_request_id uuid,
  p_session_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_request   public.requests%ROWTYPE;
  v_started   timestamptz;
  v_provider  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  v_provider := v_request.provider_id;
  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'This visit has no assigned provider';
  END IF;
  IF NOT (v_provider = v_uid OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_request.status <> 'On The Way' THEN
    RETURN jsonb_build_object(
      'error', 'not_on_the_way',
      'message', 'Tracking is only allowed while On The Way',
      'status', 'ended'
    );
  END IF;

  -- A restarted watcher always starts a clean footprint.
  DELETE FROM public.provider_locations WHERE request_id = p_request_id;

  INSERT INTO public.tracking_sessions (
    request_id, session_id, provider_id, status, started_at, last_seen_at
  )
  VALUES (
    p_request_id, p_session_id, v_provider, 'active', now(), now()
  )
  ON CONFLICT (request_id) DO UPDATE
    SET session_id = EXCLUDED.session_id,
        provider_id = EXCLUDED.provider_id,
        status = 'active',
        started_at = now(),
        last_seen_at = now(),
        ended_at = NULL,
        stop_reason = NULL
  RETURNING started_at INTO v_started;

  UPDATE public.requests
     SET route_started_at = COALESCE(route_started_at, now())
   WHERE id = p_request_id
   RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'request_id', p_request_id,
    'provider_id', v_provider,
    'started_at', v_started,
    'dest_lat', v_request.dest_lat,
    'dest_lng', v_request.dest_lng,
    'dest_address', v_request.dest_address,
    'dest_source', v_request.dest_source,
    'dest_version', v_request.dest_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_tracking_session(
  p_request_id uuid,
  p_session_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.tracking_sessions
     SET last_seen_at = now()
   WHERE request_id = p_request_id
     AND session_id = p_session_id
     AND status = 'active'
     AND (provider_id = auth.uid() OR public.is_admin());

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_tracking_session(
  p_request_id uuid,
  p_session_id uuid,
  p_reason text DEFAULT 'ended'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text := left(COALESCE(NULLIF(p_reason, ''), 'ended'), 200);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.tracking_sessions
     SET status = 'ended',
         ended_at = now(),
         stop_reason = v_reason
   WHERE request_id = p_request_id
     AND session_id = p_session_id
     AND status = 'active'
     AND (provider_id = auth.uid() OR public.is_admin());

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.provider_locations
   WHERE request_id = p_request_id
     AND session_id = p_session_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_tracking_sessions(
  p_stale_after interval DEFAULT interval '3 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH stale AS (
    UPDATE public.tracking_sessions
       SET status = 'expired',
           ended_at = now(),
           stop_reason = 'heartbeat_timeout'
     WHERE status = 'active'
       AND last_seen_at < now() - p_stale_after
     RETURNING request_id
  )
  SELECT count(*) INTO v_count FROM stale;

  DELETE FROM public.provider_locations pl
   USING public.tracking_sessions ts
   WHERE pl.request_id = ts.request_id
     AND ts.status <> 'active';

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Persisted location write (only accepts the current active session)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_provider_location(
  p_request_id uuid,
  p_session_id uuid,
  p_seq bigint,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision DEFAULT NULL,
  p_heading double precision DEFAULT NULL,
  p_speed double precision DEFAULT NULL,
  p_captured_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_accepted boolean;
  v_captured timestamptz := COALESCE(p_captured_at, now());
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_seq IS NULL OR p_seq < 1 THEN
    RETURN false;
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180 THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tracking_sessions
     WHERE request_id = p_request_id
       AND session_id = p_session_id
       AND status = 'active'
       AND (provider_id = auth.uid() OR public.is_admin())
  ) THEN
    RETURN false;
  END IF;

  IF v_captured > now() + interval '2 minutes' THEN
    v_captured := now();
  END IF;

  INSERT INTO public.provider_locations (
    request_id, provider_id, lat, lng, accuracy, heading, speed,
    session_id, seq, captured_at, updated_at
  )
  VALUES (
    p_request_id, auth.uid(), p_lat, p_lng, p_accuracy, p_heading, p_speed,
    p_session_id, p_seq, v_captured, now()
  )
  ON CONFLICT (request_id) DO UPDATE
    SET provider_id = EXCLUDED.provider_id,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        accuracy = EXCLUDED.accuracy,
        heading = EXCLUDED.heading,
        speed = EXCLUDED.speed,
        session_id = EXCLUDED.session_id,
        seq = EXCLUDED.seq,
        captured_at = EXCLUDED.captured_at,
        updated_at = now()
    WHERE public.provider_locations.session_id IS DISTINCT FROM EXCLUDED.session_id
       OR public.provider_locations.seq IS NULL
       OR EXCLUDED.seq > public.provider_locations.seq
  RETURNING true INTO v_accepted;

  IF v_accepted IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.tracking_sessions
     SET last_seen_at = now()
   WHERE request_id = p_request_id
     AND session_id = p_session_id
     AND status = 'active';

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Cleanup when a visit stops being "On The Way"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_provider_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('Arrived', 'Completed', 'Cancelled', 'Rejected') THEN
    UPDATE public.tracking_sessions
       SET status = CASE WHEN status = 'active' THEN 'ended' ELSE status END,
           ended_at = COALESCE(ended_at, now()),
           stop_reason = COALESCE(stop_reason, lower(NEW.status))
     WHERE request_id = NEW.id;

    DELETE FROM public.provider_locations WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_provider_location ON public.requests;
CREATE TRIGGER trg_cleanup_provider_location
  AFTER UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_provider_location();

-- ---------------------------------------------------------------------------
-- 9. RLS + least-privilege grants for live location tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_locations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tracking_sessions FROM anon;
REVOKE ALL ON TABLE public.provider_locations FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.tracking_sessions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.provider_locations FROM authenticated;
GRANT SELECT ON TABLE public.tracking_sessions TO authenticated;
GRANT SELECT ON TABLE public.provider_locations TO authenticated;

DROP POLICY IF EXISTS tracking_sessions_select_participants ON public.tracking_sessions;
CREATE POLICY tracking_sessions_select_participants
  ON public.tracking_sessions
  FOR SELECT TO authenticated
  USING (
    provider_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.requests r
       WHERE r.id = tracking_sessions.request_id
         AND r.patient_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS provider_locations_select_participants ON public.provider_locations;
CREATE POLICY provider_locations_select_participants
  ON public.provider_locations
  FOR SELECT TO authenticated
  USING (
    provider_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.requests r
       WHERE r.id = provider_locations.request_id
         AND r.patient_id = auth.uid()
    )
  );

ALTER TABLE public.tracking_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.provider_locations REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_locations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 10. Private Realtime topics: "tracking:<request_id>"
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    BEGIN
      DROP POLICY IF EXISTS munticares_tracking_realtime_select ON realtime.messages;
      CREATE POLICY munticares_tracking_realtime_select
        ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          (SELECT realtime.topic()) LIKE 'tracking:%'
          AND EXISTS (
            SELECT 1 FROM public.requests r
             WHERE 'tracking:' || r.id::text = (SELECT realtime.topic())
               AND (
                 r.patient_id = auth.uid()
                 OR r.provider_id = auth.uid()
                 OR public.is_admin()
               )
          )
        );

      DROP POLICY IF EXISTS munticares_tracking_realtime_insert ON realtime.messages;
      CREATE POLICY munticares_tracking_realtime_insert
        ON realtime.messages
        FOR INSERT TO authenticated
        WITH CHECK (
          (SELECT realtime.topic()) LIKE 'tracking:%'
          AND EXISTS (
            SELECT 1
              FROM public.tracking_sessions ts
              JOIN public.requests r ON r.id = ts.request_id
             WHERE 'tracking:' || r.id::text = (SELECT realtime.topic())
               AND ts.status = 'active'
               AND ts.provider_id = auth.uid()
          )
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Realtime messages policy skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11. RPC grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.prepare_tracking_destination(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_tracking_destination(uuid, double precision, double precision, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_tracking_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_tracking_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_tracking_session(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_provider_location(uuid, uuid, bigint, double precision, double precision, double precision, double precision, double precision, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_tracking_sessions(interval) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.prepare_tracking_destination(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tracking_destination(uuid, double precision, double precision, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_tracking_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_tracking_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_tracking_session(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_provider_location(uuid, uuid, bigint, double precision, double precision, double precision, double precision, double precision, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_tracking_sessions(interval) TO service_role;

-- ---------------------------------------------------------------------------
-- 12. Mark sessions stale even if the provider's app is killed
-- ---------------------------------------------------------------------------
DO $cron_setup$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron unavailable; sessions will be expired by the client fallback: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1'
        USING 'expire-tracking-sessions';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    BEGIN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
        USING 'expire-tracking-sessions',
              '* * * * *',
              'SELECT public.expire_stale_tracking_sessions();';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule tracking session expiry: %', SQLERRM;
    END;
  END IF;
END;
$cron_setup$;

NOTIFY pgrst, 'reload schema';
