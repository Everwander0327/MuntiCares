import { describe, expect, it } from 'vitest';
import { validSubscription, classifyDelivery, notificationPayload } from '../../supabase/functions/web-push/policy.js';

const subscription = (endpoint) => ({ endpoint, keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'b'.repeat(22) } });
describe('web push delivery policy', () => {
  it('accepts supported browser push services, not arbitrary destinations', () => {
    for (const url of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x']) expect(validSubscription(subscription(url))).toBe(true);
    for (const url of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://evil.test/x', 'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x']) expect(validSubscription(subscription(url))).toBe(false);
  });
  it('rejects missing encryption keys', () => {
    expect(validSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: {} })).toBe(false);
  });
  it('prunes only gone endpoints, retries provider failures', () => {
    expect(classifyDelivery(410)).toBe('expired');
    expect(classifyDelivery(404)).toBe('expired');
    expect(classifyDelivery(429)).toBe('retry');
    expect(classifyDelivery(503)).toBe('retry');
    expect(classifyDelivery(401)).toBe('retry');
    expect(classifyDelivery(201)).toBe('delivered');
  });
  it('drops arbitrary fields and uses a recipient-scoped payload', () => {
    const result = notificationPayload({ id: 'job', user_id: 'a', expires_at: '2030-01-01T00:00:00Z', payload: { kind: 'message', path: '/patient/messages', content: 'secret' } });
    expect(result.userId).toBe('a');
    expect(result).not.toHaveProperty('content');
  });
});
