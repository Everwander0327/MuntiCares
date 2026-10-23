import { supabase } from '@/lib/supabase';
import { startLocationWatch } from './locationSource';
import { createGpsFilter } from './gpsFilter';
import { haversine } from './geo';

export const TRACKING_STATUS = 'On The Way';
export const ARRIVAL_RADIUS_M = 50;
export const TRACKING_STALE_MS = 45000;

const BROADCAST_EVERY_MS = 3000;
const PERSIST_EVERY_MS = 15000;
const HEARTBEAT_EVERY_MS = 20000;
const FALLBACK_POLL_MS = 8000;

export const trackingChannelName = (requestId) => `tracking:${requestId}`;

function makeSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toDestination(row) {
  if (row?.dest_lat == null || row?.dest_lng == null) return null;
  return {
    lat: Number(row.dest_lat),
    lng: Number(row.dest_lng),
    address: row.dest_address || null,
    source: row.dest_source || null,
    version: Number(row.dest_version || 0),
  };
}

function normalizeLocation(row) {
  const timestamp = row.captured_at
    ? new Date(row.captured_at).getTime()
    : new Date(row.updated_at || Date.now()).getTime();
  return {
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    heading: row.heading == null ? null : Number(row.heading),
    speed: row.speed == null ? null : Number(row.speed),
    timestamp,
    serverUpdatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    session_id: row.session_id || null,
    seq: row.seq == null ? null : Number(row.seq),
  };
}

function waitForSubscription(channel, timeoutMs = 7000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };
    const timer = setTimeout(() => finish('TIMED_OUT'), timeoutMs);
    channel.subscribe((status) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        finish(status);
      }
    });
  });
}

/**
 * Snapshot the patient's home coordinates onto the visit if it has no
 * destination yet. Returns { lat, lng, address, source, version } or null.
 */
