# Atomic Booking and Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save a patient booking and its associated consent grant atomically so a failed consent write cannot leave a booking that the UI reports as complete.

**Architecture:** Add a narrow authenticated Postgres RPC with `SECURITY INVOKER` that inserts the request and creates or refreshes the patient's consent in one transaction. Change the patient booking form to call only that RPC and retain the existing UI success and slot-conflict behavior.

**Tech Stack:** React, Supabase JS, PostgreSQL migrations, Vitest/SQL verification.

**Spec:** `docs/superpowers/specs/2026-11-13-atomic-booking-consent-design.md`

## Global Constraints

- Use the signed-in user's ID as the patient identity; do not accept an arbitrary patient ID from the client.
- Keep the function narrow and use the caller's permissions/RLS where possible; avoid granting anonymous execution or introducing a broad `SECURITY DEFINER` path.
- Return the created request ID on success. Preserve conflict error mapping for unique/exclusion violations.
- Remove client-side fallback writes so the client cannot report success after a partial failure.
- Keep migration history in the repository; do not apply it to production without an explicit separate deployment decision.
- Do not commit, push, or deploy without the required user approval.

## Review Focus

- Unauthenticated callers must not execute the booking operation; test denial for `anon` and success only for an authenticated patient.
- A consent insert/update failure must roll back the request; test by forcing the consent write to fail in a transaction.
- Existing consent permissions must remain unchanged; test refresh of an existing grant.
- Expired or absent consent must receive a future expiry; test absent and expired grants.
- Slot-overlap and active patient/provider conflicts must remain rejected without changing consent; test both conflict paths.

---

### Task 1: Add the atomic booking RPC

**Files:**
- Create: migration using `supabase migration new booking_with_consent_atomic`
- Modify: `tests/sql/verification_tests.sql` or a focused sibling SQL verification script

**Interfaces:**
- Produces: `public.book_visit_with_consent(p_provider_id uuid, p_service text, p_duration_minutes integer, p_date date, p_time time, p_notes text, p_dest_lat double precision, p_dest_lng double precision, p_dest_address text) RETURNS uuid`
- The function derives `patient_id` from `auth.uid()`, inserts a `Pending` request with the current booking destination metadata, then inserts or refreshes the consent grant before returning the request ID.

- [ ] Add SQL verification cases for unauthenticated denial, successful request plus consent creation, existing permission preservation, consent-write rollback, expired-grant refresh, and slot conflict without consent mutation.
- [ ] Run the focused SQL verification against the local Supabase database and confirm all cases pass with transaction rollback.
- [ ] Create the migration with the Supabase CLI, implement the invoker RPC, and grant execution only to `authenticated`.
- [ ] Apply the migration locally and rerun the focused SQL verification.

### Task 2: Route the patient booking form through the RPC

**Files:**
- Modify: `src/features/patient/pages/Providers.jsx`
- Test: focused patient booking test or the existing SQL verification from Task 1 plus a focused client test

**Interfaces:**
- Consumes: `public.book_visit_with_consent(...)` with the arguments defined in Task 1.
- Produces: booking success only after the RPC returns a request ID.

- [ ] Add a focused failing client test that verifies the booking action calls the RPC once and never writes directly to `requests` or `consent_access`.
- [ ] Run that test and confirm it fails against the current two-write implementation.
- [ ] Replace the request insert and consent read/write fallback with one RPC call; map SQLSTATE `23505` and `23P01` to the existing slot-taken message and show a generic booking failure for other errors.
- [ ] Run the focused client test and the local SQL verification to confirm the UI path and transaction behavior.

### Task 3: Review the finished change

**Files:**
- Review: migration, `src/features/patient/pages/Providers.jsx`, and focused verification files

- [ ] Check the migration against the spec for caller identity, RLS, function grants, permission preservation, and expiry behavior.
- [ ] Confirm no production migration was applied and no unrelated files changed.
- [ ] Report the exact verification results and any limitation that remains.
