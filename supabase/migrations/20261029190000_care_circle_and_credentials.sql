-- Care circle, access needs and richer health basics for home visits.
--
-- Additive only: every column is nullable or has a default, so existing rows
-- and older clients keep working. The in-app onboarding and profile screens
-- fall back to the legacy payload when these columns are not present yet.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS secondary_emergency_name text,
  ADD COLUMN IF NOT EXISTS secondary_emergency_phone text,
  ADD COLUMN IF NOT EXISTS caregiver_name text,
  ADD COLUMN IF NOT EXISTS caregiver_relationship text,
  ADD COLUMN IF NOT EXISTS caregiver_phone text,
  ADD COLUMN IF NOT EXISTS caregiver_can_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS access_needs text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.medical_histories
  ADD COLUMN IF NOT EXISTS medications text,
  ADD COLUMN IF NOT EXISTS blood_type text;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_expiry date,
  ADD COLUMN IF NOT EXISTS service_radius_km integer,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

-- Constrain the enumerated values so free text cannot drift.
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_preferred_language_check;
ALTER TABLE public.patients
  ADD CONSTRAINT patients_preferred_language_check
  CHECK (preferred_language IN ('en', 'fil'));

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_access_needs_check;
ALTER TABLE public.patients
  ADD CONSTRAINT patients_access_needs_check
  CHECK (access_needs <@ ARRAY['stairs', 'wheelchair', 'bedbound', 'oxygen', 'hearing', 'vision', 'lift']::text[]);

ALTER TABLE public.medical_histories DROP CONSTRAINT IF EXISTS medical_histories_blood_type_check;
ALTER TABLE public.medical_histories
  ADD CONSTRAINT medical_histories_blood_type_check
  CHECK (blood_type IS NULL OR blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'));

ALTER TABLE public.providers DROP CONSTRAINT IF EXISTS providers_service_radius_check;
ALTER TABLE public.providers
  ADD CONSTRAINT providers_service_radius_check
  CHECK (service_radius_km IS NULL OR service_radius_km BETWEEN 1 AND 100);

COMMENT ON COLUMN public.patients.secondary_emergency_name IS 'Backup emergency contact, used when the primary contact cannot be reached.';
COMMENT ON COLUMN public.patients.caregiver_name IS 'Caregiver or authorized representative who can open the door and act for the patient.';
COMMENT ON COLUMN public.patients.caregiver_can_consent IS 'Patient-declared ability of the caregiver to make care decisions during a visit.';
COMMENT ON COLUMN public.patients.preferred_language IS 'Language the patient prefers for visit coordination: en or fil.';
COMMENT ON COLUMN public.patients.access_needs IS 'Structured access needs shown to the assigned provider before arrival.';
COMMENT ON COLUMN public.medical_histories.medications IS 'Current medications as free text; one per line.';
COMMENT ON COLUMN public.medical_histories.blood_type IS 'Self-reported blood type.';
COMMENT ON COLUMN public.providers.license_number IS 'PRC or professional license number.';
COMMENT ON COLUMN public.providers.license_expiry IS 'License expiry date, used to prompt renewal.';
COMMENT ON COLUMN public.providers.service_radius_km IS 'How far the provider will travel from their base for a home visit.';
COMMENT ON COLUMN public.providers.languages IS 'Languages the provider speaks with patients.';
