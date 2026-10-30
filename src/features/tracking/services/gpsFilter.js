import { haversine, bearing } from './geo';

/**
 * Filters & smooths raw GPS fixes for accuracy.
 * - Coarse fixes are still delivered and flagged `degraded`, so network/IP
 *   locations keep the pin moving instead of freezing after the first fix
 * - Fixes coarser than `maxUsableAccuracy` are unusable and dropped
 * - Drops physically impossible jumps between trustworthy fixes
 * - Applies a simple 1D Kalman filter per axis, only between trustworthy fixes
 * - Reported accuracy never drops below the raw accuracy, so arrival gating
 *   stays conservative while the position is approximate
 */
export function createGpsFilter({
  maxAccuracy = 150,        // accuracy considered trustworthy
  maxUsableAccuracy = 5000, // anything coarser cannot place a pin at all
  maxSpeedKmh = 150,        // reject teleports between trustworthy fixes
  processNoise = 3,         // m/s expected movement noise
} = {}) {
  let last = null;     // last accepted raw fix
  let est = null;      // { lat, lng, variance }
  let lastHeading = null;

  return function filter(fix) {
    const { lat, lng, accuracy = 30, timestamp = Date.now() } = fix;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const acc = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 30;
    if (acc > maxUsableAccuracy) return null;
    const good = acc <= maxAccuracy;

    if (last?.good && good) {
      const dt = Math.max(0.01, (timestamp - last.timestamp) / 1000);
      const distance = haversine(last, { lat, lng });
      const kmh = (distance / dt) * 3.6;
      if (kmh > maxSpeedKmh && distance > acc + last.accuracy) return null;
    }

    const effectiveTime = last ? Math.max(timestamp, last.timestamp + 10) : timestamp;

    if (!est || !last || !good || !last.good) {
      // First fix, or entering/leaving approximate mode: restart from the raw
      // point. Smoothing coarse fixes would let a stale estimate lag behind
      // every network update, which is the freeze this filter must avoid.
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
    if (heading == null && good && last?.good && haversine(last, est) > 3) {
      heading = bearing(last, est);
    }
    if (heading != null) {
      lastHeading = heading;
    }

    // The Kalman variance shrinks over repeated fixes; reporting it alone would
    // eventually look accurate enough to pass the 150 m arrival gate even
    // though the hardware is still coarse.
    const reportedAccuracy = Math.max(acc, Math.sqrt(est.variance));

    last = { lat, lng, accuracy: acc, timestamp: effectiveTime, good };
    return {
      ...fix,
      lat: est.lat,
      lng: est.lng,
      accuracy: reportedAccuracy,
      rawAccuracy: acc,
      degraded: !good,
      heading: heading ?? lastHeading,
      timestamp: effectiveTime,
    };
  };
}
