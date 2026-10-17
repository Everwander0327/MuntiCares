import { useEffect, useRef, useState } from 'react';
import { getRoute } from '../services/routing';
import { distanceToPolyline, haversine } from '../services/geo';

const REROUTE_OFF_PATH_M = 100;
const REROUTE_EVERY_MS = 60000;

/**
 * Keeps an OSRM route + ETA up to date as the provider moves.
 * Between refetches, ETA is scaled by remaining straight-line progress.
 */
export default function useRouteEta(provider, destination) {
  const [route, setRoute] = useState(null); // { coords, distance, duration }
  const routeRef = useRef(null);
  routeRef.current = route;
  const meta = useRef({ at: 0, from: null, straight: 0 });
  const busy = useRef(false);

  useEffect(() => {
    setRoute(null);
    meta.current = { at: 0, from: null, straight: 0 };
  }, [destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!provider || !destination || busy.current) return;
    const now = Date.now();
    if (now - meta.current.at < 5000) return;

    const off = routeRef.current ? distanceToPolyline(provider, routeRef.current.coords) : Infinity;
    const stale = now - meta.current.at > REROUTE_EVERY_MS;
    if (routeRef.current && off < REROUTE_OFF_PATH_M && !stale) return;

    busy.current = true;
    const ctrl = new AbortController();
    getRoute(provider, destination, { signal: ctrl.signal })
      .then((r) => {
        if (r) {
          setRoute(r);
          meta.current = { at: Date.now(), from: provider, straight: haversine(provider, destination) };
        }
      })
      .finally(() => {
        meta.current.at = Date.now();
        busy.current = false;
      });
    return () => ctrl.abort();
  }, [provider?.lat, provider?.lng, destination?.lat, destination?.lng]);

  let distance = null, duration = null;
  if (provider && destination) {
    const straightNow = haversine(provider, destination);
    if (route && meta.current.straight > 0) {
      const ratio = Math.min(1.2, straightNow / meta.current.straight);
      distance = route.distance * ratio;
      duration = route.duration * ratio;
    } else {
      distance = straightNow * 1.4;               // road-factor estimate
      duration = (distance / 1000 / 20) * 3600;   // ~20 km/h city average
    }
  }

  return { route: route?.coords || null, distance, duration };
}
