// OSRM Road Routing Service with Exponential Backoff & Circuit Breaker

const DEFAULT_OSRM = 'https://router.project-osrm.org';
const configuredUrl = import.meta.env.VITE_OSRM_URL;

if (import.meta.env.PROD && !configuredUrl) {
  console.warn(
    '[routing] CRITICAL WARNING: VITE_OSRM_URL is not configured in production. ' +
    'Falling back to the public demo OSRM server (https://router.project-osrm.org), ' +
    'which has strict rate limits and is not intended for production healthcare operations. ' +
    'Please set VITE_OSRM_URL to a dedicated or self-hosted OSRM instance.'
  );
}

export const OSRM_URL = configuredUrl || DEFAULT_OSRM;

// Metro Manila traffic factor applied to OSRM free-flow durations
export const TRAFFIC_FACTOR = Number(import.meta.env.VITE_TRAFFIC_FACTOR || 1.3);

// Circuit breaker state
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const FAILURE_THRESHOLD = 3;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

export function getCircuitBreakerStatus() {
  const isOpen = Date.now() < circuitOpenUntil;
  return {
    isOpen,
    consecutiveFailures,
    openUntil: circuitOpenUntil,
  };
}

export function resetCircuitBreaker() {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

/**
 * Fetches driving route from OSRM.
 * Returns { coords: [[lat,lng],...], distance: number, duration: number } or null.
 * Never throws — always returns null on failure, timeout, 429, or when the circuit breaker is open.
 */
export async function getRoute(from, to, { signal } = {}) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;

  // Circuit breaker: skip network call if currently backing off
  if (Date.now() < circuitOpenUntil) {
    return null;
  }

  const url = `${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 6000);
  const onParentAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onParentAbort);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      recordFailure();
      return null;
    }
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route || !Array.isArray(route.geometry?.coordinates)) {
      recordFailure();
      return null;
    }

    // Success: reset circuit breaker
    consecutiveFailures = 0;
    circuitOpenUntil = 0;

    return {
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distance: route.distance,
      duration: route.duration * TRAFFIC_FACTOR,
    };
  } catch {
    recordFailure();
    return null;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onParentAbort);
  }
}

function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    const backoff = Math.min(
      MAX_BACKOFF_MS,
      BASE_BACKOFF_MS * Math.pow(2, consecutiveFailures - FAILURE_THRESHOLD)
    );
    circuitOpenUntil = Date.now() + backoff;
  }
}
