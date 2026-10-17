import { supabase } from '@/lib/supabase';
import { startLocationWatch } from './locationSource';
import { createGpsFilter } from './gpsFilter';
import { ensurePatientCoords } from './geocoding';
import { haversine } from './geo';

export const TRACKING_STATUS = 'On The Way';
export const ARRIVAL_RADIUS_M = 50;
const BROADCAST_EVERY_MS = 3000;
const PERSIST_EVERY_MS = 15000;

export const trackingChannelName = (requestId) => `tracking:${requestId}`;

/**
 * Snapshot destination onto the request (so the patient map has a fixed pin).
 */
export async function prepareRoute(requestId, patientId) {
  const dest = await ensurePatientCoords(patientId);
  const patch = { route_started_at: new Date().toISOString() };
  if (dest) { patch.dest_lat = dest.lat; patch.dest_lng = dest.lng; }
  await supabase.from('requests').update(patch).eq('id', requestId);
  return dest;
}

/**
 * Start publishing the provider's location for a visit.
 * Returns { stop } . Callbacks: onFix(filteredFix), onError(err), onNearDestination(distanceM)
 */
export async function startPublishing({ requestId, providerId, destination, onFix, onError, onNearDestination }) {
  const filter = createGpsFilter();
  const channel = supabase.channel(trackingChannelName(requestId), {
    config: { broadcast: { self: false, ack: false } },
  });
  await new Promise((resolve) => {
    channel.subscribe((status) => { if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(); });
  });

  let lastBroadcast = 0;
  let lastPersist = 0;
  let nearNotified = false;
  let latest = null;

  const persist = async (fix) => {
    const { error } = await supabase.from('provider_locations').upsert({
      request_id: requestId,
      provider_id: providerId,
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
      heading: fix.heading,
      speed: fix.speed,
      updated_at: new Date(fix.timestamp).toISOString(),
    });
    if (error) console.warn('[tracking] persist failed', error.message);
  };

  const stopWatch = await startLocationWatch((raw) => {
    const fix = filter(raw);
    if (!fix) return;
    latest = fix;
    onFix?.(fix);

    const now = Date.now();
    if (now - lastBroadcast >= BROADCAST_EVERY_MS) {
      lastBroadcast = now;
      channel.send({ type: 'broadcast', event: 'location', payload: fix });
    }
    if (now - lastPersist >= PERSIST_EVERY_MS || !lastPersist) {
      lastPersist = now;
      persist(fix);
    }
    if (destination && !nearNotified) {
      const d = haversine(fix, destination);
      if (d <= ARRIVAL_RADIUS_M) { nearNotified = true; onNearDestination?.(d); }
    }
  }, onError);

  return {
    stop: async () => {
      await stopWatch();
      if (latest) await persist(latest);
      channel.send({ type: 'broadcast', event: 'stopped', payload: {} });
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Patient-side subscription. onLocation(fix), onStopped().
 * Loads the last persisted location immediately, then streams broadcasts + DB updates.
 */
export function subscribeToProvider(requestId, { onLocation, onStopped }) {
  let alive = true;

  supabase
    .from('provider_locations')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle()
    .then(({ data }) => {
      if (alive && data) onLocation({ ...data, timestamp: new Date(data.updated_at).getTime() });
    });

  const channel = supabase
    .channel(trackingChannelName(requestId))
    .on('broadcast', { event: 'location' }, ({ payload }) => onLocation(payload))
    .on('broadcast', { event: 'stopped' }, () => onStopped?.())
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'provider_locations', filter: `request_id=eq.${requestId}` },
      ({ new: row }) => {
        if (row?.lat != null) onLocation({ ...row, timestamp: new Date(row.updated_at).getTime() });
      }
    )
    .subscribe();

  return () => {
    alive = false;
    supabase.removeChannel(channel);
  };
}
