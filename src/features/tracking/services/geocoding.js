import { supabase } from '@/lib/supabase';

// Free OSM Nominatim. Policy: max 1 req/sec, cache results, identify the app.
const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Muntinlupa-ish bounding box to bias results (lon1,lat1,lon2,lat2)
const VIEWBOX = '120.98,14.47,121.08,14.35';

const cache = new Map();
let lastCall = 0;

const REQUEST_TIMEOUT_MS = 8000;

// AbortSignal.timeout is unavailable on older Safari; a hung request would
// otherwise leave the map pinned on "Locating care address…" forever.
const timeoutSignal = () => (AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined);

async function throttle() {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/** Returns { lat, lng, displayName } or null. */
export async function geocodeAddress(address) {
  const q = (address || '').trim();
  if (!q) return null;
  if (cache.has(q)) return cache.get(q);

  const inMuntinlupa = (lat, lng) => lat >= 14.33 && lat <= 14.48 && lng >= 120.97 && lng <= 121.09;

  const tryQuery = async (query, bounded) => {
    try {
      await throttle();
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'ph',
        viewbox: VIEWBOX,
        bounded: bounded ? '1' : '0',
        email: 'support@municares.app',
      });
      const res = await fetch(`${NOMINATIM}/search?${params}`, {
        headers: { 'Accept-Language': 'en' },
        signal: timeoutSignal(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return null;
      const hit = data[0];
      if (!hit || !inMuntinlupa(+hit.lat, +hit.lon)) return null;
      return { lat: +hit.lat, lng: +hit.lon, displayName: hit.display_name };
    } catch {
      return null;
    }
  };

  // Try strict Muntinlupa area first, then add a city hint, then fall back —
  // every accepted hit must still land inside the Muntinlupa bounds above.
  const result =
    (await tryQuery(q, true)) ||
    (/muntinlupa/i.test(q) ? null : await tryQuery(`${q}, Muntinlupa City`, false)) ||
    (await tryQuery(q, false));

  if (result) cache.set(q, result);
  return result;
}

export async function reverseGeocode(lat, lng) {
  try {
    await throttle();
    const params = new URLSearchParams({ lat, lon: lng, format: 'jsonv2', email: 'support@municares.app' });
    const res = await fetch(`${NOMINATIM}/reverse?${params}`, { signal: timeoutSignal() });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

/** Save coordinates on the patient row. */
export async function savePatientCoords(userId, { lat, lng }) {
  const { error } = await supabase
    .from('patients')
    .update({ latitude: lat, longitude: lng, geocoded_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Resolve coordinates for a patient. A saved pin is returned as-is; when only
 * a text address exists, this returns a geocoded street/barangay estimate
 * WITHOUT persisting it, so an approximate centroid never becomes the
 * patient's confirmed home pin.
 */
export async function ensurePatientCoords(patientUserId) {
  const { data, error } = await supabase
    .from('patients')
    .select('address, latitude, longitude')
    .eq('user_id', patientUserId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.latitude != null && data.longitude != null) {
    return { lat: data.latitude, lng: data.longitude };
  }
  const hit = await geocodeAddress(data.address);
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lng };
}
