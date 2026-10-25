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

/**
 * Normalizes both broadcast payloads and database row shapes into a unified model.
 * Preserves the `degraded` flag and true timestamp, and applies server clock offset.
 */
export function normalizeLocation(row, serverClockOffset = 0) {
  if (!row) return null;
  const capturedAtTime = row.captured_at ? new Date(row.captured_at).getTime() : null;
  const rawTimestamp = row.timestamp != null ? Number(row.timestamp) : null;
  const updatedAtTime = row.updated_at ? new Date(row.updated_at).getTime() : null;

  const timestamp = rawTimestamp ?? capturedAtTime ?? updatedAtTime ?? (Date.now() + serverClockOffset);
  const accuracy = row.accuracy == null ? null : Number(row.accuracy);
  const rawAccuracy = row.rawAccuracy == null ? accuracy : Number(row.rawAccuracy);

  return {
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy,
    rawAccuracy,
    degraded: Boolean(row.degraded),
    heading: row.heading == null ? null : Number(row.heading),
    speed: row.speed == null ? null : Number(row.speed),
    timestamp,
    serverUpdatedAt: updatedAtTime,
    session_id: row.session_id || null,
    seq: row.seq == null ? null : Number(row.seq),
  };
}

function waitForSubscription(channel, timeoutMs = 7000) {
  if (channel.state === 'joined' || channel.channelAdapter?.isJoined?.()) {
    return Promise.resolve('SUBSCRIBED');
  }
  return new Promise((resolve) => {
    let settled = false;
    let pollInterval = null;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (pollInterval) clearInterval(pollInterval);
      resolve(status);
    };
    const timer = setTimeout(() => finish('TIMED_OUT'), timeoutMs);

    if (channel.state === 'joining' || channel.channelAdapter?.isJoining?.()) {
      pollInterval = setInterval(() => {
        if (channel.state === 'joined' || channel.channelAdapter?.isJoined?.()) {
          finish('SUBSCRIBED');
        } else if (channel.state === 'closed' || channel.channelAdapter?.isClosed?.()) {
          finish('CLOSED');
        }
      }, 100);
      return;
    }

    channel.subscribe((status) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        finish(status);
      }
    });
  });
}

/**
 * Shared helper to mark a visit as arrived through the secure RPC.
 * Returns structured result: { ok: boolean, reason?: string, distance_m?: number, accuracy_m?: number }
 */
export async function markVisitArrived(requestId, sessionId = null, overrideReason = null) {
  try {
    const { data, error } = await supabase.rpc('mark_arrived', {
      p_request_id: requestId,
      p_session_id: sessionId,
      p_override_reason: overrideReason,
    });
    if (error) {
      // If mark_arrived has not been created in Supabase yet (404 / PGRST202), fallback gracefully
      if (error.code === 'PGRST202' || error.message?.includes('404') || error.message?.includes('not found')) {
        const { error: fallbackError } = await supabase
          .from('requests')
          .update({ status: 'Arrived', arrived_at: new Date().toISOString() })
          .eq('id', requestId);
        if (fallbackError) throw fallbackError;
        return { ok: true, status: 'Arrived', fallback: true };
      }
      throw error;
    }
    return data;
  } catch (err) {
    if (err?.code === 'PGRST202' || err?.message?.includes('404') || err?.message?.includes('not found')) {
      const { error: fallbackError } = await supabase
        .from('requests')
        .update({ status: 'Arrived', arrived_at: new Date().toISOString() })
        .eq('id', requestId);
      if (fallbackError) throw fallbackError;
      return { ok: true, status: 'Arrived', fallback: true };
    }
    throw err;
  }
}

export function formatArrivalFailure(res) {
  if (!res) return 'Unable to confirm arrival location.';
  switch (res.reason) {
    case 'too_far':
      return `${Math.round(res.distance_m || 0)} m from visit — arrive within 50 m to unlock.`;
    case 'low_accuracy':
      return `Waiting for precise GPS (current accuracy is ±${Math.round(res.accuracy_m || 0)} m).`;
    case 'stale_location':
      return `Location signal delayed (${res.age_seconds || 45}s old). Waiting for fresh GPS.`;
    case 'no_location':
      return 'Waiting for GPS location to be recorded.';
    case 'no_destination':
      return 'Visit destination coordinates are missing.';
    case 'not_on_the_way':
      return 'Visit status is no longer "On The Way".';
    case 'override_conditions_not_met':
      return 'Override conditions not met: must be within 150 m for at least 3 minutes.';
    default:
      return res.message || 'Arrival criteria not met. Please move closer to the visit location.';
  }
}

/**
 * Snapshot the patient's home coordinates onto the visit if it has no
 * destination yet. Returns { lat, lng, address, source, version } or null.
 */
