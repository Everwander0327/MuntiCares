// Pure geo helpers (unit-testable, no side effects)

const R = 6371000; // earth radius (m)
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Distance in meters between two {lat,lng} points. */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial bearing in degrees (0 = north). */
export function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Shortest distance (m) from point p to a polyline [[lat,lng],...]. Approximate, fine for city scale. */
export function distanceToPolyline(p, line) {
  if (!line || line.length < 2) return Infinity;
  let min = Infinity;
  const kx = Math.cos(toRad(p.lat)) * 111320;
  const ky = 110540;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][1] - p.lng) * kx, ay = (line[i][0] - p.lat) * ky;
    const bx = (line[i + 1][1] - p.lng) * kx, by = (line[i + 1][0] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const cx = ax + t * dx, cy = ay + t * dy;
    min = Math.min(min, Math.hypot(cx, cy));
  }
  return min;
}

export function formatDistance(m) {
  if (m == null || !isFinite(m)) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}
