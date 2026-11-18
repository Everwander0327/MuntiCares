# ID integrity fixes

All 20 application tables already have primary keys. This patch fixes three specific gaps without renumbering records or deleting data.

- Call IDs: use native randomUUID or a cryptographically random RFC 4122 v4 UUID fallback. If secure randomness is unavailable, fail with a clear HTTPS instruction rather than attempting an invalid database UUID.
- Medical histories: UNIQUE(patient_id) prevents duplicate patient rows. Onboarding/profile saves recover competing first inserts by updating the winning row after a uniqueness conflict. Only submitted fields are updated; omitted fields are preserved. Other errors remain errors.
- Auth/profile linkage: public.users.id references auth.users.id with ON DELETE NO ACTION. The signup trigger still writes the same Auth UUID into the public profile. Deleting a public profile still works independently; deleting Auth first is rejected while a profile exists. Account cleanup must remove dependent app records/profile before Auth. No new cascade deletion is introduced.

Migration aborts if duplicate patient histories or orphan profiles exist. SQL regression tests create isolated temporary fixture identities inside a transaction and roll back all fixture data. Rollback for constraints, if required, is explicit DROP CONSTRAINT users_auth_user_id_fkey on public.users and DROP CONSTRAINT medical_histories_patient_id_key on public.medical_histories; do not remove existing primary keys.

## Verification
- Live preflight found no duplicate history owners, null history owners or orphan profiles.
- Migration applied and both constraints are validated. Existing 2 Auth accounts, 2 profiles and 1 history remain intact.
- Live transaction checks confirmed duplicate-history and orphan-profile insert rejection and non-cascading linkage; all probes rolled back.
- 9 focused frontend tests passed, including profile regressions; focused lint and production build passed.
- Full temporary Auth fixture test is saved in tests/sql/id_integrity.test.sql, but its automatic permission review timed out and it was not executed. Actual Google/email signup and admin deletion UI were not exercised end-to-end in this change.
