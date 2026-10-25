-- ===========================================================================
-- MuntiCares: SQL Verification Test Suite for Live Tracking & Security
-- Run this in the Supabase SQL Editor. Every test executes in an isolated transaction
-- that rolls back, ensuring zero side-effects on existing data.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- TEST 1: Privilege Escalation Guard on public.users
-- Expectation: Non-admin update to role fails with 42501
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_patient_id uuid;
  v_failed boolean := false;
BEGIN
  -- Pick or create a non-admin patient test user
  SELECT id INTO v_patient_id FROM public.users WHERE role = 'patient' LIMIT 1;
  IF v_patient_id IS NULL THEN
    RAISE NOTICE 'Skipping Test 1: No patient user found in database.';
    RETURN;
  END IF;

  -- Simulate authenticated session as the patient
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_patient_id::text, true);

  BEGIN
    UPDATE public.users SET role = 'admin' WHERE id = v_patient_id;
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Non-admin user was able to escalate role to admin!';
  ELSE
    RAISE NOTICE 'TEST 1 PASSED: Non-admin role escalation blocked with SQLSTATE 42501.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- TEST 2: Direct Request Mutation & Status 'Arrived' Protection
-- Expectation: Direct update to status = 'Arrived' fails with 42501
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_provider_id uuid;
  v_req_id uuid;
  v_failed boolean := false;
BEGIN
  SELECT id INTO v_provider_id FROM public.users WHERE role = 'provider' LIMIT 1;
  IF v_provider_id IS NULL THEN
    RAISE NOTICE 'Skipping Test 2: No provider found.';
    RETURN;
  END IF;

  SELECT id INTO v_req_id FROM public.requests WHERE provider_id = v_provider_id AND status = 'On The Way' LIMIT 1;
  IF v_req_id IS NULL THEN
    SELECT id INTO v_req_id FROM public.requests WHERE provider_id = v_provider_id LIMIT 1;
  END IF;

  IF v_req_id IS NULL THEN
    RAISE NOTICE 'Skipping Test 2: No request found for provider.';
    RETURN;
  END IF;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_provider_id::text, true);

  BEGIN
    UPDATE public.requests SET status = 'Arrived' WHERE id = v_req_id;
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Direct status update to "Arrived" was permitted without mark_arrived RPC!';
  ELSE
    RAISE NOTICE 'TEST 2 PASSED: Direct status update to "Arrived" strictly blocked.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- TEST 3: Immutable Keys & Destination Direct Edit Protection
-- Expectation: Direct update to dest_lat or provider_id fails with 42501
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_req public.requests%ROWTYPE;
  v_failed_dest boolean := false;
  v_failed_prov boolean := false;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE status IN ('Pending', 'Accepted', 'On The Way') LIMIT 1;
  IF NOT FOUND THEN
    RAISE NOTICE 'Skipping Test 3: No active request found.';
    RETURN;
  END IF;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_req.patient_id::text, true);

  -- Try direct dest_lat modification:
  BEGIN
    UPDATE public.requests SET dest_lat = 14.5000 WHERE id = v_req.id;
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    v_failed_dest := true;
  END;

  -- Try direct provider_id modification:
  BEGIN
    UPDATE public.requests SET provider_id = gen_random_uuid() WHERE id = v_req.id;
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    v_failed_prov := true;
  END;

  IF NOT v_failed_dest OR NOT v_failed_prov THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Direct modification of immutable keys or destination was allowed!';
  ELSE
    RAISE NOTICE 'TEST 3 PASSED: Direct destination and immutable key modifications blocked.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- TEST 4: mark_arrived Geofence & Freshness Validation