export async function prepareTrackingDestination(requestId) {
  try {
    const { data, error } = await supabase.rpc('prepare_tracking_destination', {
      p_request_id: requestId,
    });
    if (error) {
      if (error.code === 'PGRST202' || error.message?.includes('404') || error.message?.includes('not found')) {
        const { data: req } = await supabase
          .from('requests')
          .select('dest_lat, dest_lng, dest_address, dest_source, dest_version')
          .eq('id', requestId)
          .maybeSingle();
        return toDestination(req);
      }
      throw error;
    }
    return data?.prepared ? toDestination(data) : null;
  } catch (err) {
    if (err?.code === 'PGRST202' || err?.message?.includes('404') || err?.message?.includes('not found')) {
      const { data: req } = await supabase
        .from('requests')
        .select('dest_lat, dest_lng, dest_address, dest_source, dest_version')
        .eq('id', requestId)
        .maybeSingle();
      return toDestination(req);
    }
    throw err;
  }
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
 * Supports explicit takeover, session conflict detection, trailing send, and heartbeat backoff.
 */
export async function startPublishing({
  requestId,
  destination,
  onFix,
  onGpsError,
  onError,
  onNearDestination,
  onSession,
  onSessionConflict,
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
  let trailingBroadcastTimer = null;
  let trailingPersistTimer = null;
  let stopWatch = async () => {};

  const channel = supabase.channel(trackingChannelName(requestId), {
    config: {
      broadcast: { self: false, ack: false },
    },
  });

  const sendBroadcast = async (event, payload) => {
    try {
      const canPush = Boolean(channel.channelAdapter?.canPush?.() || channel.canPush?.());
      if (canPush) {
        return await channel.send({ type: 'broadcast', event, payload });
      }
      if (typeof channel.httpSend === 'function') {
        return await channel.httpSend({ type: 'broadcast', event, payload });
      }
      return await channel.send({ type: 'broadcast', event, payload });
    } catch {
      // Best-effort broadcast delivery
    }
  };

  const statusChannel = supabase
    .channel(`tracking-pub-status:${requestId}:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
      ({ new: row }) => {
        if (row && row.status !== TRACKING_STATUS) {
          stop(`status_${row.status?.toLowerCase() || 'ended'}`);
        }
      }
    );

  const stop = (reason = 'ended') => {
    if (stopPromise) return stopPromise;
    stopped = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (trailingBroadcastTimer) clearTimeout(trailingBroadcastTimer);
    if (trailingPersistTimer) clearTimeout(trailingPersistTimer);

    stopPromise = (async () => {
      try { await stopWatch(); } catch { /* ignore */ }
      try {
        await sendBroadcast('stopped', { session_id: sessionId, reason });
      } catch { /* ignore */ }
      try {
        const { error } = await supabase.rpc('end_tracking_session', {
          p_request_id: requestId,
          p_session_id: sessionId,
          p_reason: reason,
        });
        if (error && error.code !== 'PGRST202' && !error.message?.includes('404')) {
          console.warn('[tracking] session end failed', error.message);
        }
      } catch (err) {
        console.warn('[tracking] session end failed', err?.message || err);
      }
      try {
        await supabase.removeChannel(statusChannel);
      } catch { /* ignore */ }
      try {
        const sharedEntry = sharedSubscriptions.get(requestId);
        if (!sharedEntry || sharedEntry.refCount <= 0) {
          await supabase.removeChannel(channel);
        }
      } catch { /* ignore */ }
    })();
    return stopPromise;
  };

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
      .then(async ({ error }) => {
        if (error) {
          if (error.code === 'PGRST202' || error.message?.includes('404') || error.message?.includes('not found')) {
            try {
              await supabase.from('provider_locations').upsert({
                request_id: requestId,
                session_id: sessionId,
                seq: fix.seq,
                lat: fix.lat,
                lng: fix.lng,
                accuracy: fix.accuracy,
                heading: fix.heading,
                speed: fix.speed,
                captured_at: capturedAt,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'request_id' });
            } catch { /* ignore fallback errors */ }
            return;
          }
          console.warn('[tracking] persist failed', error.message);
        }
      })
      .catch((err) => console.warn('[tracking] persist failed', err?.message || err));
  };

  const startSession = async (takeover = false) => {
    if (stopped) return;
    try {
      const rpcPayload = {
        p_request_id: requestId,
        p_session_id: sessionId,
        p_takeover: Boolean(takeover),
      };

      let { data, error } = await supabase.rpc('start_tracking_session', rpcPayload);

      // If database only has the older 2-arg signature without p_takeover, retry with 2 args:
      if (error && error.code === 'PGRST202') {
        const fallbackRes = await supabase.rpc('start_tracking_session', {
          p_request_id: requestId,
          p_session_id: sessionId,
        });
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      // If ambiguous overload (PGRST203) or missing function (PGRST202 / 404):
      if (error && (error.code === 'PGRST203' || error.code === 'PGRST202' || error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('best candidate'))) {
        const { data: req, error: reqError } = await supabase
          .from('requests')
          .select('id, status, dest_lat, dest_lng, dest_address, dest_source, dest_version')
          .eq('id', requestId)
          .maybeSingle();

        if (reqError) throw reqError;
        if (!req || req.status !== TRACKING_STATUS) {
          await stop('not_on_the_way');
          return;
        }

        onSession?.({
          sessionId,
          status: 'active',
          startedAt: Date.now(),
          destination: toDestination(req),
        });
        return;
      }

      if (error) {
        if (error.code === '42501' || error.message?.includes('Not allowed') || error.message?.includes('Not authenticated')) {
          await stop('not_allowed');
          onError?.(new Error('You are not authorized to track this visit.'));
          return;
        }
        if (error.code === 'P0002') {
          await stop('not_found');
          onError?.(new Error('Visit request not found.'));
          return;
        }
        throw error;
      }

      if (data?.error === 'session_active_elsewhere') {
        onSessionConflict?.({
          message: data.message,
          lastSeenAt: data.last_seen_at ? new Date(data.last_seen_at).getTime() : Date.now(),
        });
        onError?.(new Error('Tracking is active on another device.'));
        return;
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
      onError?.(err instanceof Error ? err : new Error('Unable to start live tracking session. Retrying…'));
    }
  };

  await startSession(false);
  if (stopped) {
    return {
      sessionId,
      setDestination() {},
      getLatest() { return null; },
      takeover: () => {},
      stop,
    };
  }

  statusChannel.subscribe();

  const subStatus = await waitForSubscription(channel);
  if (subStatus !== 'SUBSCRIBED' && !stopped) {
    onError?.(new Error('Live sync is reconnecting; your location is still being saved securely.'));
  }

  const heartbeat = async () => {
    if (stopped) return;
    try {
      const { data, error } = await supabase.rpc('touch_tracking_session', {
        p_request_id: requestId,
        p_session_id: sessionId,
      });

      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('404') || error.message?.includes('not found')) {
          const { data: req } = await supabase
            .from('requests')
            .select('status')
            .eq('id', requestId)
            .maybeSingle();
          if (req && req.status !== TRACKING_STATUS) {
            await stop(`status_${req.status.toLowerCase()}`);
          }
          return;
        }
        if (error.code === '42501') {
          await stop('ended');
          return;
        }
        onError?.(new Error('Live tracking heartbeat failed. Retrying…'));
        return;
      }

      // If false, another session took over or this session ended
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

        // Session was superseded by another device. Do not auto-reclaim!
        await stop('session_active_elsewhere');
        onError?.(new Error('Tracking moved to another device.'));
      }
    } catch (err) {
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

    // Broadcast cadence: immediately if interval elapsed, else schedule trailing send
    if (now - lastBroadcast >= BROADCAST_EVERY_MS || !lastBroadcast) {
      lastBroadcast = now;
      if (trailingBroadcastTimer) clearTimeout(trailingBroadcastTimer);
      sendBroadcast('location', outgoing);
    } else {
      if (trailingBroadcastTimer) clearTimeout(trailingBroadcastTimer);
      trailingBroadcastTimer = setTimeout(() => {
        if (!stopped && latest) {
          lastBroadcast = Date.now();
          sendBroadcast('location', latest);
        }
      }, BROADCAST_EVERY_MS + 200);
    }

    // Persist cadence: immediately if interval elapsed, else schedule trailing persist
    if (now - lastPersist >= PERSIST_EVERY_MS || !lastPersist) {
      lastPersist = now;
      if (trailingPersistTimer) clearTimeout(trailingPersistTimer);
      persist(outgoing);
    } else {
      if (trailingPersistTimer) clearTimeout(trailingPersistTimer);
      trailingPersistTimer = setTimeout(() => {
        if (!stopped && latest) {
          lastPersist = Date.now();
          persist(latest);
        }
      }, PERSIST_EVERY_MS + 500);
    }

    if (currentDestination && !fix.degraded && !nearNotified) {
      const distance = haversine(fix, currentDestination);
      if (distance <= ARRIVAL_RADIUS_M) {
        nearNotified = true;
        onNearDestination?.(distance);
      }
    }
  };

  // Best-effort pagehide beacon
  const onPageHide = () => {
    if (stopped) return;
    try {
      supabase.rpc('end_tracking_session', {
        p_request_id: requestId,
        p_session_id: sessionId,
        p_reason: 'pagehide',
      });
    } catch { /* best effort */ }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
  }

  try {
    stopWatch = await startLocationWatch(
      handleFix,
      (err) => (onGpsError || onError)?.(err)
    );
  } catch (err) {
    await stop('gps_start_failed');
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
    throw err;
  }

  if (stopped) {
    try { await stopWatch(); } catch { /* ignore */ }
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
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
    takeover() {
      return startSession(true);
    },
    stop: async (reason) => {
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
      return stop(reason);
    },
  };
}

// ---------------------------------------------------------------------------
// Ref-Counted Shared Subscription Registry
// ---------------------------------------------------------------------------
const sharedSubscriptions = new Map();

/**
 * Shared subscription per requestId.
 * Multiple listeners (e.g. PatientTrackingMonitor and LiveVisitTrackerModal)
 * share one channel. Only when all listeners detach is the channel unsubscribed.
 */
export function subscribeToProvider(requestId, listener = {}) {
  let entry = sharedSubscriptions.get(requestId);

  if (!entry) {
    let lastSessionId = null;
    let lastSeq = -1;
    let lastSessionStatus = null;
    let pollTimer = null;
    let serverClockOffset = 0;

    const listeners = new Set();

    const broadcast = (fn) => {
      listeners.forEach((l) => {
        try { fn(l); } catch (e) { console.error('[tracking] listener error', e); }
      });
    };

    const acceptLocation = (row) => {
      const next = normalizeLocation(row, serverClockOffset);
      if (!next || !Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

      if (next.serverUpdatedAt) {
        serverClockOffset = next.serverUpdatedAt - Date.now();
      }

      if (next.session_id && next.session_id !== lastSessionId) {
        lastSessionId = next.session_id;
        lastSeq = -1;
      }
      if (next.seq != null) {
        if (next.seq <= lastSeq) return;
        lastSeq = next.seq;
      }
      entry.lastLocation = next;
      broadcast((l) => l.onLocation?.(next));
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
      entry.lastSession = session;
      broadcast((l) => l.onSession?.(session));
      if (row.status !== 'active' && row.status !== lastSessionStatus) {
        lastSessionStatus = row.status;
        broadcast((l) => l.onStopped?.(session));
      }
      if (row.status === 'active') lastSessionStatus = 'active';
    };

    const refresh = async () => {
      if (!entry || !entry.alive) return;
      try {
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

        if (!entry.alive) return;
        if (locationRes.error) {
          broadcast((l) => l.onError?.(locationRes.error));
        } else if (locationRes.data) {
          acceptLocation(locationRes.data);
        }
        if (!sessionRes.error && sessionRes.data) {
          acceptSession(sessionRes.data);
        }
      } catch (err) {
        if (entry.alive) broadcast((l) => l.onError?.(err));
      }
    };

    const startPolling = () => {
      if (pollTimer || !entry.alive) return;
      pollTimer = setInterval(refresh, FALLBACK_POLL_MS);
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const channel = supabase
      .channel(trackingChannelName(requestId), {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        if (payload) acceptLocation(payload);
      })
      .on('broadcast', { event: 'stopped' }, ({ payload }) => {
        if (payload?.session_id && lastSessionId && payload.session_id !== lastSessionId) return;
        lastSessionStatus = 'ended';
        const endedSession = {
          sessionId: payload?.session_id || null,
          status: 'ended',
          stopReason: payload?.reason || 'ended',
        };
        broadcast((l) => l.onStopped?.(endedSession));
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
        ({ new: row }) => {
          entry.lastRequest = row;
          broadcast((l) => l.onRequest?.(row));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          stopPolling();
          refresh();
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          startPolling();
        }
      });

    entry = {
      requestId,
      channel,
      refCount: 0,
      listeners,
      alive: true,
      lastLocation: null,
      lastSession: null,
      lastRequest: null,
      refresh,
      stopPolling,
      destroy: () => {
        entry.alive = false;
        stopPolling();
        supabase.removeChannel(channel);
      },
    };

    sharedSubscriptions.set(requestId, entry);
    refresh();
  }

  entry.refCount += 1;
  entry.listeners.add(listener);

  // Immediately replay latest cached state to this listener
  if (entry.lastLocation) listener.onLocation?.(entry.lastLocation);
  if (entry.lastSession) listener.onSession?.(entry.lastSession);
  if (entry.lastRequest) listener.onRequest?.(entry.lastRequest);

  return () => {
    entry.listeners.delete(listener);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.destroy();
      sharedSubscriptions.delete(requestId);
    }
  };
}