export async function prepareTrackingDestination(requestId) {
  const { data, error } = await supabase.rpc('prepare_tracking_destination', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data?.prepared ? toDestination(data) : null;
}

/** Patient-side destination edit. Increments dest_version on the server. */
export async function updateTrackingDestination(requestId, destination) {
  const { lat, lng, address = null, source = 'manual' } = destination || {};
  const { data, error } = await supabase.rpc('update_tracking_destination', {
    p_request_id: requestId,
    p_lat: lat,
    p_lng: lng,
    p_address: address,
    p_source: source,
  });
  if (error) throw error;
  return toDestination(data);
}

/**
 * Start a tracking session and publish the provider's location.
 * Returns { stop, setDestination }.
 */
export async function startPublishing({
  requestId,
  destination,
  onFix,
  onGpsError,
  onError,
  onNearDestination,
  onSession,
}) {
  const sessionId = makeSessionId();
  let currentDestination = destination || null;
  const filter = createGpsFilter();
  let latest = null;
  let sequence = 0;
  let lastBroadcast = 0;
  let lastPersist = 0;
  let nearNotified = false;
  let stopped = false;
  let stopPromise = null;
  let heartbeatTimer = null;
  let stopWatch = async () => {};

  const channel = supabase.channel(trackingChannelName(requestId), {
    config: {
      private: true,
      broadcast: { self: false, ack: false },
    },
  });

  const stop = (reason = 'ended') => {
    if (stopPromise) return stopPromise;
    stopped = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    stopPromise = (async () => {
      try { await stopWatch(); } catch { /* ignore */ }
      try {
        await channel.send({
          type: 'broadcast',
          event: 'stopped',
          payload: { session_id: sessionId, reason },
        });
      } catch { /* ignore */ }
      try {
        const { error } = await supabase.rpc('end_tracking_session', {
          p_request_id: requestId,
          p_session_id: sessionId,
          p_reason: reason,
        });
        if (error) console.warn('[tracking] session end failed', error.message);
      } catch (err) {
        console.warn('[tracking] session end failed', err?.message || err);
      }
      await supabase.removeChannel(channel);
    })();
    return stopPromise;
  };

  const startSession = async () => {
    if (stopped) return;
    try {
      const { data, error } = await supabase.rpc('start_tracking_session', {
        p_request_id: requestId,
        p_session_id: sessionId,
      });
      if (error) {
        if (error.message?.includes('On The Way') || error.code === 'P0001') {
          await stop('not_on_the_way');
          return;
        }
        throw error;
      }
      if (data?.error === 'not_on_the_way') {
        await stop('not_on_the_way');
        return;
      }
      onSession?.({
        sessionId,
        status: 'active',
        startedAt: data?.started_at ? new Date(data.started_at).getTime() : Date.now(),
        destination: toDestination(data),
      });
    } catch (err) {
      if (err?.message?.includes('On The Way')) {
        await stop('not_on_the_way');
        return;
      }
      throw err;
    }
  };

  // The session must exist before the first private broadcast/persist.
  await startSession();
  if (stopped) {
    return {
      sessionId,
      setDestination() {},
      getLatest() { return null; },
      stop,
    };
  }

  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
    ({ new: row }) => {
      if (row && row.status !== TRACKING_STATUS) {
        stop(`status_${row.status?.toLowerCase() || 'ended'}`);
      }
    }
  );

  const status = await waitForSubscription(channel);
  if (status !== 'SUBSCRIBED' && !stopped) {
    onError?.(new Error('Live sync is reconnecting; your location is still being saved securely.'));
  }

  const persist = (fix) => {
    if (!fix || stopped) return;
    const capturedAt = fix.timestamp > 0
      ? new Date(fix.timestamp).toISOString()
      : new Date().toISOString();
    supabase
      .rpc('record_provider_location', {
        p_request_id: requestId,
        p_session_id: sessionId,
        p_seq: fix.seq,
        p_lat: fix.lat,
        p_lng: fix.lng,
        p_accuracy: fix.accuracy,
        p_heading: fix.heading,
        p_speed: fix.speed,
        p_captured_at: capturedAt,
      })
      .then(({ error }) => {
        if (error) console.warn('[tracking] persist failed', error.message);
      });
  };

  const heartbeat = async () => {
    if (stopped) return;
    try {
      const { data, error } = await supabase.rpc('touch_tracking_session', {
        p_request_id: requestId,
        p_session_id: sessionId,
      });
      if (error) {
        if (error.message?.includes('On The Way') || error.code === 'P0001') {
          await stop('ended');
          return;
        }
        onError?.(new Error('Unable to confirm the live tracking session. Retrying…'));
        return;
      }
      if (data === false) {
        if (stopped) return;
        const { data: req } = await supabase
          .from('requests')
          .select('status')
          .eq('id', requestId)
          .maybeSingle();

        if (!req || req.status !== TRACKING_STATUS) {
          await stop(req?.status ? `status_${req.status.toLowerCase()}` : 'ended');
          return;
        }

        await startSession();
      }
    } catch (err) {
      if (err?.message?.includes('On The Way')) {
        await stop('ended');
        return;
      }
      onError?.(err instanceof Error ? err : new Error('Tracking heartbeat failed.'));
    }
  };

  const handleFix = (raw) => {
    if (stopped) return;
    const fix = filter(raw);
    if (!fix) return;

    sequence += 1;
    const outgoing = {
      ...fix,
      session_id: sessionId,
      seq: sequence,
    };
    latest = outgoing;
    onFix?.(outgoing);

    const now = Date.now();
    if (now - lastBroadcast >= BROADCAST_EVERY_MS || !lastBroadcast) {
      lastBroadcast = now;
      channel.send({ type: 'broadcast', event: 'location', payload: outgoing }).catch(() => {});
    }
    if (now - lastPersist >= PERSIST_EVERY_MS || !lastPersist) {
      lastPersist = now;
      persist(outgoing);
    }

    if (currentDestination && !fix.degraded && !nearNotified) {
      const distance = haversine(fix, currentDestination);
      if (distance <= ARRIVAL_RADIUS_M) {
        nearNotified = true;
        onNearDestination?.(distance);
      }
    }
  };

  try {
    stopWatch = await startLocationWatch(
      handleFix,
      (err) => (onGpsError || onError)?.(err)
    );
  } catch (err) {
    await stop('gps_start_failed');
    throw err;
  }

  if (stopped) {
    try { await stopWatch(); } catch { /* ignore */ }
  } else {
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_EVERY_MS);
  }

  return {
    sessionId,
    setDestination(next) {
      currentDestination = next || null;
      nearNotified = false;
    },
    getLatest() {
      return latest;
    },
    stop,
  };
}

