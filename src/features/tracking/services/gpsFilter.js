import { haversine, bearing } from './geo';

/**
 * Filters & smooths raw GPS fixes for accuracy.
 * - The first fix may be coarse (up to 2 km) but is marked degraded
 * - Once moving, only good fixes (<= 150 m) are accepted; a good fix
 *   immediately resets a degraded estimate instead of staying anchored
 * - Drops physically impossible jumps between good fixes
 * - Applies a simple 1D Kalman filter per axis (accuracy-weighted)
 */
export function createGpsFilter({
  maxAccuracy = 150,        // maximum accuracy for a trustworthy fix
  maxFirstAccuracy = 2000,  // allow a coarse first fix so the map is not blank
  maxSpeedKmh = 150,        // reject teleports
  processNoise = 3,         // m/s expected movement noise
} = {}) {
  let last = null;     // last accepted raw fix
  let est = null;      // { lat, lng, variance }
  let lastHeading = null;

  return function filter(fix) {
    const { lat, lng, accuracy = 30, timestamp = Date.now() } = fix;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const acc = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 30;
    const good = acc <= maxAccuracy;

    if (!last) {
      if (acc > maxFirstAccuracy) return null;
    } else {
      if (!good) return null;
      // A coarse first fix must not become the anchor for teleport rejection.
      if (last.good) {
        const dt = Math.max(0.01, (timestamp - last.timestamp) / 1000);
        const distance = haversine(last, { lat, lng });
        const kmh = (distance / dt) * 3.6;
        if (kmh > maxSpeedKmh && distance > acc + last.accuracy) return null;
      }
    }

    const effectiveTime = last ? Math.max(timestamp, last.timestamp + 10) : timestamp;

    if (!est || (good && !last.good)) {
      // First fix, or recovering from a coarse fix: start clean at the new point.
      est = { lat, lng, variance: acc * acc };
    } else {
      const dt = Math.max(0.01, (effectiveTime - last.timestamp) / 1000);
      est.variance += dt * processNoise * processNoise;
      const k = est.variance / (est.variance + acc * acc);
      est.lat += k * (lat - est.lat);
      est.lng += k * (lng - est.lng);
      est.variance *= 1 - k;
    }

    let heading = fix.heading != null && Number.isFinite(fix.heading) ? fix.heading : null;
    if (heading == null && last && haversine(last, est) > 3) {
      heading = bearing(last, est);
    }
    if (heading != null) {
      lastHeading = heading;
    }

    last = { lat, lng, accuracy: acc, timestamp: effectiveTime, good };
    return {
      ...fix,
      lat: est.lat,
      lng: est.lng,
      accuracy: Math.sqrt(est.variance),
      rawAccuracy: acc,
      degraded: !good,
      heading: heading ?? lastHeading,
      timestamp: effectiveTime,
    };
  };
}
