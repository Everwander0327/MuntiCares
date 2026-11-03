-- ============================================================
-- Migration: Service-Based Duration & Exclusion Constraint (Phase 1)
-- ============================================================

-- 1. Enable btree_gist extension (required for GiST indexing of scalar uuid provider_id)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Add duration_minutes column to public.requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30
  CHECK (duration_minutes > 0 AND duration_minutes <= 480);

COMMENT ON COLUMN public.requests.duration_minutes IS
  'Duration of the home-care visit in minutes (30, 60, etc.). Defaults to 30.';

-- 3. Immutable helper function for GiST index range computation
-- In PostgreSQL, timestamp + interval is STABLE in standard catalog definitions.
-- An IMMUTABLE helper function is required to construct the half-open tsrange [start, end)
-- within GiST index and exclusion constraint definitions.
CREATE OR REPLACE FUNCTION public.request_slot_range(p_date date, p_time time, p_duration_minutes integer)
RETURNS tsrange
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT tsrange(
    (p_date + p_time),
    (p_date + p_time + (COALESCE(p_duration_minutes, 30) * INTERVAL '1 minute')),
    '[)'
  );
$$;

COMMENT ON FUNCTION public.request_slot_range(date, time, integer) IS
  'Calculates the half-open timestamp range [start, start + duration) for a request. IMMUTABLE for index use.';

-- 4. Drop the old partial unique index (requests_slot_exclusive)
-- Why: requests_slot_exclusive only checked exact start-time equality (date, time).
-- With variable durations (e.g., 60-min visits), a unique index on start time allows a
-- 10:30 booking to collide with an active 10:00-11:00 booking. The GiST exclusion constraint
-- strictly subsumes this by forbidding any overlapping time range for active bookings.
DROP INDEX IF EXISTS public.requests_slot_exclusive;

-- 5. Add GiST Exclusion Constraint to prevent overlapping active visits
-- Active statuses: 'Pending', 'Accepted', 'On The Way', 'Arrived'
-- Exclusion constraint triggers PostgreSQL error 23P01 (exclusion_violation) on race conditions.
ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_active_slot_exclude;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_active_slot_exclude
  EXCLUDE USING gist (
    provider_id WITH =,
    public.request_slot_range(date, time, duration_minutes) WITH &&
  )
  WHERE (status IN ('Pending', 'Accepted', 'On The Way', 'Arrived'));

-- 6. RPC: Provider Duration Extension / Override
-- Enforces:
--   a) Caller is authenticated and is the assigned provider (or admin)
--   b) Visit is in active, extensible status ('Accepted', 'On The Way', 'Arrived')
--   c) Working hours cutoff: visit start + duration must not exceed 17:00 (5:00 PM)
--   d) Row-level locking (FOR UPDATE) to prevent concurrent extension / double-booking races
--   e) Conflict check against any other active visit for this provider
CREATE OR REPLACE FUNCTION public.provider_extend_request_duration(
  p_request_id uuid,
  p_additional_minutes integer DEFAULT NULL,
  p_new_duration_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_req public.requests%ROWTYPE;
  v_new_duration integer;
  v_end_time time;
  v_conflict_id uuid;
  v_clinic_close time := '17:00:00'::time;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated', 'message', 'Sign in required.');
  END IF;

  -- 1. Fetch request with row-level lock
  SELECT * INTO v_req
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Visit request not found.');
  END IF;

  -- 2. Authorization check
  IF v_req.provider_id <> v_caller_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Only the assigned provider can adjust visit duration.');
  END IF;

  -- 3. Status check: only active visits can be extended
  IF v_req.status NOT IN ('Accepted', 'On The Way', 'Arrived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'message', 'Duration can only be adjusted for active visits.');
  END IF;

  -- 4. Calculate target duration
  IF p_new_duration_minutes IS NOT NULL THEN
    v_new_duration := p_new_duration_minutes;
  ELSIF p_additional_minutes IS NOT NULL THEN
    v_new_duration := COALESCE(v_req.duration_minutes, 30) + p_additional_minutes;
  ELSE
    v_new_duration := COALESCE(v_req.duration_minutes, 30) + 30;
  END IF;

  -- 5. Validation: 30-min increments, bounds, and must be greater than current
  IF v_new_duration <= COALESCE(v_req.duration_minutes, 30) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_duration', 'message', 'Extended duration must be greater than current duration.');
  END IF;

  IF (v_new_duration % 30) <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_step', 'message', 'Duration must be in 30-minute increments.');
  END IF;

  IF v_new_duration > 240 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_duration_exceeded', 'message', 'Maximum visit duration is 4 hours.');
  END IF;

  -- 6. Working hours cutoff check (cannot extend past 17:00 / 5:00 PM)
  v_end_time := v_req.time + (v_new_duration * INTERVAL '1 minute');
  IF v_end_time > v_clinic_close THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'exceeds_working_hours',
      'message', format('Extended visit would finish at %s, which exceeds provider clinic hours (5:00 PM).', to_char(v_end_time, 'HH12:MI AM'))
    );
  END IF;

  -- 7. Conflict check against other active bookings for this provider
  SELECT id INTO v_conflict_id
  FROM public.requests
  WHERE provider_id = v_req.provider_id
    AND id <> v_req.id
    AND status IN ('Pending', 'Accepted', 'On The Way', 'Arrived')
    AND public.request_slot_range(date, time, duration_minutes) && public.request_slot_range(v_req.date, v_req.time, v_new_duration)
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'slot_conflict',
      'message', 'Cannot extend duration: the extended window conflicts with another scheduled visit.'
    );
  END IF;

  -- 8. Apply extension
  UPDATE public.requests
  SET duration_minutes = v_new_duration
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_request_id,
    'previous_duration_minutes', v_req.duration_minutes,
    'new_duration_minutes', v_new_duration,
    'end_time', to_char(v_end_time, 'HH12:MI AM')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provider_extend_request_duration(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_extend_request_duration(uuid, integer, integer) TO authenticated;

