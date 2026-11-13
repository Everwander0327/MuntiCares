-- Save the request and consent together using the authenticated caller's RLS.
BEGIN;
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
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.requests (
    patient_id, provider_id, service, duration_minutes, date, time, status, notes,
    dest_lat, dest_lng, dest_address, dest_source, dest_version, dest_updated_at
  ) VALUES (
    v_patient_id, p_provider_id, p_service, p_duration_minutes, p_date, p_time,
    'Pending', p_notes, p_dest_lat, p_dest_lng, p_dest_address, 'booking', 1, now()
  ) RETURNING id INTO v_request_id;

  -- Keep the patient's chosen categories and any still-valid expiry.
  -- The active patient/provider unique index serializes competing bookings.
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

  -- Let every error propagate so PostgreSQL rolls back both writes.
  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_visit_with_consent(
  uuid, text, integer, date, time, text, double precision, double precision, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_visit_with_consent(
  uuid, text, integer, date, time, text, double precision, double precision, text
) TO authenticated;
COMMIT;
