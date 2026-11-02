import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Credentials come from the environment only. Committing a project URL, an anon key
// or a working account password means anyone with repo read access can sign in.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SUPABASE_KEY = process.env.E2E_SUPABASE_ANON_KEY;
const PATIENT_PASSWORD = process.env.E2E_PATIENT_PASSWORD;
const PROVIDER_PASSWORD = process.env.E2E_PROVIDER_PASSWORD;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('Supabase Row Level Security (RLS) Deep Enforcement Suite', () => {
  test.beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY || !PATIENT_PASSWORD || !PROVIDER_PASSWORD || !ADMIN_PASSWORD) {
      throw new Error('Set E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY and the E2E_*_PASSWORD variables to run the RLS suite.');
    }
  });

  test('RLS 1: Anonymous / Unauthenticated client has zero access to sensitive tables', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 1. Cannot access medical histories
    const { data: histories } = await anonClient.from('medical_histories').select('*');
    expect(histories || []).toHaveLength(0);

    // 2. Cannot access private visit notes
    const { data: notes } = await anonClient.from('visit_notes').select('*');
    expect(notes || []).toHaveLength(0);

    // 3. Cannot access patient chat messages
    const { data: messages } = await anonClient.from('messages').select('*');
    expect(messages || []).toHaveLength(0);

    // 4. Cannot write/insert into requests anonymously
    const { error: insertError } = await anonClient.from('requests').insert({
      service: 'Unauthorized Injection Test',
      status: 'Pending',
    });
    expect(insertError).not.toBeNull();
  });

  test('RLS 2: Patient client can strictly only view their own requests and data', async () => {
    const patientClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Sign in as Andrew (Patient)
    const { data: authData, error: loginError } = await patientClient.auth.signInWithPassword({
      email: 'andrew@gmail.com',
      password: PATIENT_PASSWORD,
    });
    expect(loginError).toBeNull();
    const patientUserId = authData.user.id;

    // Fetch requests via patient client
    const { data: requests, error: reqError } = await patientClient
      .from('requests')
      .select('id, patient_id, provider_id, service');
    expect(reqError).toBeNull();

    // EVERY returned request MUST strictly belong to this patient
    expect(requests.length).toBeGreaterThan(0);
    for (const req of requests) {
      expect(req.patient_id).toBe(patientUserId);
    }

    // Attempting to query other patients' private medical records must return 0 rows
    const { data: otherHistories } = await patientClient
      .from('medical_histories')
      .select('*')
      .neq('patient_id', patientUserId);
    expect(otherHistories || []).toHaveLength(0);

    // Attempting to create an announcement as patient MUST fail (admin-only)
    const { error: annError } = await patientClient.from('announcements').insert({
      title: 'Hacked Announcement',
      content: 'This should be blocked by RLS',
      priority: 'urgent',
    });
    expect(annError).not.toBeNull();
  });

  test('RLS 3: Provider client cannot access unauthorized patient data or admin controls', async () => {
    const providerClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Sign in as John Lawrence (Provider)
    const { data: authData, error: loginError } = await providerClient.auth.signInWithPassword({
      email: 'johnlawrence@gmail.com',
      password: PROVIDER_PASSWORD,
    });
    expect(loginError).toBeNull();
    const providerUserId = authData.user.id;

    // Requests returned must only be assigned to this provider
    const { data: requests, error: reqError } = await providerClient
      .from('requests')
      .select('id, patient_id, provider_id, service');
    expect(reqError).toBeNull();

    for (const req of requests) {
      expect(req.provider_id).toBe(providerUserId);
    }

    // Cannot create announcements
    const { error: annError } = await providerClient.from('announcements').insert({
      title: 'Provider Announcement',
      content: 'Should be blocked by RLS',
      priority: 'low',
    });
    expect(annError).not.toBeNull();
  });

  test('RLS 4: Admin client has comprehensive citywide access and oversight', async () => {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Sign in as Admin
    const { error: loginError } = await adminClient.auth.signInWithPassword({
      email: 'admin@munticares.com',
      password: ADMIN_PASSWORD,
    });
    expect(loginError).toBeNull();

    // Admin can view all users across all roles
    const { data: allUsers, error: usersError } = await adminClient
      .from('users')
      .select('id, email, role');
    expect(usersError).toBeNull();
    expect(allUsers.length).toBeGreaterThanOrEqual(18);

    // Admin can view all requests across the whole city
    const { data: allRequests, error: reqError } = await adminClient
      .from('requests')
      .select('id, status');
    expect(reqError).toBeNull();
    expect(allRequests.length).toBeGreaterThan(10);
  });

});

