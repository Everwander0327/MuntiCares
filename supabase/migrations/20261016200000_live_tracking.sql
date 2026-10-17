-- Live GPS tracking for providers that are "On The Way"

-- 1. Patient home coordinates (geocoded via Nominatim or pinned manually)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- 2. Snapshot of destination + route timestamps on each visit
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS dest_lat double precision,
  ADD COLUMN IF NOT EXISTS dest_lng double precision,
  ADD COLUMN IF NOT EXISTS route_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

-- 3. Latest provider position per visit (one row, upserted)
CREATE TABLE IF NOT EXISTS public.provider_locations (
  request_id  uuid PRIMARY KEY REFERENCES public.requests(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  accuracy    double precision,
  heading     double precision,
  speed       double precision,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_locations_provider_idx ON public.provider_locations(provider_id);

-- Match project convention (RLS disabled, see 20261014230000_disable_rls_all.sql)
ALTER TABLE public.provider_locations DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.provider_locations TO anon, authenticated, service_role;
ALTER TABLE public.provider_locations REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Privacy: drop live location once the visit is no longer en route
CREATE OR REPLACE FUNCTION public.cleanup_provider_location()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('Completed', 'Cancelled', 'Rejected') THEN
    DELETE FROM public.provider_locations WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cleanup_provider_location ON public.requests;
CREATE TRIGGER trg_cleanup_provider_location
  AFTER UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_provider_location();
