import { haversine, bearing } from './geo';

/**
 * Filters & smooths raw GPS fixes for accuracy.
 * - drops fixes with poor accuracy
 * - drops physically impossible jumps
 * - applies a simple 1D Kalman filter per axis (accuracy-weighted)
 */
export function createGpsFilter({
  maxAccuracy = 150,       // meters baseline for good GPS/Wi-Fi fixes
  maxSpeedKmh = 150,       // reject teleports
  processNoise = 3,        // m/s expected movement noise
} = {}) {
  let last = null;     // last accepted raw fix
  let est = null;      // { lat, lng, variance }
  let lastHeading = null;

  return function filter(fix) {
    const { lat, lng, accuracy = 30, timestamp = Date.now() } = fix;
    if (!isFinite(lat) || !isFinite(lng)) return null;

    const acc = isFinite(accuracy) && accuracy > 0 ? accuracy : 30;

    // Always allow the very first valid fix through so the tracker never gets stuck on
    // "Acquiring GPS…" on desktop/Wi-Fi/indoor connections. For subsequent fixes, allow
    // up to maxAccuracy or up to 1.5x the previous accepted fix's accuracy.
    if (last) {
      const limit = Math.max(maxAccuracy, last.accuracy * 1.5);
      if (acc > limit) return null;
    }

    const effectiveTime = last ? Math.max(timestamp, last.timestamp + 10) : timestamp;

    if (last) {
      const dt = Math.max(0.01, (effectiveTime - last.timestamp) / 1000);
      const d = haversine(last, { lat, lng });
      const kmh = (d / dt) * 3.6;
      // Ignore jumps only when they exceed what accuracy could explain
      if (kmh > maxSpeedKmh && d > acc + last.accuracy) return null;
    }

    if (!est) {
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

    last = { lat, lng, accuracy: acc, timestamp: effectiveTime };
    return {
      ...fix,
      lat: est.lat,
      lng: est.lng,
      accuracy: Math.sqrt(est.variance),
      heading: heading ?? lastHeading,
      timestamp: effectiveTime,
    };
  };
}

