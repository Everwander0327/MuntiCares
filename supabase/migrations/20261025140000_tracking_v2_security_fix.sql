-- ===========================================================================
-- MuntiCares Migration: Tracking V2 Security, Integrity & Realtime Fixes
-- File: supabase/migrations/20261025140000_tracking_v2_security_fix.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PRIORITY 1: PRIVILEGE ESCALATION (CRITICAL)
-- ---------------------------------------------------------------------------

-- 1.1 Secure public.is_admin() with explicit search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- 1.2 BEFORE UPDATE Trigger on public.users to block unauthorized role/flag escalation
CREATE OR REPLACE FUNCTION public.protect_users_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If invoked by a non-admin authenticated user, block changes to privileged columns
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Unauthorized: changing user role is forbidden'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
      RAISE EXCEPTION 'Unauthorized: changing user ban status is forbidden'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Unauthorized: user ID is immutable'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Unauthorized: email must be updated via Supabase Auth'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Unauthorized: created_at is immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_users_privileges ON public.users;
CREATE TRIGGER trg_protect_users_privileges
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_users_privileges();

-- 1.3 Column-level privilege restriction on public.users
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (full_name, avatar_url) ON public.users TO authenticated;

-- 1.4 Secure handle_new_auth_user() to prevent client-supplied admin role at signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  assigned_role text;
  assigned_name text;
BEGIN
  assigned_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'patient');

  -- Disallow arbitrary or 'admin' roles at signup. Must be either 'patient' or 'provider'.
  IF assigned_role NOT IN ('patient', 'provider') THEN
    assigned_role := 'patient';
  END IF;

  INSERT INTO public.users (id, email, full_name, role, password, is_banned, created_at)
  VALUES (new.id, new.email, assigned_name, assigned_role, '', false, now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    -- Preserve existing role on conflict to prevent re-signup escalation
    role = public.users.role;

  IF assigned_role = 'provider' THEN
    INSERT INTO public.providers (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.patients (user_id, full_name)
    VALUES (new.id, assigned_name)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- PRIORITY 2: SERVER-SIDE STATUS AND DESTINATION INTEGRITY
-- ---------------------------------------------------------------------------

-- 2.1 Add arrival verification and audit columns to public.requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS arrival_distance_m double precision,
  ADD COLUMN IF NOT EXISTS arrival_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS arrival_override_reason text;

-- 2.2 Haversine formula calculation helper
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 6371000.0 * 2.0 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2.0)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lon2 - lon1) / 2.0)), 2)
  ));
$$;

