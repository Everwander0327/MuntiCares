# Atomic Booking and Consent Design

Date: 2026-11-13

## Intent

Make patient booking reliable by ensuring the booking request and the consent grant expected by the booking flow are saved together. The patient should never see a successful booking when the consent write failed and left the database in a partial state.

## Current behavior

`src/features/patient/pages/Providers.jsx` inserts a `requests` row, then separately reads and inserts/updates `consent_access`. A failed consent write is logged, but the UI still shows booking success. Database uniqueness guards already reject conflicting active slots and duplicate live patient/provider bookings.

## Goals

- Save the request and consent in one database transaction.
- On any failure, roll back both writes and show an accurate error in the booking UI.
- Preserve existing consent permissions and a still-valid expiration; create a default-permissions grant with a future expiration when needed.
- Preserve the existing slot conflict behavior and user-facing message.
- Keep authorization enforced by the authenticated caller's identity and existing RLS rules.

## Non-goals

- Change appointment rules, slot duration, consent categories, or provider workflows.
- Modify production Supabase directly as part of local implementation.
- Expand this change to chat, calls, tracking, or other reliability work.

## Approaches

1. **Atomic database operation (selected):** an authenticated RPC inserts the booking and creates/refreshes consent in one transaction. Any failure rolls back the request and consent together. This adds a database function and requires careful RLS/authorization review.
2. **Separate writes with recovery UI:** keep the existing flow and show a partial-success state if consent fails. This avoids transactional database work but leaves the booking and consent potentially inconsistent.

The atomic operation was selected because the current UI treats both writes as one completed booking flow.

## Constraints and implementation calls

- Use the signed-in user's ID as the patient identity; do not accept an arbitrary patient ID from the client.
- Keep the function narrow and use the caller's permissions/RLS where possible; avoid granting anonymous execution or introducing a broad `SECURITY DEFINER` path.
- Return the created request ID on success. Preserve conflict error mapping for unique/exclusion violations.
- Remove client-side fallback writes so the client cannot report success after a partial failure.
- Keep migration history in the repository; do not apply it to production without an explicit separate deployment decision.

## Verification plan

- Verify the function's transaction, authorization, and RLS behavior through migration review and focused local checks.
- Verify successful booking returns one request and a valid consent grant.
- Verify a forced consent failure leaves no request behind.
- Verify a slot conflict still leaves no consent change and shows the existing conflict message.
- Verify retrying after a network/response failure does not create duplicate active bookings.
