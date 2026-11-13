-- Minimal isolated schema for booking verification; never run against hosted data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), public.is_admin() TO anon, authenticated;
CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL, provider_id uuid NOT NULL,
  service text NOT NULL, date date NOT NULL, time time NOT NULL,
  status text NOT NULL, notes text,
  dest_lat double precision, dest_lng double precision, dest_address text,
  dest_source text, dest_version integer, dest_updated_at timestamptz
);
CREATE TABLE public.consent_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL, provider_id uuid NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false, permissions jsonb,
  expires_at timestamptz
);
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_access ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.requests, public.consent_access TO authenticated;
