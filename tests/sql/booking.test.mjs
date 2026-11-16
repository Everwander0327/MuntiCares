/**
 * Isolated PostgreSQL verification (no network/database credentials).
 * Install @electric-sql/pglite in a temporary directory, then set PGLITE_MODULE
 * to its dist/index.js file and run: node --test tests/sql/booking.test.mjs
 * Covers the actual migration plus repository RLS and slot constraints.
 * The fixture omits unrelated Supabase tables/triggers; run full-stack QA before deploy.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const moduleUrl = process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite';
const { PGlite } = await import(moduleUrl);
const extensionUrl = process.env.PGLITE_MODULE
  ? new URL('./contrib/btree_gist.js', moduleUrl).href
  : '@electric-sql/pglite/contrib/btree_gist';
const { btree_gist } = await import(extensionUrl);
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const patient = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const provider = '33333333-3333-4333-8333-333333333333';

test('atomic booking PostgreSQL contract', async t => {
  const db = new PGlite({ extensions: { btree_gist } });
  t.after(() => db.close());
  await db.exec(read('tests/sql/booking_fixture.sql'));
  const rls = read('supabase/migrations/20261102150000_rls_rollout_and_server_guards.sql');
  await db.exec(rls.slice(rls.indexOf('DROP POLICY IF EXISTS "requests_select_own"'),
    rls.indexOf('-- 7. policies:')));
  await db.exec(rls.slice(rls.indexOf('DROP POLICY IF EXISTS "consent_select_participants"'),
    rls.indexOf('-- 9. policies:')));
  await db.exec(read('supabase/migrations/20261102170000_requests_slot_exclusivity.sql'));
  const slots = read('supabase/migrations/20261103230000_service_based_duration.sql');
  await db.exec(slots.slice(0, slots.indexOf('-- 6. RPC:')));
  await db.exec(read('supabase/migrations/20261113142343_booking_with_consent_atomic.sql'));
  await db.exec(read('docs/backend/20261115120000_validate_booking_details.sql'));
  await db.exec(read('docs/backend/20261115140000_provider_busy_booking_slots.sql'));
  const as = async (role, id = '') => {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('SET ROLE ' + role);
  };
  const book = (time = '09:00', duration = 60) => db.query(
    "SELECT public.book_visit_with_consent($1, 'Nursing', $2, '2030-01-15', $3::time, 'note', 14.4, 121.0, 'Home') AS id",
    [provider, duration, time]);
  const counts = async () => (await db.query(
    'SELECT (SELECT count(*)::int FROM requests) AS requests, (SELECT count(*)::int FROM consent_access) AS consents')).rows[0];
  const consent = async () => (await db.query('SELECT * FROM consent_access')).rows[0];
  const reset = async () => {
    await as('postgres');
    await db.exec('TRUNCATE requests, consent_access');
  };
  await t.test('anonymous and missing-identity calls are denied', async () => {
    await as('anon');
    await assert.rejects(book(), { code: '42501' });
    await as('authenticated');
    await assert.rejects(book(), { code: '42501' });
    await as('postgres');
    assert.deepEqual(await counts(), { requests: 0, consents: 0 });
  });
  await t.test('successful booking creates caller-owned request and least-privilege consent', async () => {
    await reset(); await as('authenticated', patient);
    const result = await book();
    assert.match(result.rows[0].id, /^[0-9a-f-]{36}$/);
    const request = (await db.query('SELECT * FROM requests')).rows[0];
    assert.equal(request.patient_id, patient);
    assert.equal(request.provider_id, provider);
    assert.equal(request.status, 'Pending');
    assert.equal(request.dest_source, 'booking');
    assert.equal(request.dest_version, 1);
    const grant = await consent();
    assert.equal(grant.is_enabled, true);
    assert.deepEqual(grant.permissions, { medical_history: true, documents: false, visit_notes: false });
    assert.ok(new Date(grant.expires_at) > new Date());
    assert.deepEqual(await counts(), { requests: 1, consents: 1 });
  });
  await t.test('availability returns only busy time and duration for another patient', async () => {
    await reset(); await as('authenticated', patient); await book('09:00', 60);
    await as('authenticated', other);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM requests')).rows[0].count, 0);
    const result = await db.query(
      'SELECT * FROM public.get_provider_busy_booking_slots($1, $2::date)', [provider, '2030-01-15']);
    assert.deepEqual(result.rows, [{ time: '09:00:00', duration_minutes: 60 }]);
    assert.deepEqual(Object.keys(result.rows[0]).sort(), ['duration_minutes', 'time']);

    await as('postgres');
    await db.query("UPDATE requests SET status = 'Cancelled' WHERE patient_id = $1", [patient]);
    await as('authenticated', other);
    const cancelled = await db.query(
      'SELECT * FROM public.get_provider_busy_booking_slots($1, $2::date)', [provider, '2030-01-15']);
    assert.deepEqual(cancelled.rows, []);
  });
  await t.test('anonymous callers cannot read booking availability', async () => {
    await as('anon');
    await assert.rejects(db.query(
      'SELECT * FROM public.get_provider_busy_booking_slots($1, $2::date)', [provider, '2030-01-15']),
    { code: '42501' });
  });
  await t.test('server rejects invalid service duration, schedule, provider, and coordinates atomically', async () => {
    await reset(); await as('authenticated', patient);
    await assert.rejects(db.query(
      "SELECT public.book_visit_with_consent($1, 'Nursing', 30, '2030-01-15', '09:00', 'note', 14.4, 121, 'Home')",
      [provider]), { code: '22023' });
    await assert.rejects(db.query(
      "SELECT public.book_visit_with_consent($1, 'Nursing', 60, '2030-01-13', '09:00', 'note', 14.4, 121, 'Home')",
      [provider]), { code: '22023' });
    await assert.rejects(db.query(
      "SELECT public.book_visit_with_consent($1, 'Nursing', 60, '2030-01-15', '16:30', 'note', 14.4, 121, 'Home')",
      [provider]), { code: '22023' });
    await assert.rejects(db.query(
      "SELECT public.book_visit_with_consent($1, 'Nursing', 60, '2030-01-15', '09:00', 'note', 91, 121, 'Home')",
      [provider]), { code: '22023' });
    await db.exec('RESET ROLE');
    await db.exec("UPDATE providers SET is_approved = false WHERE user_id = '33333333-3333-4333-8333-333333333333'");
    await as('authenticated', patient);
    await assert.rejects(book(), { code: '22023' });
    await as('postgres');
    assert.deepEqual(await counts(), { requests: 0, consents: 0 });
    await db.exec("UPDATE providers SET is_approved = true WHERE user_id = '33333333-3333-4333-8333-333333333333'");
  });
  for (const expiry of ['future', 'expired', 'null']) {
    await t.test('preserves permissions and refreshes ' + expiry + ' grant correctly', async () => {
      await reset();
      await db.query("INSERT INTO consent_access(patient_id,provider_id,is_enabled,permissions,expires_at) VALUES($1,$2,false,$3,$4)",
        [patient, provider, { medical_history: false, documents: true, visit_notes: true },
          expiry === 'future' ? '2099-01-01' : expiry === 'expired' ? '2000-01-01' : null]);
      await as('authenticated', patient);
      await book();
      const grant = await consent();
      assert.deepEqual(grant.permissions, { medical_history: false, documents: true, visit_notes: true });
      assert.equal(grant.is_enabled, true);
      assert.ok(new Date(grant.expires_at) > new Date());
      if (expiry === 'future') assert.equal(new Date(grant.expires_at).getUTCFullYear(), 2099);
      assert.deepEqual(await counts(), { requests: 1, consents: 1 });
    });
  }
  await t.test('consent INSERT failure rolls back the request', async () => {
    await reset();
    await db.exec("ALTER TABLE consent_access ADD CONSTRAINT forced_failure CHECK (NOT is_enabled)");
    await as('authenticated', patient);
    await assert.rejects(book(), { code: '23514' });
    assert.deepEqual(await counts(), { requests: 0, consents: 0 });
    await as('postgres');
    await db.exec('ALTER TABLE consent_access DROP CONSTRAINT forced_failure');
  });
  await t.test('consent UPDATE failure leaves the old grant and no request', async () => {
    await reset();
    await db.query("INSERT INTO consent_access(patient_id,provider_id,is_enabled,expires_at) VALUES($1,$2,false,'2000-01-01')", [patient, provider]);
    await db.exec("ALTER TABLE consent_access ADD CONSTRAINT forced_failure CHECK (NOT is_enabled)");
    await as('authenticated', patient);
    const before = await consent();
    await assert.rejects(book(), { code: '23514' });
    assert.deepEqual(await consent(), before);
    assert.deepEqual(await counts(), { requests: 0, consents: 1 });
    await as('postgres');
    await db.exec('ALTER TABLE consent_access DROP CONSTRAINT forced_failure');
  });
  await t.test('overlapping slot rejects with 23P01 without creating consent', async () => {
    await reset(); await as('authenticated', patient); await book();
    await as('authenticated', other);
    await assert.rejects(book('09:30'), { code: '23P01' });
    assert.deepEqual(await counts(), { requests: 0, consents: 0 });
    await as('postgres');
    assert.deepEqual(await counts(), { requests: 1, consents: 1 });
  });
  await t.test('retry or active patient/provider conflict leaves consent unchanged', async () => {
    await reset(); await as('authenticated', patient); await book();
    const before = await consent();
    await assert.rejects(book('11:00'), { code: '23505' });
    assert.deepEqual(await consent(), before);
    assert.deepEqual(await counts(), { requests: 1, consents: 1 });
  });
});
