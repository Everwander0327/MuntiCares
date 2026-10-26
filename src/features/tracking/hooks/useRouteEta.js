import { useEffect, useRef, useState } from 'react';
import { getRoute } from '../services/routing';
import { distanceToPolyline, haversine, projectOnRoute } from '../services/geo';

const MIN_FETCH_MS = 5000;
const OFF_ROUTE_SAMPLES_THRESHOLD = 3;

// Global shared store per destination/request key so multiple components share identical route & ETA
const sharedEtaStore = new Map();

function getStoreKey(requestId, destination, destVersion) {
  if (requestId) return `req:${requestId}`;
  if (destination?.lat != null && destination?.lng != null) {
    return `dest:${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}:${destVersion || 0}`;
  }
  return null;
}

function areEtaValuesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.source === b.source &&
    a.distance === b.distance &&
    a.duration === b.duration &&
    a.route === b.route
  );
}

/**
 * Precomputes cumulative segment lengths once for a route geometry.
 */
function prepareRouteGeometry(coords, rawDistance, rawDuration) {
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const segments = [];
  let totalLength = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const len = haversine(
      { lat: coords[i][0], lng: coords[i][1] },
      { lat: coords[i + 1][0], lng: coords[i + 1][1] }
    );
    segments.push({
      index: i,
      start: coords[i],
      end: coords[i + 1],
      length: len,
      before: totalLength,
    });
    totalLength += len;
  }

  return {
    coords,
    distance: rawDistance || totalLength,
    duration: rawDuration,
    totalLength,
    segments,
  };
}

/**
 * Projects provider onto precomputed route segments forward from the last known segment index.
 */
