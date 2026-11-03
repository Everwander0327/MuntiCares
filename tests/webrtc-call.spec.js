import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * End-to-end test for the native WebRTC voice / video call feature.
 *
 * Two isolated browser contexts (patient + provider) talk to each other through
 * Supabase Realtime signaling. Chrome's fake media devices supply camera + mic.
 *
 * Run requirements (this suite SKIPS unless all are met):
 *  - The dev server at http://localhost:5173 is running with VITE_SUPABASE_* pointing
 *    at the SAME Supabase project as the E2E credentials below.
 *  - Two real accounts exist in that project: one provider and one patient
 *    (E2E_PROVIDER_EMAIL/E2E_PROVIDER_PASSWORD, E2E_PATIENT_EMAIL/E2E_PATIENT_PASSWORD).
 *  - Realtime is enabled (it is by default).
 *  - For video across networks, the `ice-servers` edge function is deployed on the
 *    project; otherwise the call falls back to STUN and may fail over restrictive NATs.
 *
 * Verifies:
 *  - The callee receives exactly one incoming-call prompt and can accept it.
 *  - Both sides reach a real P2P connection (RTCPeerConnection "connected") and
 *    the remote media actually flows (remote video has frames / audio track live).
 *  - No call loop: the caller never gets an incoming-call prompt back, and only one
 *    "started a consultation" chat message is created per call.
 *  - Hang-up on one side ends the session on the other side.
 */

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

let providerClient;
let patientClient;
let providerUser;

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

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

test.describe.configure({ mode: 'serial', timeout: 90000 });

const attachLogging = (page, label, sink) => {
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || /webrtc|rtc|call/i.test(text)) {
      sink.push(`[${label}] ${msg.type()}: ${text}`);
    }
  });
  page.on('pageerror', (err) => sink.push(`[${label}] PAGEERROR: ${err.message}`));
};

const countCallStartMessages = (page) =>
  page.locator('text=/started a (video|voice) consultation/i').count();

// Reads the live WebRTC state exposed by the call overlay.
const readCallState = (page) =>
  page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="call-overlay"]');
    const remoteVideo = document.querySelector('[data-testid="remote-video"]');
    const remoteAudio = document.querySelector('[data-testid="remote-audio"]');
    const stream = remoteVideo?.srcObject || remoteAudio?.srcObject;
    return {
      status: overlay?.getAttribute('data-call-status') || null,
      pcState: overlay?.getAttribute('data-pc-state') || null,
      videoWidth: remoteVideo?.videoWidth || 0,
      liveTracks: stream ? stream.getTracks().filter((t) => t.readyState === 'live').map((t) => t.kind) : [],
    };
  });

async function runCall(browser, callType) {
  const logs = [];
  const ctxOpts = { permissions: ['camera', 'microphone'] };
  const patientCtx = await browser.newContext(ctxOpts);
  const providerCtx = await browser.newContext(ctxOpts);
  const patient = await patientCtx.newPage();
  const provider = await providerCtx.newPage();
  attachLogging(patient, 'patient', logs);
  attachLogging(provider, 'provider', logs);

  try {
    await loginAs(patient, PATIENT_EMAIL, PATIENT_PASSWORD);
    await loginAs(provider, PROVIDER_EMAIL, PROVIDER_PASSWORD);

    // Provider idles on the messages list (global CallProvider listens for calls).
    await provider.goto('/provider/messages');
    // Patient opens the chat with the provider.
    await patient.goto(`/patient/messages?partner=${providerUser.id}&name=${encodeURIComponent(providerUser.full_name)}`);

    const startBtnTitle = callType === 'video' ? 'Start Teleconsultation (Video)' : 'Start Voice Consultation';
    const startBtn = patient.getByTitle(startBtnTitle);
    await expect(startBtn).toBeVisible({ timeout: 20000 });
    // Let both realtime subscriptions settle.
    await patient.waitForTimeout(2500);

    const beforeCount = await countCallStartMessages(patient);
    await startBtn.click();

    // Provider receives the incoming call prompt.
    const incomingLabel = callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call';
    const incoming = provider.getByTestId('incoming-call');
    await expect(incoming.getByText(incomingLabel)).toBeVisible({ timeout: 20000 });
    await incoming.getByRole('button', { name: /Accept/i }).click();

    // Both sides must reach a real connected peer connection.
    await expect.poll(async () => (await readCallState(patient)).pcState, { timeout: 30000 }).toBe('connected');
    await expect.poll(async () => (await readCallState(provider)).pcState, { timeout: 30000 }).toBe('connected');

    if (callType === 'video') {
      await expect.poll(async () => (await readCallState(patient)).videoWidth, { timeout: 15000 }).toBeGreaterThan(0);
      await expect.poll(async () => (await readCallState(provider)).videoWidth, { timeout: 15000 }).toBeGreaterThan(0);
    }
    await expect.poll(async () => (await readCallState(patient)).liveTracks, { timeout: 15000 }).toContain('audio');
    await expect.poll(async () => (await readCallState(provider)).liveTracks, { timeout: 15000 }).toContain('audio');

    // Loop detection: stay connected for a while and make sure nothing re-rings.
    await patient.waitForTimeout(6000);
    await expect(patient.getByTestId('incoming-call')).toHaveCount(0);
    await expect(provider.getByTestId('incoming-call')).toHaveCount(0);
    expect((await readCallState(patient)).pcState).toBe('connected');
    expect((await readCallState(provider)).pcState).toBe('connected');
    expect((await readCallState(patient)).status).toBe('connected');

    // Hang up from the provider side; patient should see the session end.
    await provider.locator('[data-testid="call-overlay"]').getByTitle('End Call').last().click();
    await expect(patient.getByText('Session Concluded')).toBeVisible({ timeout: 15000 });

    // Exactly one "started a consultation" message created for this call.
    await patient.getByRole('button', { name: /Return to Conversation/i }).click();
    await expect.poll(async () => (await countCallStartMessages(patient)) - beforeCount, { timeout: 10000 }).toBe(1);
    await patient.waitForTimeout(2000);
    expect((await countCallStartMessages(patient)) - beforeCount).toBe(1);
  } catch (err) {
    console.log('---- browser logs ----\n' + logs.join('\n'));
    await patient.screenshot({ path: `test-results/webrtc-${callType}-patient.png` }).catch(() => {});
    await provider.screenshot({ path: `test-results/webrtc-${callType}-provider.png` }).catch(() => {});
    throw err;
  } finally {
    await patientCtx.close();
    await providerCtx.close();
  }
}

test.describe('Native WebRTC calls', () => {
  test.skip(!enabled, 'Set E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_PROVIDER_*, and E2E_PATIENT_* to run against staging.');

  test.beforeAll(async () => {
    providerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    patientClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const provider = await signIn(providerClient, PROVIDER_EMAIL, PROVIDER_PASSWORD);
    await signIn(patientClient, PATIENT_EMAIL, PATIENT_PASSWORD);

    const { data: providerProfile, error: profileError } = await providerClient
      .from('users')
      .select('id, full_name')
      .eq('id', provider.id)
      .maybeSingle();
    if (profileError) throw profileError;

    providerUser = { id: provider.id, full_name: providerProfile?.full_name || '' };
  });

  test.afterAll(async () => {
    await providerClient?.auth.signOut();
    await patientClient?.auth.signOut();
  });

  test('video call connects both ways without looping', async ({ browser }) => {
    await runCall(browser, 'video');
  });

  test('voice call connects both ways without looping', async ({ browser }) => {
    await runCall(browser, 'audio');
  });
});