-- Expectation: Rejects too_far (>50m) and stale fixes; succeeds at <=50m
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_req_id uuid := gen_random_uuid();
  v_prov_id uuid := gen_random_uuid();
  v_pat_id uuid := gen_random_uuid();
  v_sess_id uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  -- Insert mock test entities
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (v_prov_id, 'prov.test@example.com', 'Test Provider', 'provider'),
         (v_pat_id, 'pat.test@example.com', 'Test Patient', 'patient');

  INSERT INTO public.requests (
    id, patient_id, provider_id, status, dest_lat, dest_lng, dest_version
  )
  VALUES (
    v_req_id, v_pat_id, v_prov_id, 'On The Way', 14.4000, 121.0400, 1
  );

  INSERT INTO public.tracking_sessions (request_id, session_id, provider_id, status, started_at, last_seen_at)
  VALUES (v_req_id, v_sess_id, v_prov_id, 'active', now(), now());

  -- Case 4a: Stale location (>45s)
  INSERT INTO public.provider_locations (
    request_id, provider_id, lat, lng, accuracy, session_id, seq, captured_at, updated_at
  )
  VALUES (
    v_req_id, v_prov_id, 14.40001, 121.04001, 15.0, v_sess_id, 1, now() - interval '60 seconds', now() - interval '60 seconds'
  );

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_prov_id::text, true);

  v_res := public.mark_arrived(v_req_id, v_sess_id);
  IF (v_res->>'ok')::boolean = true OR v_res->>'reason' <> 'stale_location' THEN
    RAISE EXCEPTION 'TEST 4a FAILED: mark_arrived accepted stale location: %', v_res;
  END IF;

  -- Case 4b: Too far (>50m)
  -- 0.001 deg lat is ~111m
  UPDATE public.provider_locations
     SET lat = 14.4010, lng = 121.0400, captured_at = now(), updated_at = now()
   WHERE request_id = v_req_id;

  v_res := public.mark_arrived(v_req_id, v_sess_id);
  IF (v_res->>'ok')::boolean = true OR v_res->>'reason' <> 'too_far' THEN
    RAISE EXCEPTION 'TEST 4b FAILED: mark_arrived accepted position > 50m away: %', v_res;
  END IF;

  -- Case 4c: Success (within 20m, fresh, accuracy = 10m)
  -- 0.0001 deg lat is ~11m
  UPDATE public.provider_locations
     SET lat = 14.4001, lng = 121.0400, accuracy = 10.0, captured_at = now(), updated_at = now()
   WHERE request_id = v_req_id;

  v_res := public.mark_arrived(v_req_id, v_sess_id);
  IF (v_res->>'ok')::boolean <> true THEN
    RAISE EXCEPTION 'TEST 4c FAILED: mark_arrived rejected valid arrival: %', v_res;
  END IF;

  -- Verify cleanup trigger fired: provider_locations row must be purged on Arrival
  IF EXISTS (SELECT 1 FROM public.provider_locations WHERE request_id = v_req_id) THEN
    RAISE EXCEPTION 'TEST 4d FAILED: cleanup trigger failed to delete provider_locations on arrival!';
  END IF;

  RAISE NOTICE 'TEST 4 PASSED: mark_arrived correctly enforces geofence, freshness, and trigger cleanup.';

  -- Rollback test entities
  RAISE EXCEPTION 'ROLLBACK_MOCK_DATA' USING ERRCODE = 'P0000';
EXCEPTION WHEN SQLSTATE 'P0000' THEN
  -- Clean rollback
END $$;


-- ---------------------------------------------------------------------------
-- TEST 5: Multi-Device Conflict Detection
-- Expectation: start_tracking_session rejects silent takeover from Device B
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_req_id uuid := gen_random_uuid();
  v_prov_id uuid := gen_random_uuid();
  v_pat_id uuid := gen_random_uuid();
  v_sess_a uuid := gen_random_uuid();
  v_sess_b uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (v_prov_id, 'prov.device@example.com', 'Device Provider', 'provider'),
         (v_pat_id, 'pat.device@example.com', 'Device Patient', 'patient');

  INSERT INTO public.requests (id, patient_id, provider_id, status)
  VALUES (v_req_id, v_pat_id, v_prov_id, 'On The Way');

  -- Device A starts session
  INSERT INTO public.tracking_sessions (request_id, session_id, provider_id, status, started_at, last_seen_at)
  VALUES (v_req_id, v_sess_a, v_prov_id, 'active', now(), now());

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_prov_id::text, true);

  -- Device B attempts to start session without takeover flag:
  v_res := public.start_tracking_session(v_req_id, v_sess_b, false);
  IF (v_res->>'ok')::boolean = true OR v_res->>'error' <> 'session_active_elsewhere' THEN
    RAISE EXCEPTION 'TEST 5a FAILED: Device B was allowed to silently overwrite active session: %', v_res;
  END IF;

  -- Device B attempts with takeover = true:
  v_res := public.start_tracking_session(v_req_id, v_sess_b, true);
  IF (v_res->>'ok')::boolean <> true THEN
    RAISE EXCEPTION 'TEST 5b FAILED: Explicit takeover was rejected: %', v_res;
  END IF;

  RAISE NOTICE 'TEST 5 PASSED: Session conflict detection and explicit takeover behave as expected.';

  RAISE EXCEPTION 'ROLLBACK_MOCK_DATA' USING ERRCODE = 'P0000';
EXCEPTION WHEN SQLSTATE 'P0000' THEN
  -- Clean rollback
END $$;

