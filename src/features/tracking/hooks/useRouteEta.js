import { useEffect, useRef, useState } from 'react';
import { getRoute } from '../services/routing';
import { distanceToPolyline, haversine, projectOnRoute } from '../services/geo';

const MIN_FETCH_MS = 5000;
const REROUTE_OFF_PATH_M = 100;
const REROUTE_EVERY_MS = 60000;

/**
 * Keeps an OSRM route + ETA up to date as the provider moves.
 * Provider movement never aborts an in-flight request; destination changes
 * invalidate it instead. ETA between refetches is scaled by the provider's
 * projection onto the current route rather than by straight-line distance.
 */
export default function useRouteEta(provider, destination, destVersion = 0) {
  const [route, setRoute] = useState(null);
  const routeRef = useRef(null);
  routeRef.current = route;
  const meta = useRef({ at: 0, destKey: null });
  const busy = useRef(false);
  const token = useRef(0);

  const hasDestination = destination?.lat != null && destination?.lng != null;
  const destKey = hasDestination
    ? `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}:${destVersion}`
    : null;

  useEffect(() => {
    token.current += 1;
    busy.current = false;
    meta.current = { at: 0, destKey };
    routeRef.current = null;
    setRoute(null);
  }, [destKey]);

  useEffect(() => {
    if (provider?.lat == null || provider?.lng == null || !destKey) return;
    const now = Date.now();
    if (busy.current || now - meta.current.at < MIN_FETCH_MS) return;

    const off = routeRef.current
      ? distanceToPolyline(provider, routeRef.current.coords)
      : Infinity;
    const stale = now - meta.current.at > REROUTE_EVERY_MS;
    if (routeRef.current && off < REROUTE_OFF_PATH_M && !stale) return;

    const myToken = ++token.current;
    busy.current = true;
    getRoute(provider, destination)
      .then((next) => {
        if (myToken !== token.current) return;
        meta.current = { at: Date.now(), destKey };
        if (next) {
          routeRef.current = next;
          setRoute(next);
        }
      })
      .finally(() => {
        if (myToken === token.current) busy.current = false;
      });
  }, [provider?.lat, provider?.lng, destKey]);

  let distance = null;
  let duration = null;

  if (provider?.lat != null && hasDestination) {
    const straight = haversine(provider, destination);
    const projection = route ? projectOnRoute(provider, route.coords) : null;

    if (route && projection?.total > 0) {
      const scale = route.distance / projection.total;
      distance = projection.remaining * scale;
      duration = route.duration * (projection.remaining / projection.total);

      if (projection.offRoute > REROUTE_OFF_PATH_M * 2) {
        distance = straight * 1.4;
        duration = (distance / 1000 / 20) * 3600;
      }
    } else {
      distance = straight * 1.4;
      duration = (distance / 1000 / 20) * 3600;
    }
  }

  return { route: route?.coords || null, distance, duration };
}
