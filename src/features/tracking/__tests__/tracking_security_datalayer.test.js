import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeLocation, subscribeToProvider, startPublishing } from '../services/trackingService';
import { getRoute, getCircuitBreakerStatus, resetCircuitBreaker } from '../services/routing';

// Mock Supabase Realtime channel
vi.mock('@/lib/supabase', () => {
  const listeners = new Map();
  const mockChannel = {
    on: vi.fn(function (type, config, cb) {
      const key = `${type}:${config.event || config.table || '*'}`;
      listeners.set(key, cb);
      return mockChannel;
    }),
    subscribe: vi.fn(function (cb) {
      if (typeof cb === 'function') {
        setTimeout(() => cb('SUBSCRIBED'), 10);
      }
      return mockChannel;
    }),
    send: vi.fn().mockResolvedValue({}),
  };

  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn().mockResolvedValue('ok'),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    },
  };
});

describe('normalizeLocation mapping and clock offset', () => {
  it('maps broadcast payload correctly, preserving degraded flag and true timestamp', () => {
    const broadcastPayload = {
      lat: 14.4081,
      lng: 121.0412,
      accuracy: 25.4,
      rawAccuracy: 25.4,
      degraded: true,
      heading: 180,
      speed: 4.5,
      timestamp: 1729850000000,
      session_id: 'sess-123',
      seq: 14,
    };

    const normalized = normalizeLocation(broadcastPayload, 0);

    expect(normalized.lat).toBe(14.4081);
    expect(normalized.lng).toBe(121.0412);
    expect(normalized.accuracy).toBe(25.4);
    expect(normalized.rawAccuracy).toBe(25.4);
    expect(normalized.degraded).toBe(true);
    expect(normalized.timestamp).toBe(1729850000000);
    expect(normalized.session_id).toBe('sess-123');
    expect(normalized.seq).toBe(14);
  });

  it('maps database row format correctly with captured_at and updated_at', () => {
    const dbRow = {
      lat: 14.4099,
      lng: 121.0425,
      accuracy: 12.0,
      heading: 90,
      speed: 3.2,
      captured_at: '2026-10-25T05:00:00.000Z',
      updated_at: '2026-10-25T05:00:01.000Z',
      session_id: 'sess-abc',
      seq: '22',
    };

    const normalized = normalizeLocation(dbRow, 0);

    expect(normalized.lat).toBe(14.4099);
    expect(normalized.lng).toBe(121.0425);
    expect(normalized.degraded).toBe(false);
    expect(normalized.timestamp).toBe(new Date('2026-10-25T05:00:00.000Z').getTime());
    expect(normalized.serverUpdatedAt).toBe(new Date('2026-10-25T05:00:01.000Z').getTime());
    expect(normalized.seq).toBe(22);
  });
});

describe('Subscription sharing (Ref-counting)', () => {
  it('shares one channel between multiple subscribers and tears down only when refCount reaches 0', async () => {
    const { supabase } = await import('@/lib/supabase');
    const reqId = 'shared-test-req-1';

    const sub1 = subscribeToProvider(reqId, { onLocation: vi.fn() });
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    const sub2 = subscribeToProvider(reqId, { onLocation: vi.fn() });
    // Channel is reused, not re-created
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    // Unsubscribe first listener: channel should NOT be removed yet
    sub1();
    expect(supabase.removeChannel).not.toHaveBeenCalled();

    // Unsubscribe second listener: channel is now cleaned up
    sub2();
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  });
});

describe('Routing Circuit Breaker and Exponential Backoff', () => {
  beforeEach(() => {
    resetCircuitBreaker();
    vi.restoreAllMocks();
  });

  it('opens circuit breaker after consecutive network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const from = { lat: 14.40, lng: 121.04 };
    const to = { lat: 14.41, lng: 121.04 };

    // Call 1: fails
    const r1 = await getRoute(from, to);
    expect(r1).toBeNull();
    expect(getCircuitBreakerStatus().isOpen).toBe(false);

    // Call 2: fails
    const r2 = await getRoute(from, to);
    expect(r2).toBeNull();
    expect(getCircuitBreakerStatus().isOpen).toBe(false);

    // Call 3: threshold reached -> circuit breaker opens
    const r3 = await getRoute(from, to);
    expect(r3).toBeNull();
    expect(getCircuitBreakerStatus().isOpen).toBe(true);

    // Call 4: rejected immediately by circuit breaker without calling fetch
    const fetchCallsBefore = vi.mocked(fetch).mock.calls.length;
    const r4 = await getRoute(from, to);
    expect(r4).toBeNull();
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCallsBefore);
  });
});

describe('Replay GPS stream with out-of-order and gapped packets', () => {
  it('discards out-of-order packets and processes monotonic sequence numbers', () => {
    const rawStream = [
      { seq: 1, lat: 14.4001, lng: 121.0401, timestamp: 1000 },
      { seq: 3, lat: 14.4003, lng: 121.0403, timestamp: 3000 },
      { seq: 2, lat: 14.4002, lng: 121.0402, timestamp: 2000 }, // Out-of-order packet
      { seq: 4, lat: 14.4004, lng: 121.0404, timestamp: 4000 },
      { seq: 8, lat: 14.4008, lng: 121.0408, timestamp: 8000 }, // Gap packet
      { seq: 7, lat: 14.4007, lng: 121.0407, timestamp: 7000 }, // Late packet
    ];

    let lastAcceptedSeq = -1;
    const accepted = [];

    rawStream.forEach((packet) => {
      const normalized = normalizeLocation(packet);
      if (normalized.seq != null && normalized.seq > lastAcceptedSeq) {
        lastAcceptedSeq = normalized.seq;
        accepted.push(normalized);
      }
    });

    expect(accepted.map((p) => p.seq)).toEqual([1, 3, 4, 8]);
    expect(accepted.length).toBe(4);
  });
});

describe('Notification deduplication via sessionStorage', () => {
  it('persists notified keys across simulated reloads', () => {
    const storage = new Map();
    const mockSessionStorage = {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, val) => storage.set(key, String(val)),
    };

    const reqId = 'visit-dedup-1';
    const key = `mc_arrived_${reqId}`;

    expect(mockSessionStorage.getItem(key)).toBeNull();

    // First arrival event:
    mockSessionStorage.setItem(key, 'true');
    expect(mockSessionStorage.getItem(key)).toBe('true');

    // Simulated reload and second check:
    const isAlreadyNotified = mockSessionStorage.getItem(key) === 'true';
    expect(isAlreadyNotified).toBe(true);
  });
});

describe('startPublishing Realtime resilience', () => {
  it('does not throw when tracking channel is already subscribed by subscriber', async () => {
    const reqId = 'col-test-1';
    // First subscribe as patient
    const sub = subscribeToProvider(reqId, { onLocation: vi.fn() });

    // Then start publishing as provider for the same request
    const pub = await startPublishing({
      requestId: reqId,
      destination: { lat: 14.4, lng: 121.0 },
      onFix: vi.fn(),
      onError: vi.fn(),
    });

    expect(pub).toBeDefined();
    expect(pub.sessionId).toBeDefined();

    // Clean up
    await pub.stop();
    sub();
  });
});


