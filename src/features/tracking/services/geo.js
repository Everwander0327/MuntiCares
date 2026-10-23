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

/**
 * Projects point p onto a polyline [[lat,lng],...].
 * Returns { lat, lng, along, remaining, total, offRoute } in meters, or null.
 * "along" is the distance from the start of the line to the projection.
 */
export function projectOnRoute(p, line) {
  if (!p || !Array.isArray(line) || line.length < 2) return null;

  const lengths = [];
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const len = haversine(
      { lat: line[i][0], lng: line[i][1] },
      { lat: line[i + 1][0], lng: line[i + 1][1] }
    );
    lengths.push(len);
    total += len;
  }
  if (!(total > 0)) return null;

  const kx = Math.cos(toRad(p.lat)) * 111320;
  const ky = 110540;
  let best = null;
  let before = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][1] - p.lng) * kx;
    const ay = (line[i][0] - p.lat) * ky;
    const bx = (line[i + 1][1] - p.lng) * kx;
    const by = (line[i + 1][0] - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const offRoute = Math.hypot(cx, cy);
    const along = before + t * lengths[i];

    if (!best || offRoute < best.offRoute) {
      best = {
        lat: line[i][0] + t * (line[i + 1][0] - line[i][0]),
        lng: line[i][1] + t * (line[i + 1][1] - line[i][1]),
        along,
        remaining: Math.max(0, total - along),
        total,
        offRoute,
      };
    }
    before += lengths[i];
  }

  return best;
}

/** Shortest distance (m) from point p to a polyline [[lat,lng],...]. Approximate, fine for city scale. */
export function distanceToPolyline(p, line) {
  const projection = projectOnRoute(p, line);
  return projection ? projection.offRoute : Infinity;
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
