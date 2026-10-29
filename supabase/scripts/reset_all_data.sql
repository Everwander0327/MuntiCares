-- MuntiCares FRESH START
-- Wipes ALL app data but keeps the schema (tables, triggers, functions, realtime).
-- Keeps the admin account: admin@munticares.com
-- NOT a migration on purpose: run manually, e.g.
--   npx supabase db query --linked -f supabase/scripts/reset_all_data.sql
-- Uploaded files (storage) must be emptied separately via the Storage API/Dashboard.

BEGIN;

TRUNCATE TABLE
  public.tracking_sessions,
  public.provider_locations,
  public.messages,
  public.visit_notes,
  public.provider_reviews,
  public.patient_documents,
  public.consent_access,
  public.medical_histories,
  public.medications,
  public.payouts,
  public.requests,
  public.announcements,
  public.patients,
  public.providers
RESTART IDENTITY CASCADE;

DELETE FROM public.users WHERE email <> 'admin@munticares.com';
DELETE FROM auth.users   WHERE email <> 'admin@munticares.com';

COMMIT;

SELECT
  (SELECT count(*) FROM auth.users)        AS auth_users,
  (SELECT count(*) FROM public.users)      AS users,
  (SELECT count(*) FROM public.patients)   AS patients,
  (SELECT count(*) FROM public.providers)  AS providers,
  (SELECT count(*) FROM public.requests)   AS requests,
  (SELECT count(*) FROM public.messages)   AS messages;