/**
 * Patient-side live subscription.
 * Loads the latest persisted location immediately, then listens to private
 * broadcasts, provider_locations changes, session state, and request changes.
 */
export function subscribeToProvider(requestId, {
  onLocation,
  onStopped,
  onSession,
  onRequest,
  onError,
} = {}) {
  let alive = true;
  let pollTimer = null;
  let lastSessionId = null;
  let lastSeq = -1;
  let lastSessionStatus = null;

  const acceptLocation = (row) => {
    const next = normalizeLocation(row);
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
    if (next.session_id && next.session_id !== lastSessionId) {
      lastSessionId = next.session_id;
      lastSeq = -1;
    }
    if (next.seq != null) {
      if (next.seq <= lastSeq) return;
      lastSeq = next.seq;
    }
    onLocation?.(next);
  };

  const acceptSession = (row) => {
    if (!row) return;
    const session = {
      sessionId: row.session_id,
      status: row.status,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : null,
      endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
      stopReason: row.stop_reason || null,
    };
    onSession?.(session);
    if (row.status !== 'active' && row.status !== lastSessionStatus) {
      lastSessionStatus = row.status;
      onStopped?.(session);
    }
    if (row.status === 'active') lastSessionStatus = 'active';
  };

  const refresh = async () => {
    if (!alive) return;
    const [locationRes, sessionRes] = await Promise.all([
      supabase
        .from('provider_locations')
        .select('*')
        .eq('request_id', requestId)
        .maybeSingle(),
      supabase
        .from('tracking_sessions')
        .select('session_id, status, last_seen_at, ended_at, stop_reason')
        .eq('request_id', requestId)
        .maybeSingle(),
    ]);
    if (!alive) return;
    if (locationRes.error) {
      onError?.(locationRes.error);
    } else if (locationRes.data) {
      acceptLocation(locationRes.data);
    }
    if (!sessionRes.error && sessionRes.data) acceptSession(sessionRes.data);
  };

  const startPolling = () => {
    if (pollTimer || !alive) return;
    pollTimer = setInterval(refresh, FALLBACK_POLL_MS);
  };
  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  refresh();

  const channel = supabase
    .channel(trackingChannelName(requestId), {
      config: { private: true, broadcast: { self: false } },
    })
    .on('broadcast', { event: 'location' }, ({ payload }) => {
      if (payload) acceptLocation(payload);
    })
    .on('broadcast', { event: 'stopped' }, ({ payload }) => {
      if (payload?.session_id && lastSessionId && payload.session_id !== lastSessionId) return;
      lastSessionStatus = 'ended';
      onStopped?.({
        sessionId: payload?.session_id || null,
        status: 'ended',
        stopReason: payload?.reason || 'ended',
      });
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'provider_locations', filter: `request_id=eq.${requestId}` },
      ({ new: row }) => {
        if (row?.lat != null) acceptLocation(row);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tracking_sessions', filter: `request_id=eq.${requestId}` },
      ({ new: row }) => acceptSession(row)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
      ({ new: row }) => onRequest?.(row)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        stopPolling();
        refresh();
      } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        startPolling();
      }
    });

  return () => {
    alive = false;
    stopPolling();
    supabase.removeChannel(channel);
  };
}
