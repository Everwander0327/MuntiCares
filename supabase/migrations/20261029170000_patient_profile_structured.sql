-- ========================================================
-- Structured patient profile fields
-- ========================================================
-- Onboarding used to squeeze unit/subdivision/gate notes, date of birth and the
-- emergency contact into three text columns (address, medical_notes,
-- emergency_contact). Those strings are lossy: re-opening the form could not
-- reliably separate them again, and the DOB prefix leaked into the free-text
-- medical notes shown to providers.
--
-- This migration only ADDS columns and backfills the emergency contact that can
-- be split safely. DOB is backfilled by the app on next save (a SQL cast would
-- fail the whole migration on one malformed legacy value). Existing columns stay
-- authoritative for older readers until the app is updated everywhere.
-- ========================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS subdivision text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz;

COMMENT ON COLUMN public.patients.unit IS 'House / unit / lot number, stored separately from the base street address';
COMMENT ON COLUMN public.patients.subdivision IS 'Subdivision or village name';
COMMENT ON COLUMN public.patients.date_of_birth IS 'Patient date of birth; previously embedded in medical_notes as "DOB: YYYY-MM-DD"';
COMMENT ON COLUMN public.patients.emergency_contact_name IS 'Emergency contact name; emergency_contact remains the combined legacy string';
COMMENT ON COLUMN public.patients.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN public.patients.privacy_consent_at IS 'When the patient consented to storing medical details during onboarding';

-- Legacy value is "Name - Phone". Only fill empty structured fields, never
-- overwrite values the app has already written.
UPDATE public.patients
SET
  emergency_contact_name = COALESCE(
    NULLIF(emergency_contact_name, ''),
    NULLIF(split_part(emergency_contact, ' - ', 1), '')
  ),
  emergency_contact_phone = COALESCE(
    NULLIF(emergency_contact_phone, ''),
    NULLIF(split_part(emergency_contact, ' - ', 2), '')
  )
WHERE emergency_contact IS NOT NULL
  AND emergency_contact <> ''
  AND (emergency_contact_name IS NULL OR emergency_contact_phone IS NULL);