function projectOnPreparedRoute(provider, preparedRoute, lastIndex = 0) {
  if (!provider || !preparedRoute || !preparedRoute.segments.length) return null;

  const { coords, segments, totalLength } = preparedRoute;
  if (!(totalLength > 0)) return null;

  const toRad = (d) => (d * Math.PI) / 180;
  const kx = Math.cos(toRad(provider.lat)) * 111320;
  const ky = 110540;

  let best = null;
  // Search window: check a few segments before lastIndex in case of minor GPS jitter, then forward
  const startIdx = Math.max(0, lastIndex - 2);

  for (let i = startIdx; i < segments.length; i++) {
    const seg = segments[i];
    const ax = (seg.start[1] - provider.lng) * kx;
    const ay = (seg.start[0] - provider.lat) * ky;
    const bx = (seg.end[1] - provider.lng) * kx;
    const by = (seg.end[0] - provider.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const offRoute = Math.hypot(cx, cy);
    const along = seg.before + t * seg.length;

    if (!best || offRoute < best.offRoute) {
      best = {
        index: i,
        lat: seg.start[0] + t * (seg.end[0] - seg.start[0]),
        lng: seg.start[1] + t * (seg.end[1] - seg.start[1]),
        along,
        remaining: Math.max(0, totalLength - along),
        total: totalLength,
        offRoute,
      };
    }
  }

  // Fallback to full route projection if search forward did not yield a close segment
  if (!best || best.offRoute > 250) {
    const fullProj = projectOnRoute(provider, coords);
    return fullProj ? { ...fullProj, index: 0 } : best;
  }

  return best;
}

/**
 * Keeps an OSRM route + ETA up to date as the provider moves.
 * - Shared store per request/destination key
 * - Returns explicit source: 'route' | 'estimate'
 * - Reroutes only when destination changes or 3 consecutive off-route samples occur
 * - Precomputed segment lengths and monotonic progress forward
 */
export default function useRouteEta(provider, destination, destVersion = 0, requestId = null) {
  const storeKey = getStoreKey(requestId, destination, destVersion);

  const [state, setState] = useState(() => {
    if (storeKey && sharedEtaStore.has(storeKey)) {
      return sharedEtaStore.get(storeKey).value;
    }
    return { route: null, distance: null, duration: null, source: 'estimate' };
  });

  const internalRef = useRef({
    preparedRoute: null,
    lastIndex: 0,
    lastRemaining: Infinity,
    consecutiveOffRoute: 0,
    lastFetchAt: 0,
    busy: false,
    token: 0,
  });

  const hasDestination = destination?.lat != null && destination?.lng != null;
  const destLat = destination?.lat;
  const destLng = destination?.lng;

  // Subscribe to shared store changes for this key
  useEffect(() => {
    if (!storeKey) return;
    let store = sharedEtaStore.get(storeKey);
    if (!store) {
      store = {
        value: { route: null, distance: null, duration: null, source: 'estimate' },
        listeners: new Set(),
      };
      sharedEtaStore.set(storeKey, store);
    }

    const listener = (val) => {
      setState((prev) => (areEtaValuesEqual(prev, val) ? prev : val));
    };
    store.listeners.add(listener);

    return () => {
      store.listeners.delete(listener);
      if (store.listeners.size === 0) {
        sharedEtaStore.delete(storeKey);
      }
    };
  }, [storeKey]);

  // Destination change: reset route and off-route trackers
  useEffect(() => {
    const internal = internalRef.current;
    internal.token += 1;
    internal.busy = false;
    internal.lastFetchAt = 0;
    internal.preparedRoute = null;
    internal.lastIndex = 0;
    internal.lastRemaining = Infinity;
    internal.consecutiveOffRoute = 0;
  }, [destLat, destLng, destVersion]);

  const provLat = provider?.lat;
  const provLng = provider?.lng;
  const provAcc = provider?.accuracy;

  // Route fetching and off-route evaluation
  useEffect(() => {
    if (provLat == null || provLng == null || !hasDestination || !storeKey) return;

    const provPos = { lat: provLat, lng: provLng };
    const internal = internalRef.current;
    const now = Date.now();

    if (internal.busy || now - internal.lastFetchAt < MIN_FETCH_MS) return;

    let shouldFetch = false;

    if (!internal.preparedRoute) {
      shouldFetch = true;
    } else {
      const offRouteDist = distanceToPolyline(provPos, internal.preparedRoute.coords);
      const accuracyAwareThreshold = Math.max(100, (provAcc || 30) * 1.5);

      if (offRouteDist > accuracyAwareThreshold) {
        internal.consecutiveOffRoute += 1;
        if (internal.consecutiveOffRoute >= OFF_ROUTE_SAMPLES_THRESHOLD) {
          shouldFetch = true;
        }
      } else {
        internal.consecutiveOffRoute = 0;
      }
    }

    if (!shouldFetch) return;

    const myToken = ++internal.token;
    internal.busy = true;

    getRoute(provPos, { lat: destLat, lng: destLng })
      .then((next) => {
        if (myToken !== internal.token) return;
        internal.lastFetchAt = Date.now();
        internal.consecutiveOffRoute = 0;

        if (next && next.coords) {
          internal.preparedRoute = prepareRouteGeometry(next.coords, next.distance, next.duration);
          internal.lastIndex = 0;
          internal.lastRemaining = internal.preparedRoute.totalLength;
        }
      })
      .finally(() => {
        if (myToken === internal.token) internal.busy = false;
      });
  }, [provLat, provLng, provAcc, hasDestination, storeKey, destLat, destLng]);

  // Calculate projected distance, duration, and monotonic progress
  useEffect(() => {
    const notifyOrSet = (nextVal) => {
      const store = storeKey ? sharedEtaStore.get(storeKey) : null;
      if (store) {
        if (!areEtaValuesEqual(store.value, nextVal)) {
          store.value = nextVal;
          store.listeners.forEach((l) => l(nextVal));
        }
      } else {
        setState((prev) => (areEtaValuesEqual(prev, nextVal) ? prev : nextVal));
      }
    };

    if (provLat == null || !hasDestination || !storeKey) {
      notifyOrSet({ route: null, distance: null, duration: null, source: 'estimate' });
      return;
    }

    const provPos = { lat: provLat, lng: provLng };
    const internal = internalRef.current;
    const straight = haversine(provPos, { lat: destLat, lng: destLng });
    let distance = null;
    let duration = null;
    let source = 'estimate';

    if (internal.preparedRoute) {
      const projection = projectOnPreparedRoute(provPos, internal.preparedRoute, internal.lastIndex);

      if (projection && projection.total > 0 && projection.offRoute <= Math.max(150, (provAcc || 30) * 2)) {
        source = 'route';
        internal.lastIndex = projection.index;

        const scale = internal.preparedRoute.distance / projection.total;
        const currentRemaining = projection.remaining * scale;

        // Monotonic remaining distance along the route
        if (currentRemaining < internal.lastRemaining) {
          internal.lastRemaining = currentRemaining;
        }
        distance = internal.lastRemaining;
        duration = internal.preparedRoute.duration * (internal.lastRemaining / internal.preparedRoute.distance);
      } else {
        // Fallback estimate
        source = 'estimate';
        distance = straight * 1.4;
        duration = (distance / 1000 / 20) * 3600;
      }
    } else {
      source = 'estimate';
      distance = straight * 1.4;
      duration = (distance / 1000 / 20) * 3600;
    }

    notifyOrSet({
      route: internal.preparedRoute?.coords || null,
      distance,
      duration,
      source,
    });
  }, [provLat, provLng, provAcc, hasDestination, storeKey, destLat, destLng]);

  return state;
}
