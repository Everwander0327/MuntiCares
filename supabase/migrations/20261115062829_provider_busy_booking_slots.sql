-- Private booking slot availability RPC.
-- Returns the minimum time data patients need to avoid already occupied slots.
CREATE OR REPLACE FUNCTION public.get_provider_busy_booking_slots(
  p_provider_id uuid,
  p_date date
)
RETURNS TABLE ("time" time, duration_minutes integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.time, r.duration_minutes
  FROM public.requests AS r
  JOIN public.providers AS p ON p.user_id = r.provider_id
  WHERE r.provider_id = p_provider_id
    AND r.date = p_date
    AND p.is_approved IS TRUE
    AND r.status IN ('Pending', 'Accepted', 'On The Way', 'Arrived');
END;
$$;

COMMENT ON FUNCTION public.get_provider_busy_booking_slots(uuid, date) IS
  'Returns only occupied appointment times and durations for an approved provider; hides request and patient data.';

REVOKE ALL ON FUNCTION public.get_provider_busy_booking_slots(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_busy_booking_slots(uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';

