-- ===========================================================================
-- MuntiCares: Migration State Verification
-- Run this in the Supabase SQL Editor against PRODUCTION.
--
-- Purpose: four older migration files exist locally but have no record in the
-- remote migration history (they were applied out of band). This script checks
-- the DATABASE OBJECTS those files create, so a clean run proves their effects
-- are live regardless of what the migration log says.
--
-- Files covered:
--   20261024000000_tracking_v2.sql
--   20261025140000_tracking_v2_security_fix.sql
--   20261027000000_remove_payment_and_money.sql
--   20261029154000_fix_handle_new_auth_user.sql
--
-- This script is READ-ONLY: it only queries catalog tables (to_regclass,
-- information_schema, pg_trigger, pg_proc, pg_extension, cron.job). It writes
-- nothing and can be re-run safely any number of times.
--
-- What a PASS looks like:
--   Every test prints "TEST n PASSED: ..." and the script finishes with
--   "ALL MIGRATION STATE TESTS PASSED". Any missing object raises an exception
--   naming the migration file that likely was not applied.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- TEST 1: Live Tracking v2 objects (20261024000000_tracking_v2.sql)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ok boolean;
  v_missing text;
BEGIN
  SELECT to_regclass('public.tracking_sessions') IS NOT NULL
    AND to_regclass('public.provider_locations') IS NOT NULL
  INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 1 FAILED: public.tracking_sessions or public.provider_locations is missing (20261024000000_tracking_v2 not applied?)';
  END IF;

  SELECT string_agg(c.column_name, ', ' ORDER BY c.column_name)
    INTO v_missing
  FROM (VALUES ('session_id'), ('seq'), ('captured_at')) AS wanted(column_name)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'provider_locations'
   AND c.column_name = wanted.column_name
  WHERE c.column_name IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: provider_locations is missing columns: % (20261024000000_tracking_v2 not applied?)', v_missing;
  END IF;

  SELECT string_agg(c.column_name, ', ' ORDER BY c.column_name)
    INTO v_missing
  FROM (VALUES ('dest_address'), ('dest_source'), ('dest_version'), ('dest_updated_at')) AS wanted(column_name)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'requests'
   AND c.column_name = wanted.column_name
  WHERE c.column_name IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 1 FAILED: requests is missing columns: % (20261024000000_tracking_v2 not applied?)', v_missing;
  END IF;

  SELECT bool_and(p.proname IS NOT NULL)
    INTO v_ok
  FROM (VALUES ('start_tracking_session'), ('record_provider_location'), ('expire_stale_tracking_sessions')) AS f(name)
  LEFT JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname = f.name;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 1 FAILED: a tracking RPC is missing (20261024000000_tracking_v2 not applied?)';
  END IF;

  RAISE NOTICE 'TEST 1 PASSED: tracking v2 tables, columns, and RPCs present.';
END $$;

-- ---------------------------------------------------------------------------
-- TEST 2: Payment/money removal (20261027000000_remove_payment_and_money.sql)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT to_regclass('public.transactions') IS NULL INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 2 FAILED: public.transactions still exists (20261027000000_remove_payment_and_money not applied?)';
  END IF;

  SELECT count(*) = 0 INTO v_ok
  FROM information_schema.columns
  WHERE (table_schema = 'public' AND table_name = 'providers' AND column_name = 'price_per_service')
     OR (table_schema = 'public' AND table_name = 'requests' AND column_name = 'price');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 2 FAILED: price columns still exist (20261027000000_remove_payment_and_money not applied?)';
  END IF;

  RAISE NOTICE 'TEST 2 PASSED: payment tables and columns removed.';
END $$;

-- ---------------------------------------------------------------------------
-- TEST 3: Privilege guard trigger (20261025140000_tracking_v2_security_fix.sql)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'users' AND t.tgname = 'trg_protect_users_privileges'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 3 FAILED: trg_protect_users_privileges missing on public.users (20261025140000 not applied?)';
  END IF;

  SELECT bool_and(p.proname IS NOT NULL)
    INTO v_ok
  FROM (VALUES ('protect_users_privileges'), ('mark_arrived'), ('haversine_distance')) AS f(name)
  LEFT JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname = f.name;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 3 FAILED: a security function is missing (20261025140000 not applied?)';
  END IF;

  RAISE NOTICE 'TEST 3 PASSED: privilege guard trigger and security functions present.';
END $$;

-- ---------------------------------------------------------------------------
-- TEST 4: Sign-up trigger (20261029154000_fix_handle_new_auth_user.sql)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'handle_new_auth_user'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 4 FAILED: public.handle_new_auth_user() missing (20261029154000 not applied?)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'auth.users'::regclass AND t.tgname = 'on_auth_user_created'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 4 FAILED: on_auth_user_created trigger missing on auth.users (20261029154000 not applied?)';
  END IF;

  RAISE NOTICE 'TEST 4 PASSED: sign-up trigger and handler present.';
END $$;

-- ---------------------------------------------------------------------------
-- TEST 5: Column-level grants on public.users
-- Expectation: authenticated holds UPDATE on exactly
-- (full_name, avatar_url, is_banned, email) — nothing more, never the whole table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_granted text;
  v_extra boolean;
  v_whole_table boolean;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY column_name)
    INTO v_granted
  FROM information_schema.role_column_grants
  WHERE grantee = 'authenticated'
    AND table_schema = 'public'
    AND table_name = 'users'
    AND privilege_type = 'UPDATE';

  IF v_granted IS DISTINCT FROM 'avatar_url, email, full_name, is_banned' THEN
    RAISE EXCEPTION 'TEST 5 FAILED: expected UPDATE grants on (avatar_url, email, full_name, is_banned), found: %', COALESCE(v_granted, 'NONE');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name = 'users'
      AND privilege_type = 'UPDATE'
  ) INTO v_whole_table;
  IF v_whole_table THEN
    RAISE EXCEPTION 'TEST 5 FAILED: authenticated has whole-table UPDATE on public.users';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_column_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name = 'users'
      AND privilege_type = 'UPDATE'
      AND column_name IN ('role', 'id', 'created_at')
  ) INTO v_extra;
  IF v_extra THEN
    RAISE EXCEPTION 'TEST 5 FAILED: authenticated can UPDATE a privileged column on public.users';
  END IF;

  RAISE NOTICE 'TEST 5 PASSED: UPDATE grants limited to (avatar_url, email, full_name, is_banned).';
END $$;

-- ---------------------------------------------------------------------------
-- TEST 6 (informational): Tracking-session expiry cron job
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ok boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'TEST 6 SKIPPED: pg_cron is not installed on this database.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-tracking-sessions'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'TEST 6 FAILED: cron job expire-tracking-sessions missing (20261024000000 not applied?)';
  END IF;

  RAISE NOTICE 'TEST 6 PASSED: expire-tracking-sessions cron job scheduled.';
END $$;

DO $$
BEGIN
  RAISE NOTICE 'ALL MIGRATION STATE TESTS PASSED.';
END $$;
