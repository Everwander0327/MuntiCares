import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zsqowrouxuxjjmosbvxt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzcW93cm91eHV4amptb3Nidnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTMxNTcsImV4cCI6MjA5NDgyOTE1N30.N7JuoPAXNCmQrim1J7FbsbzAml56oMTL907uikJIF2U';
const supabase = createClient(supabaseUrl, supabaseKey);

const PROVIDER = {
  id: '426a5992-c6c6-4171-8136-001f4b25e201',
  email: 'johnlawrence@gmail.com',
  full_name: 'John Lawrence Soriano',
  role: 'provider',
};

const PATIENT = {
  id: '91e0b115-e381-402a-a930-61e85c4989b0',
  email: 'andrew@gmail.com',
  full_name: 'Andrew Ymson',
  role: 'patient',
};

let testRequestId = null;

test.beforeAll(async () => {
  // Ensure patient has coordinates in patients table
  await supabase
    .from('patients')
    .upsert({
      user_id: PATIENT.id,
      address: 'Ayala Alabang Village, Muntinlupa City',
      latitude: 14.4215,
      longitude: 121.0335,
      is_profile_complete: true,
    }, { onConflict: 'user_id' });

  // Create or update a test request with status 'On The Way'
  const { data: newReq, error } = await supabase
    .from('requests')
    .insert({
      patient_id: PATIENT.id,
      provider_id: PROVIDER.id,
      service: 'Physical Therapy (Live GPS Test)',
      date: new Date().toISOString().split('T')[0],
      time: '14:00',
      status: 'On The Way',
      route_started_at: new Date().toISOString(),
      dest_lat: 14.4215,
      dest_lng: 121.0335,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create test request:', error);
  } else {
    testRequestId = newReq.id;
  }
});

test.afterAll(async () => {
  if (testRequestId) {
    await supabase.from('provider_locations').delete().eq('request_id', testRequestId);
    await supabase.from('requests').delete().eq('id', testRequestId);
  }
});

test.describe('Live GPS Tracking Flow', () => {

  test('1. Provider shares live GPS (even with coarse Wi-Fi accuracy) and updates provider_locations in real time', async ({ page, context }) => {
    // Grant geolocation permission and mock coarse Wi-Fi/laptop GPS accuracy (800m)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 14.4081,
      longitude: 121.0415,
      accuracy: 800,
    });

    // Login as Provider via localStorage injection
    await page.goto('/');
    await page.evaluate((userData) => {
      localStorage.setItem('munticares_user', JSON.stringify(userData));
    }, PROVIDER);

    // Navigate to Provider Requests
    await page.goto('/provider/requests');

    // Wait for the floating Active Route tracking panel
    const trackingPanel = page.locator('text=Sharing live location');
    await expect(trackingPanel).toBeVisible({ timeout: 15000 });

    // Verify patient name and service in tracking panel
    await expect(page.locator('text=Andrew Ymson · Physical Therapy (Live GPS Test)')).toBeVisible();

    // Verify distance and ETA are displayed (e.g. min or km)
    await expect(page.locator('text=/min|km|m/').first()).toBeVisible({ timeout: 10000 });

    // Wait briefly for the first persist to hit Supabase DB
    await page.waitForTimeout(3000);

    // Verify database record in provider_locations
    const { data: loc } = await supabase
      .from('provider_locations')
      .select('*')
      .eq('request_id', testRequestId)
      .maybeSingle();

    expect(loc).not.toBeNull();
    expect(loc?.lat).toBeCloseTo(14.41, 1);
    expect(loc?.lng).toBeCloseTo(121.04, 1);
  });

  test('2. Patient sees Live Tracker button on both Dashboard and Requests and opens interactive map modal with ETA', async ({ page }) => {
    // Set provider location in database so patient can see it immediately
    await supabase
      .from('provider_locations')
      .upsert({
        request_id: testRequestId,
        provider_id: PROVIDER.id,
        lat: 14.4095,
        lng: 121.0385,
        accuracy: 12,
        updated_at: new Date().toISOString(),
      });

    // Login as Patient via localStorage
    await page.goto('/');
    await page.evaluate((userData) => {
      localStorage.setItem('munticares_user', JSON.stringify(userData));
    }, PATIENT);

    // First verify Patient Dashboard (/patient/dashboard) has Track Live button and opens modal
    await page.goto('/patient/dashboard');
    await expect(page.locator('text=Active Home Care Visit')).toBeVisible({ timeout: 10000 });
    const dashTrackBtn = page.getByRole('button', { name: /Track Live/i }).first();
    await expect(dashTrackBtn).toBeVisible({ timeout: 10000 });
    await dashTrackBtn.click();

    await expect(page.locator('text=Provider on the way')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
    await page.getByTitle('Close tracker').click();

    // Navigate to Patient Requests
    await page.goto('/patient/requests');

    // Wait for requests list to load
    await expect(page.locator('text=My Service Requests')).toBeVisible();

    // Find the "Track Live" button on the active visit card
    const trackBtn = page.getByRole('button', { name: /Track Live/i });
    await expect(trackBtn.first()).toBeVisible({ timeout: 10000 });

    // Click "Track Live"
    await trackBtn.first().click();

    // The Live Tracker Modal should open
    await expect(page.locator('text=Provider on the way')).toBeVisible({ timeout: 10000 });

    // Leaflet map container should be rendered
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible({ timeout: 10000 });

    // Provider marker and home marker should exist inside the map
    await expect(page.locator('.mc-provider-marker')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.mc-home-marker')).toBeVisible({ timeout: 10000 });

    // ETA stat should be populated
    await expect(page.locator('text=ETA')).toBeVisible();
    await expect(page.locator('text=Distance')).toBeVisible();
  });

  test('3. Patient Profile includes LocationPicker with Pin on Map', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 14.4215, longitude: 121.0335 });

    await page.goto('/');
    await page.evaluate((userData) => {
      localStorage.setItem('munticares_user', JSON.stringify(userData));
    }, PATIENT);

    await page.goto('/patient/profile');

    // Check that Pin Your Home section exists
    const pinHeading = page.locator('text=Pin Your Home on the Map');
    await expect(pinHeading).toBeVisible({ timeout: 10000 });

    // Verify map is visible in profile
    const profileMap = page.locator('.leaflet-container');
    await expect(profileMap.first()).toBeVisible();

    // Verify actions: "Find my address", "I'm at home now", "Save pin"
    await expect(page.getByRole('button', { name: /Find my address/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /I'm at home now/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save pin/i })).toBeVisible();
  });

  test('4. Arrival flow: provider marks Arrived -> patient modal updates to "Arrived / Here"', async ({ browser }) => {
    // 1. Patient opens tracker modal in one context
    const patientContext = await browser.newContext();
    const patientPage = await patientContext.newPage();
    await patientPage.goto('/');
    await patientPage.evaluate((userData) => {
      localStorage.setItem('munticares_user', JSON.stringify(userData));
    }, PATIENT);
    await patientPage.goto('/patient/requests');

    const trackBtn = patientPage.getByRole('button', { name: /Track Live/i }).first();
    await expect(trackBtn).toBeVisible({ timeout: 10000 });
    await trackBtn.click();
    await expect(patientPage.locator('text=Provider on the way')).toBeVisible({ timeout: 10000 });

    // 2. Provider in a second context marks visit as "Arrived"
    const providerContext = await browser.newContext();
    await providerContext.grantPermissions(['geolocation']);
    await providerContext.setGeolocation({ latitude: 14.4214, longitude: 121.0334, accuracy: 10 });

    const providerPage = await providerContext.newPage();
    await providerPage.goto('/');
    await providerPage.evaluate((userData) => {
      localStorage.setItem('munticares_user', JSON.stringify(userData));
    }, PROVIDER);
    await providerPage.goto('/provider/requests');

    // In Provider panel, click "Arrived"
    const arrivedBtn = providerPage.getByRole('button', { name: /Arrived/i }).first();
    await expect(arrivedBtn).toBeVisible({ timeout: 10000 });
    await arrivedBtn.click();

    // 3. In patient tracker modal, status changes to "Arrived" and "Here"
    await expect(patientPage.locator('text=Your provider has arrived')).toBeVisible({ timeout: 15000 });
    await expect(patientPage.locator('text=Here')).toBeVisible({ timeout: 10000 });

    await patientContext.close();
    await providerContext.close();
  });

});
