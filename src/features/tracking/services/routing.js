// Free routing via OSRM public server.
const OSRM = import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';

// Metro Manila traffic factor applied to OSRM free-flow durations.
export const TRAFFIC_FACTOR = Number(import.meta.env.VITE_TRAFFIC_FACTOR || 1.3);

/**
 * Returns { coords: [[lat,lng],...], distance (m), duration (s, traffic-adjusted) } or null.
 */
export async function getRoute(from, to, { signal } = {}) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
  const url = `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 6000);
  const onParentAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onParentAbort);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distance: route.distance,
      duration: route.duration * TRAFFIC_FACTOR,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onParentAbort);
  }
}
