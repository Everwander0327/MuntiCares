import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

// Staging-only E2E. The running app (VITE_SUPABASE_*) and the E2E_* credentials
// must point at the SAME non-production Supabase project with tracking v2 applied.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY;
const PROVIDER_EMAIL = process.env.E2E_PROVIDER_EMAIL;
const PROVIDER_PASSWORD = process.env.E2E_PROVIDER_PASSWORD;
const PATIENT_EMAIL = process.env.E2E_PATIENT_EMAIL;
const PATIENT_PASSWORD = process.env.E2E_PATIENT_PASSWORD;

const enabled = Boolean(
  SUPABASE_URL
  && SUPABASE_ANON_KEY
  && PROVIDER_EMAIL
  && PROVIDER_PASSWORD
  && PATIENT_EMAIL
  && PATIENT_PASSWORD
);

let supabase;
let providerClient;
let patientClient;
let testRequestId = null;

async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

test.describe('Live GPS Tracking Flow', () => {
  test.skip(!enabled, 'Set E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_PROVIDER_*, and E2E_PATIENT_* to run against staging.');

  test.beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    providerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    patientClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const provider = await signIn(providerClient, PROVIDER_EMAIL, PROVIDER_PASSWORD);
    const patient = await signIn(patientClient, PATIENT_EMAIL, PATIENT_PASSWORD);

    const { error: profileError } = await patientClient
      .from('patients')
      .upsert({
        user_id: patient.id,
        address: 'Ayala Alabang Village, Muntinlupa City',
        latitude: 14.4215,
        longitude: 121.0335,
        is_profile_complete: true,
      }, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    const { data, error } = await patientClient
      .from('requests')
      .insert({
        patient_id: patient.id,
        provider_id: provider.id,
        service: 'Physical Therapy (Live GPS Test)',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        status: 'On The Way',
        route_started_at: new Date().toISOString(),
        dest_lat: 14.4215,
        dest_lng: 121.0335,
        dest_address: 'Ayala Alabang Village, Muntinlupa City',
        dest_source: 'e2e',
        dest_version: 1,
        dest_updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    testRequestId = data.id;
  });

  test.afterAll(async () => {
    if (testRequestId) {
      await patientClient.from('requests').delete().eq('id', testRequestId);
    }
    await supabase?.removeAllChannels();
    await providerClient?.auth.signOut();
    await patientClient?.auth.signOut();
  });

  test('1. Provider starts a session and persists a coarse first fix', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 14.4081,
      longitude: 121.0415,
      accuracy: 1200,
    });

    await loginAs(page, PROVIDER_EMAIL, PROVIDER_PASSWORD);
    await page.goto('/provider/requests');

    await expect(page.getByText(/Sharing live location|Coarse GPS|Location issue/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Physical Therapy \(Live GPS Test\)/).first()).toBeVisible();

    await page.waitForTimeout(4000);

    const { data: location, error } = await providerClient
      .from('provider_locations')
      .select('*')
      .eq('request_id', testRequestId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(location).not.toBeNull();
    expect(location?.lat).toBeCloseTo(14.408, 2);
    expect(location?.lng).toBeCloseTo(121.042, 2);
  });

  test('2. Patient sees the live tracker and destination ETA', async ({ page }) => {
    const sessionId = randomUUID();
    const { error: sessionError } = await providerClient.rpc('start_tracking_session', {
      p_request_id: testRequestId,
      p_session_id: sessionId,
    });
    expect(sessionError).toBeNull();

    const { error: locationError } = await providerClient.rpc('record_provider_location', {
      p_request_id: testRequestId,
      p_session_id: sessionId,
      p_seq: 1,
      p_lat: 14.4095,
      p_lng: 121.0385,
      p_accuracy: 12,
      p_heading: 45,
      p_speed: 8,
      p_captured_at: new Date().toISOString(),
    });
    expect(locationError).toBeNull();

    await loginAs(page, PATIENT_EMAIL, PATIENT_PASSWORD);

    await page.goto('/patient/dashboard');
    await expect(page.getByText('Active Home Care Visit')).toBeVisible({ timeout: 15000 });
    const dashTrackBtn = page.getByRole('button', { name: /Track Live/i }).first();
    await expect(dashTrackBtn).toBeVisible();
    await dashTrackBtn.click();

    await expect(page.getByText('Provider on the way')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    await page.getByTitle('Close tracker').click();

    await page.goto('/patient/requests');
    await expect(page.getByText('My Service Requests')).toBeVisible();

    const trackBtn = page.getByRole('button', { name: /Track Live/i }).first();
    await expect(trackBtn).toBeVisible({ timeout: 15000 });
    await trackBtn.click();

    await expect(page.getByText('Provider on the way')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.mc-provider-marker')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.mc-home-marker')).toBeVisible();
    await expect(page.getByText('ETA', { exact: true })).toBeVisible();
    await expect(page.getByText('Distance', { exact: true })).toBeVisible();
  });

  test('3. Patient profile location picker is available', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 14.4215, longitude: 121.0335 });

    await loginAs(page, PATIENT_EMAIL, PATIENT_PASSWORD);
    await page.goto('/patient/profile');

    await expect(page.getByText('Pin Your Home on the Map')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.leaflet-container').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Find my address/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /I'm at home now/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save pin/i })).toBeVisible();
  });

  test('4. Arrival updates the patient tracker to Arrived', async ({ browser }) => {
    const patientContext = await browser.newContext();
    const patientPage = await patientContext.newPage();
    await loginAs(patientPage, PATIENT_EMAIL, PATIENT_PASSWORD);
    await patientPage.goto('/patient/requests');

    const trackBtn = patientPage.getByRole('button', { name: /Track Live/i }).first();
    await expect(trackBtn).toBeVisible({ timeout: 15000 });
    await trackBtn.click();
    await expect(patientPage.getByText('Provider on the way')).toBeVisible({ timeout: 15000 });

    const providerContext = await browser.newContext();
    await providerContext.grantPermissions(['geolocation']);
    await providerContext.setGeolocation({ latitude: 14.4214, longitude: 121.0334, accuracy: 10 });

    const providerPage = await providerContext.newPage();
    await loginAs(providerPage, PROVIDER_EMAIL, PROVIDER_PASSWORD);
    await providerPage.goto('/provider/requests');

    const arrivedBtn = providerPage.getByRole('button', { name: /^Arrived$/ }).first();
    await expect(arrivedBtn).toBeVisible({ timeout: 20000 });
    await expect(arrivedBtn).toBeEnabled({ timeout: 20000 });
    await arrivedBtn.click();

    await expect(patientPage.getByText('Your provider has arrived')).toBeVisible({ timeout: 20000 });
    await expect(patientPage.getByText('Here', { exact: true })).toBeVisible();

    await patientContext.close();
    await providerContext.close();
  });
});
