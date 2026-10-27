-- Manual arrival override for providers on site with unusable GPS.
--
-- Previously mark_arrived only accepted an override inside 150 m after 3
-- minutes of tracking, and always rejected hardware accuracy above 150 m.
-- Indoor fixes are routinely 150-300 m, which left providers unable to confirm
-- arrival while standing in the patient's home.
--
-- Passing a non-empty p_override_reason now attests "provider is on site" and
-- bypasses the freshness/accuracy/distance gates. The caller must still be the
-- assigned provider (or admin), the visit must be On The Way, and a destination
-- must exist. Distance/accuracy are still recorded when a fix is available, and
-- the reason is stored in requests.arrival_override_reason for audit.

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
  v_dist        double precision;
  v_accuracy    double precision;
  v_has_loc     boolean := false;
  v_is_override boolean := false;
  v_reason      text := NULLIF(trim(COALESCE(p_override_reason, '')), '');
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
  v_has_loc := FOUND;

  IF v_has_loc THEN
    v_loc_time := COALESCE(v_loc.captured_at, v_loc.updated_at);
    v_accuracy := COALESCE(v_loc.accuracy, 999.0);
    v_dist := public.haversine_distance(v_loc.lat, v_loc.lng, v_request.dest_lat, v_request.dest_lng);
  END IF;

  IF v_reason IS NOT NULL THEN
    -- Manual on-site attestation. No location, freshness, accuracy or distance
    -- gate applies; the override is audited below.
    v_is_override := true;
  ELSE
    IF NOT v_has_loc THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_location');
    END IF;

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

    -- Geofence distance check: <= 50m
    IF v_dist > 50.0 THEN
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
         arrival_distance_m = CASE WHEN v_has_loc THEN round(v_dist::numeric, 1) ELSE NULL END,
         arrival_accuracy_m = CASE WHEN v_has_loc THEN round(v_accuracy::numeric, 1) ELSE NULL END,
         arrival_override_reason = CASE WHEN v_is_override THEN v_reason ELSE NULL END
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'Arrived',
    'distance_m', CASE WHEN v_has_loc THEN round(v_dist::numeric, 1) ELSE NULL END,
    'accuracy_m', CASE WHEN v_has_loc THEN round(v_accuracy::numeric, 1) ELSE NULL END,
    'override', v_is_override
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_arrived(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_arrived(uuid, uuid, text) TO authenticated;