-- 2.3 RPC mark_arrived: Secure server-side geofence verification
CREATE OR REPLACE FUNCTION public.mark_arrived(
  p_request_id uuid,
  p_session_id uuid DEFAULT NULL,
  p_override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_request     public.requests%ROWTYPE;
  v_loc         public.provider_locations%ROWTYPE;
  v_session     public.tracking_sessions%ROWTYPE;
  v_dist        double precision;
  v_accuracy    double precision;
  v_is_override boolean := false;
  v_now         timestamptz := now();
  v_loc_time    timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'request_not_found');
  END IF;

  -- Caller must be the assigned provider or an administrator
  IF NOT (v_request.provider_id = v_uid OR public.is_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_allowed');
  END IF;

  IF v_request.status <> 'On The Way' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_on_the_way', 'current_status', v_request.status);
  END IF;

  IF v_request.dest_lat IS NULL OR v_request.dest_lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_destination');
  END IF;

  SELECT * INTO v_loc FROM public.provider_locations WHERE request_id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_location');
  END IF;

  v_loc_time := COALESCE(v_loc.captured_at, v_loc.updated_at);
  v_accuracy := COALESCE(v_loc.accuracy, 999.0);
  v_dist := public.haversine_distance(v_loc.lat, v_loc.lng, v_request.dest_lat, v_request.dest_lng);

  -- Freshness check: must be captured/updated within 45 seconds
  IF v_loc_time < v_now - interval '45 seconds' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'stale_location',
      'distance_m', round(v_dist::numeric, 1),
      'accuracy_m', round(v_accuracy::numeric, 1),
      'age_seconds', extract(epoch from (v_now - v_loc_time))::integer
    );
  END IF;

  -- Accuracy check: hardware accuracy must be <= 150m
  IF v_accuracy > 150.0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'low_accuracy',
      'distance_m', round(v_dist::numeric, 1),
      'accuracy_m', round(v_accuracy::numeric, 1)
    );
  END IF;

  -- Geofence distance check: standard <= 50m
  IF v_dist > 50.0 THEN
    -- Fallback check: provider within 150m and session active for >= 3 minutes
    IF p_override_reason IS NOT NULL AND length(trim(p_override_reason)) > 0 AND v_dist <= 150.0 THEN
      SELECT * INTO v_session FROM public.tracking_sessions WHERE request_id = p_request_id;
      IF FOUND AND v_session.started_at <= v_now - interval '3 minutes' THEN
        v_is_override := true;
      ELSE
        RETURN jsonb_build_object(
          'ok', false,
          'reason', 'override_conditions_not_met',
          'distance_m', round(v_dist::numeric, 1),
          'accuracy_m', round(v_accuracy::numeric, 1)
        );
      END IF;
    ELSE
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'too_far',
        'distance_m', round(v_dist::numeric, 1),
        'accuracy_m', round(v_accuracy::numeric, 1)
      );
    END IF;
  END IF;

  -- Set transaction-local flags to authorize trigger modifications
  PERFORM set_config('app.via_rpc', 'true', true);
  PERFORM set_config('app.mark_arrived', 'true', true);

  UPDATE public.requests
     SET status = 'Arrived',
         arrived_at = v_now,
         arrival_distance_m = round(v_dist::numeric, 1),
         arrival_accuracy_m = round(v_accuracy::numeric, 1),
         arrival_override_reason = CASE WHEN v_is_override THEN trim(p_override_reason) ELSE NULL END
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'Arrived',
    'distance_m', round(v_dist::numeric, 1),
    'accuracy_m', round(v_accuracy::numeric, 1),
    'override', v_is_override
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_arrived(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_arrived(uuid, uuid, text) TO authenticated;

-- 2.4 Update destination RPCs with transaction-local authorization flag
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
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_request.patient_id = v_uid
    OR v_request.provider_id = v_uid
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
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

  PERFORM set_config('app.via_rpc', 'true', true);

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
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid destination coordinates' USING ERRCODE = '22023';
  END IF;

  IF v_source NOT IN ('manual', 'booking', 'patient_home') THEN
    v_source := 'manual';
  END IF;

  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_request.patient_id = v_uid OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the patient can update the visit destination' USING ERRCODE = '42501';
  END IF;

  IF v_request.status IN ('Arrived', 'Completed', 'Cancelled', 'Rejected') THEN
    RAISE EXCEPTION 'This visit is already closed' USING ERRCODE = '22000';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

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

REVOKE ALL ON FUNCTION public.prepare_tracking_destination(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_tracking_destination(uuid, double precision, double precision, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_tracking_destination(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tracking_destination(uuid, double precision, double precision, text, text) TO authenticated;

-- 2.5 Requests Integrity Trigger: Immutability, Destination RPC gating & Status Transition Map
CREATE OR REPLACE FUNCTION public.protect_requests_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_patient boolean;
  v_is_provider boolean;
  v_is_admin boolean;
BEGIN
  -- Service-role or SQL editor executions are unconstrained
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.is_admin();
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  v_is_patient := (OLD.patient_id = auth.uid());
  v_is_provider := (OLD.provider_id = auth.uid());

  -- 1. Immutable participant keys
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
    RAISE EXCEPTION 'Unauthorized: patient_id and provider_id are immutable'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Destination columns can only be modified via destination RPCs
  IF (NEW.dest_lat IS DISTINCT FROM OLD.dest_lat
      OR NEW.dest_lng IS DISTINCT FROM OLD.dest_lng
      OR NEW.dest_address IS DISTINCT FROM OLD.dest_address
      OR NEW.dest_source IS DISTINCT FROM OLD.dest_source
      OR NEW.dest_version IS DISTINCT FROM OLD.dest_version
      OR NEW.dest_updated_at IS DISTINCT FROM OLD.dest_updated_at) THEN
    IF current_setting('app.via_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Unauthorized: destination coordinates may only be modified via tracking RPCs'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Status changes: Validate transitions and protect 'Arrived'
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Setting status to Arrived is strictly reserved for the mark_arrived RPC
    IF NEW.status = 'Arrived' THEN
      IF current_setting('app.mark_arrived', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Unauthorized: status "Arrived" can only be set via the mark_arrived RPC'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Patient status transition enforcement
    IF v_is_patient THEN
      -- Patients can only transition to 'Cancelled' from non-terminal states
      IF NEW.status = 'Cancelled' AND OLD.status IN ('Pending', 'Accepted', 'On The Way') THEN
        NULL; -- Allowed
      ELSE
        RAISE EXCEPTION 'Unauthorized status transition by patient: % -> %', OLD.status, NEW.status
          USING ERRCODE = '42501';
      END IF;

    -- Provider status transition enforcement
    ELSIF v_is_provider THEN
      IF OLD.status IN ('Completed', 'Cancelled', 'Rejected') THEN
        RAISE EXCEPTION 'Unauthorized: cannot alter visit status once in terminal state (%)', OLD.status
          USING ERRCODE = '42501';
      END IF;

      CASE OLD.status
        WHEN 'Pending' THEN
          IF NEW.status NOT IN ('Accepted', 'Rejected') THEN
            RAISE EXCEPTION 'Invalid transition from Pending: %', NEW.status USING ERRCODE = '42501';
          END IF;
        WHEN 'Accepted' THEN
          IF NEW.status NOT IN ('On The Way', 'Cancelled', 'Rejected') THEN
            RAISE EXCEPTION 'Invalid transition from Accepted: %', NEW.status USING ERRCODE = '42501';
          END IF;
        WHEN 'On The Way' THEN
          IF NEW.status NOT IN ('Arrived', 'Cancelled') THEN
            RAISE EXCEPTION 'Invalid transition from On The Way: %', NEW.status USING ERRCODE = '42501';
          END IF;
        WHEN 'Arrived' THEN
          IF NEW.status NOT IN ('Completed', 'Cancelled') THEN
            RAISE EXCEPTION 'Invalid transition from Arrived: %', NEW.status USING ERRCODE = '42501';
          END IF;
        ELSE
          RAISE EXCEPTION 'Unrecognized current status: %', OLD.status USING ERRCODE = '42501';
      END CASE;
    ELSE
      RAISE EXCEPTION 'Unauthorized: caller is not an assigned party on this request'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_requests_integrity ON public.requests;
CREATE TRIGGER trg_protect_requests_integrity
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_requests_integrity();

-- 2.6 Protect new booking creation: prevent duplicate active/ongoing bookings between patient and provider
CREATE OR REPLACE FUNCTION public.validate_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
BEGIN
  -- Apply checks when an authenticated client (not admin/service_role) creates a request
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    -- Patient must be the inserting user
    IF NEW.patient_id != auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: cannot create a booking on behalf of another user'
        USING ERRCODE = '42501';
    END IF;

    -- Cannot book with self
    IF NEW.provider_id = auth.uid() THEN
      RAISE EXCEPTION 'Cannot book an appointment with yourself'
        USING ERRCODE = '42501';
    END IF;

    -- Ensure initial status is always Pending
    IF NEW.status IS DISTINCT FROM 'Pending' THEN
      NEW.status := 'Pending';
    END IF;

    -- Prevent multiple active or ongoing bookings between the same patient and provider
    IF EXISTS (
      SELECT 1 FROM public.requests
      WHERE patient_id = NEW.patient_id
        AND provider_id = NEW.provider_id
        AND status IN ('Pending', 'Accepted', 'On The Way', 'Arrived')
    ) THEN
      RAISE EXCEPTION 'You already have an active or ongoing booking with this provider'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$;

REVOKE ALL ON FUNCTION public.validate_new_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_new_request() TO authenticated;

DROP TRIGGER IF EXISTS trg_validate_new_request ON public.requests;
CREATE TRIGGER trg_validate_new_request
  BEFORE INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_new_request();


-- ---------------------------------------------------------------------------
-- PRIORITY 3: SESSION OWNERSHIP AND ERROR HANDLING
-- ---------------------------------------------------------------------------

-- 3.1 start_tracking_session with session conflict detection & takeover parameter
-- Drop older 2-argument signature to prevent PGRST203 function overloading ambiguity
DROP FUNCTION IF EXISTS public.start_tracking_session(uuid, uuid);

CREATE OR REPLACE FUNCTION public.start_tracking_session(
  p_request_id uuid,
  p_session_id uuid DEFAULT gen_random_uuid(),
  p_takeover   boolean DEFAULT false
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
  v_existing  public.tracking_sessions%ROWTYPE;
  v_now       timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;

  v_provider := v_request.provider_id;
  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'This visit has no assigned provider' USING ERRCODE = '22000';
  END IF;
  IF NOT (v_provider = v_uid OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF v_request.status <> 'On The Way' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'not_on_the_way',
      'message', 'Tracking is only allowed while On The Way',
      'status', 'ended'
    );
  END IF;

  -- Multi-device conflict check: if another active session has checked in within 60s
  SELECT * INTO v_existing FROM public.tracking_sessions WHERE request_id = p_request_id;
  IF FOUND AND v_existing.status = 'active'
     AND v_existing.session_id <> p_session_id
     AND v_existing.last_seen_at > v_now - interval '60 seconds'
     AND NOT p_takeover THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'session_active_elsewhere',
      'message', 'Tracking is active on another device.',
      'last_seen_at', v_existing.last_seen_at
    );
  END IF;

  -- Reset locations for the fresh session
  DELETE FROM public.provider_locations WHERE request_id = p_request_id;

  INSERT INTO public.tracking_sessions (
    request_id, session_id, provider_id, status, started_at, last_seen_at
  )
  VALUES (
    p_request_id, p_session_id, v_provider, 'active', v_now, v_now
  )
  ON CONFLICT (request_id) DO UPDATE
    SET session_id = EXCLUDED.session_id,
        provider_id = EXCLUDED.provider_id,
        status = 'active',
        started_at = v_now,
        last_seen_at = v_now,
        ended_at = NULL,
        stop_reason = NULL
  RETURNING started_at INTO v_started;

  PERFORM set_config('app.via_rpc', 'true', true);

  UPDATE public.requests
     SET route_started_at = COALESCE(route_started_at, v_now)
   WHERE id = p_request_id
   RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'ok', true,
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

-- 3.2 touch_tracking_session with strict session check
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
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
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

-- 3.3 end_tracking_session
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
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.start_tracking_session(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_tracking_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_tracking_session(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_tracking_session(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_tracking_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_tracking_session(uuid, uuid, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- PRIORITY 4: PRODUCTION PARITY, REALTIME & RETENTION
-- ---------------------------------------------------------------------------

-- 4.1 Strict input validation in record_provider_location
CREATE OR REPLACE FUNCTION public.record_provider_location(
  p_request_id   uuid,
  p_session_id   uuid,
  p_seq          bigint,
  p_lat          double precision,
  p_lng          double precision,
  p_accuracy     double precision DEFAULT NULL,
  p_heading      double precision DEFAULT NULL,
  p_speed        double precision DEFAULT NULL,
  p_captured_at  timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_accepted  boolean;
  v_captured  timestamptz := COALESCE(p_captured_at, now());
  v_session   public.tracking_sessions%ROWTYPE;
  v_now       timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_seq IS NULL OR p_seq < 1 THEN
    RETURN false;
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90.0 OR p_lat > 90.0
     OR p_lng < -180.0 OR p_lng > 180.0 THEN
    RETURN false;
  END IF;

  -- Validate accuracy (>= 0 and plausible)
  IF p_accuracy IS NOT NULL AND (p_accuracy < 0 OR p_accuracy > 5000.0) THEN
    RETURN false;
  END IF;

  -- Validate heading (0 to 360)
  IF p_heading IS NOT NULL AND (p_heading < 0 OR p_heading > 360.0) THEN
    RETURN false;
  END IF;

  -- Validate speed (>= 0 and plausible max 100 m/s = 360 km/h)
  IF p_speed IS NOT NULL AND (p_speed < 0 OR p_speed > 100.0) THEN
    RETURN false;
  END IF;

  -- Active session verification
  SELECT * INTO v_session FROM public.tracking_sessions
   WHERE request_id = p_request_id
     AND session_id = p_session_id
     AND status = 'active'
     AND (provider_id = auth.uid() OR public.is_admin());

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Validate captured_at: reject older than session start or > 2 min in future
  IF v_captured > v_now + interval '2 minutes' THEN
    v_captured := v_now;
  END IF;
  IF v_captured < v_session.started_at - interval '30 seconds' THEN
    RETURN false;
  END IF;

  INSERT INTO public.provider_locations (
    request_id, provider_id, lat, lng, accuracy, heading, speed,
    session_id, seq, captured_at, updated_at
  )
  VALUES (
    p_request_id, auth.uid(), p_lat, p_lng, p_accuracy, p_heading, p_speed,
    p_session_id, p_seq, v_captured, v_now
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
        updated_at = v_now
    WHERE public.provider_locations.session_id IS DISTINCT FROM EXCLUDED.session_id
       OR public.provider_locations.seq IS NULL
       OR EXCLUDED.seq > public.provider_locations.seq
  RETURNING true INTO v_accepted;

  IF v_accepted IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.tracking_sessions
     SET last_seen_at = v_now
   WHERE request_id = p_request_id
     AND session_id = p_session_id
     AND status = 'active';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_provider_location(uuid, uuid, bigint, double precision, double precision, double precision, double precision, double precision, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_provider_location(uuid, uuid, bigint, double precision, double precision, double precision, double precision, double precision, timestamptz) TO authenticated;

-- 4.2 Comprehensive cleanup trigger: fires whenever leaving 'On The Way'
CREATE OR REPLACE FUNCTION public.cleanup_provider_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If request leaves 'On The Way' OR transitions to a closed/terminal state
  IF (OLD.status = 'On The Way' AND NEW.status <> 'On The Way')
     OR NEW.status IN ('Arrived', 'Completed', 'Cancelled', 'Rejected') THEN

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
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_provider_location();

-- 4.3 Stale Session Expiry: Purges locations for all non-active sessions
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

  -- Delete provider locations for any session that is not active
  DELETE FROM public.provider_locations pl
   USING public.tracking_sessions ts
   WHERE pl.request_id = ts.request_id
     AND ts.status <> 'active';

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_tracking_sessions(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_tracking_sessions(interval) TO service_role;

-- 4.4 Realtime Regex Optimized Policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    BEGIN
      DROP POLICY IF EXISTS munticares_tracking_realtime_select ON realtime.messages;
      CREATE POLICY munticares_tracking_realtime_select
        ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          (SELECT realtime.topic()) ~ '^tracking:[0-9a-fA-F-]{36}$'
          AND EXISTS (
            SELECT 1 FROM public.requests r
             WHERE r.id = substring((SELECT realtime.topic()) from 10)::uuid
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
          (SELECT realtime.topic()) ~ '^tracking:[0-9a-fA-F-]{36}$'
          AND EXISTS (
            SELECT 1
              FROM public.tracking_sessions ts
              JOIN public.requests r ON r.id = ts.request_id
             WHERE r.id = substring((SELECT realtime.topic()) from 10)::uuid
               AND ts.status = 'active'
               AND ts.provider_id = auth.uid()
          )
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Realtime messages policy setup notice: %', SQLERRM;
    END;
  END IF;
END $$;

-- 4.5 Clean up legacy policies & enforce zero mutation on provider_locations / tracking_sessions
DROP POLICY IF EXISTS locations_select_policy ON public.provider_locations;
DROP POLICY IF EXISTS locations_upsert_provider ON public.provider_locations;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tracking_sessions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.provider_locations FROM authenticated, anon;
GRANT SELECT ON TABLE public.tracking_sessions TO authenticated;
GRANT SELECT ON TABLE public.provider_locations TO authenticated;

-- 4.6 Guarded pg_cron setup for stale session expiration
DO $cron_setup$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron extension not available: %', SQLERRM;
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
      RAISE NOTICE 'pg_cron schedule notice: %', SQLERRM;
    END;
  END IF;
END;
$cron_setup$;

NOTIFY pgrst, 'reload schema';

