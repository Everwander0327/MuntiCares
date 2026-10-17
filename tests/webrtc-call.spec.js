import { test, expect } from '@playwright/test';

/**
 * End-to-end test for the native WebRTC voice / video call feature.
 *
 * Two isolated browser contexts (patient + provider) talk to each other through
 * Supabase Realtime signaling. Chrome's fake media devices supply camera + mic.
 *
 * Verifies:
 *  - The callee receives exactly one incoming-call prompt and can accept it.
 *  - Both sides reach a real P2P connection (RTCPeerConnection "connected") and
 *    the remote media actually flows (remote video has frames / audio track live).
 *  - No call loop: the caller never gets an incoming-call prompt back, and only one
 *    "started a consultation" chat message is created per call.
 *  - Hang-up on one side ends the session on the other side.
 */

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

const login = async (page, user) => {
  await page.goto('/');
  await page.evaluate((u) => localStorage.setItem('munticares_user', JSON.stringify(u)), user);
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
    await login(patient, PATIENT);
    await login(provider, PROVIDER);

    // Provider idles on the messages list (global CallProvider listens for calls).
    await provider.goto('/provider/messages');
    // Patient opens the chat with the provider.
    await patient.goto(`/patient/messages?partner=${PROVIDER.id}&name=${encodeURIComponent(PROVIDER.full_name)}`);

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
  test('video call connects both ways without looping', async ({ browser }) => {
    await runCall(browser, 'video');
  });

  test('voice call connects both ways without looping', async ({ browser }) => {
    await runCall(browser, 'audio');
  });
});
