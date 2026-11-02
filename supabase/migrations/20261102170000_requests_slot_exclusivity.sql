-- ============================================================
-- Migration: Appointment slot exclusivity
-- ============================================================
-- Booking was a client-side check-then-insert: two patients asking for the same
-- provider-hour both passed the check, and a provider could accept both. Nothing in
-- the schema said a slot belongs to someone. These constraints make that a server
-- rule the client can no longer race past.
-- ============================================================

-- One live booking per provider per date+time. Slots come from the picker as whole
-- hours, so equality is the right granularity; the client still compares minutes
-- (src/lib/localDate.js slotsOverlap) for any legacy non-hour value.
CREATE UNIQUE INDEX IF NOT EXISTS requests_slot_exclusive
  ON public.requests (provider_id, date, time)
  WHERE status IN ('Pending', 'Accepted', 'On The Way', 'Arrived');

-- A patient holds at most one live visit with the same provider.
CREATE UNIQUE INDEX IF NOT EXISTS requests_one_live_per_pair
  ON public.requests (patient_id, provider_id)
  WHERE status IN ('Pending', 'Accepted', 'On The Way', 'Arrived');

COMMENT ON INDEX public.requests_slot_exclusive IS
  'A provider cannot hold two live bookings in the same slot. Insert conflicts (23505) mean the slot was taken.';

-- Index for the availability query every booking screen runs.
CREATE INDEX IF NOT EXISTS requests_provider_date_status_idx
  ON public.requests (provider_id, date, status);
