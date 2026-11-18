-- PROPOSED ONLY. Do not apply until reviewed and explicitly approved.
-- Replaces book_visit_with_consent while preserving its atomic request + consent transaction.
CREATE OR REPLACE FUNCTION public.book_visit_with_consent(
  p_provider_id uuid,
  p_service text,
  p_duration_minutes integer,
  p_date date,
  p_time time,
  p_notes text,
  p_dest_lat double precision,
  p_dest_lng double precision,
  p_dest_address text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_patient_id uuid := auth.uid();
  v_request_id uuid;
  v_provider public.providers%ROWTYPE;
  v_service_duration integer := 30;
  v_local_now timestamp := timezone('Asia/Manila', now());
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_provider_id IS NULL OR p_provider_id = v_patient_id THEN
    RAISE EXCEPTION 'Choose an eligible provider' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_provider
  FROM public.providers
  WHERE user_id = p_provider_id AND COALESCE(is_approved, false);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider is not eligible for booking' USING ERRCODE = '22023';
  END IF;

  IF p_service IS NULL OR btrim(p_service) = ''
     OR NOT (btrim(p_service) = ANY(COALESCE(v_provider.services, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Choose a service offered by this provider' USING ERRCODE = '22023';
  END IF;

  -- Match the repository's getServiceDurationMinutes mapping and fallback.
  SELECT x.minutes
    INTO v_service_duration
  FROM (VALUES
    (1,'General Consultation',30), (2,'General Care',30), (3,'Vital Signs Monitoring',30),
    (4,'Vital Signs & Wellness',30), (5,'Medication Administration',30),
    (6,'Elderly Care',60), (7,'Nursing Care',60), (8,'Post-Operative Care',60),
    (9,'Post-Operative Nursing',60), (10,'Physical Therapy',60), (11,'Wound Dressing',60),
    (12,'Wound Care',60), (13,'Complex Wound Care',60)
  ) AS x(mapping_order, service_name, minutes)
  WHERE lower(btrim(p_service)) LIKE '%' || lower(x.service_name) || '%'
     OR lower(x.service_name) LIKE '%' || lower(btrim(p_service)) || '%'
  ORDER BY x.mapping_order
  LIMIT 1;
  v_service_duration := COALESCE(v_service_duration, 30);

  IF p_duration_minutes IS DISTINCT FROM v_service_duration THEN
    RAISE EXCEPTION 'Duration does not match the selected service' USING ERRCODE = '22023';
  END IF;
  IF p_duration_minutes <= 0 OR p_duration_minutes > 480 THEN
    RAISE EXCEPTION 'Invalid visit duration' USING ERRCODE = '22023';
  END IF;

  IF p_date IS NULL OR p_date < v_local_now::date
     OR extract(isodow FROM p_date) NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'Choose a valid Monday to Saturday booking date' USING ERRCODE = '22023';
  END IF;
  IF p_time IS NULL OR p_time < time '09:00' OR p_time >= time '17:00'
     OR mod(extract(epoch FROM p_time)::integer, 1800) <> 0
     OR p_time + make_interval(mins => p_duration_minutes) > time '17:00' THEN
    RAISE EXCEPTION 'Choose a 30-minute booking slot within 9:00 AM to 5:00 PM' USING ERRCODE = '22023';
  END IF;
  IF (p_date + p_time) <= v_local_now THEN
    RAISE EXCEPTION 'Choose a future booking time' USING ERRCODE = '22023';
  END IF;

  IF p_dest_lat IS NULL OR p_dest_lng IS NULL
     OR p_dest_lat NOT BETWEEN -90 AND 90 OR p_dest_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Provide a valid visit location' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.requests (
    patient_id, provider_id, service, duration_minutes, date, time, status, notes,
    dest_lat, dest_lng, dest_address, dest_source, dest_version, dest_updated_at
  ) VALUES (
    v_patient_id, p_provider_id, btrim(p_service), p_duration_minutes, p_date, p_time,
    'Pending', p_notes, p_dest_lat, p_dest_lng, p_dest_address, 'booking', 1, now()
  ) RETURNING id INTO v_request_id;

  UPDATE public.consent_access
  SET is_enabled = true,
      expires_at = CASE WHEN expires_at > now() THEN expires_at
                        ELSE now() + interval '90 days' END
  WHERE patient_id = v_patient_id AND provider_id = p_provider_id;

  IF NOT FOUND THEN
    INSERT INTO public.consent_access (
      patient_id, provider_id, is_enabled, expires_at, permissions
    ) VALUES (
      v_patient_id, p_provider_id, true, now() + interval '90 days',
      '{"medical_history":true,"documents":false,"visit_notes":false}'::jsonb
    );
  END IF;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_visit_with_consent(
  uuid, text, integer, date, time, text, double precision, double precision, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_visit_with_consent(
  uuid, text, integer, date, time, text, double precision, double precision, text
) TO authenticated;
