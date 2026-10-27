import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, AttributionControl } from 'maplibre-gl';
import { Globe, Plus, Minus, Maximize2, Crosshair, LocateFixed, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import BasemapControl from './BasemapControl';
import { BASEMAP_STYLES, STYLE_STREETS, focusOnLocation, overlayPaintColor } from '../mapStyles';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };
const EARTH_RADIUS_M = 6378137;

const escapeAttr = (str = '') => String(str).replace(/["'<>]/g, '');
const toLngLat = ([lat, lng]) => [lng, lat];

const badgeMarkup = (avatarUrl, providerName) => {
  const initials = (providerName || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) return `<div class="mc-nav-avatar"><img src="${escapeAttr(avatarUrl)}" alt="" /></div>`;
  if (initials) return `<div class="mc-nav-avatar"><span>${escapeAttr(initials)}</span></div>`;
  return '<div class="mc-nav-core"></div>';
};

const providerMarkup = (heading, avatarUrl, providerName, stale = false) => {
  const deg = heading != null && isFinite(heading) ? Number(heading) : 0;
  return `
    <div class="mc-nav-vehicle mc-provider-marker${stale ? ' mc-nav-stale' : ''}">
      <div class="mc-nav-halo"></div>
      <div class="mc-nav-heading" style="transform: rotate(${deg}deg);">
        <div class="mc-nav-arrow">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#2F6FB5">
            <path d="M12 2L4 21l8-4 8 4L12 2z"/>
          </svg>
        </div>
      </div>
      ${badgeMarkup(avatarUrl, providerName)}
    </div>`;
};

const HOME_MARKUP = `
  <div class="mc-home-pin mc-home-marker">
    <div class="mc-home-pin-head">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>
      </svg>
    </div>
    <div class="mc-home-pin-shadow"></div>
  </div>`;

const routeGeoJson = (route) => (
  route?.length > 1
    ? {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: route.map(toLngLat) },
      }
    : EMPTY_FC
);

const trailGeoJson = (trail) => {
  if (!trail || trail.length < 2) return EMPTY_FC;
  return {
    type: 'FeatureCollection',
    features: trail.slice(1).map((point, index) => {
      const progress = (index + 1) / (trail.length - 1);
      return {
        type: 'Feature',
        properties: {
          opacity: 0.08 + progress * 0.62,
          weight: 2 + progress * 4,
        },
        geometry: {
          type: 'LineString',
          coordinates: [toLngLat(trail[index]), toLngLat(point)],
        },
      };
    }),
  };
};

const accuracyGeoJson = (position, accuracy) => {
  if (!position || !(accuracy > 0)) return EMPTY_FC;
  const radius = Math.min(accuracy, 120);
  const [lat, lng] = position;
  const dLat = (radius / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const steps = 64;
  const ring = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
};

// Overlay sources are wiped whenever the raster basemap is swapped, so they are
// (re)created on every style load and then fed from the latest data refs.
const ensureOverlayLayers = (map, accent, dash) => {
  if (!map.getSource('track-route')) {
    map.addSource('track-route', { type: 'geojson', data: EMPTY_FC });
    map.addLayer({
      id: 'track-route-casing',
      type: 'line',
      source: 'track-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': accent, 'line-width': 10, 'line-opacity': 0.16 },
    });
    map.addLayer({
      id: 'track-route-line',
      type: 'line',
      source: 'track-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': accent, 'line-width': 5, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: 'track-route-dash',
      type: 'line',
      source: 'track-route',
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': dash,
        'line-width': 2,
        'line-opacity': 0.78,
        'line-dasharray': [3, 5],
      },
    });
  }

  if (!map.getSource('track-trail')) {
    map.addSource('track-trail', { type: 'geojson', data: EMPTY_FC });
    map.addLayer({
      id: 'track-trail',
      type: 'line',
      source: 'track-trail',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': accent,
        'line-opacity': ['get', 'opacity'],
        'line-width': ['get', 'weight'],
      },
    });
  }

  if (!map.getSource('track-accuracy')) {
    map.addSource('track-accuracy', { type: 'geojson', data: EMPTY_FC });
    map.addLayer({
      id: 'track-accuracy-fill',
      type: 'fill',
      source: 'track-accuracy',
      paint: { 'fill-color': accent, 'fill-opacity': 0.1 },
    });
    map.addLayer({
      id: 'track-accuracy-line',
      type: 'line',
      source: 'track-accuracy',
      paint: { 'line-color': accent, 'line-width': 1.5, 'line-opacity': 1 },
    });
  }
};

const TrackingMap = forwardRef(function TrackingMap({
  provider,
  providerAvatar,
  providerName,
  destination,
  route,
  follow = false,
  onToggleFollow,
  compact = false,
  stale = false,
  waiting = false,
  controlsAlign = 'center',
  className = '',
}, ref) {
  const { dark } = useTheme();
  const [basemap, setBasemap] = useState('streets');
  const [locatingGps, setLocatingGps] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [trail, setTrail] = useState([]);
  const lastTrailPoint = useRef(null);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const providerMarkerRef = useRef(null);
  const homeMarkerRef = useRef(null);
  const providerElRef = useRef(null);
  const homeElRef = useRef(null);
  const providerPosRef = useRef(null);
  const appliedStyleRef = useRef(null);
  const pendingBasemapRef = useRef(null);
  const fittedBothRef = useRef(false);
  const fittedInitialRef = useRef(false);
  const lastFitTriggerRef = useRef(0);
  const routeDataRef = useRef(EMPTY_FC);
  const trailDataRef = useRef(EMPTY_FC);
  const accuracyDataRef = useRef(EMPTY_FC);

  const p = provider ? [provider.lat, provider.lng] : null;
  const d = destination ? [destination.lat, destination.lng] : null;
  const pLat = p?.[0];
  const pLng = p?.[1];
  const dLat = d?.[0];
  const dLng = d?.[1];
  const center = p || d || [14.4081, 121.0415]; // Muntinlupa
  const isFilteredBasemap = basemap !== 'satellite';
  const treatment = isFilteredBasemap ? (dark ? 'dark' : 'muted') : null;
  const accent = dark ? '#8CBDF0' : '#2F6FB5';
  const paintAccent = treatment ? overlayPaintColor(accent, treatment) : accent;
  const paintDash = treatment ? overlayPaintColor('#ffffff', treatment) : '#ffffff';

  const onToggleFollowRef = useRef(onToggleFollow);
  const paintRef = useRef({ accent: paintAccent, dash: paintDash });
  onToggleFollowRef.current = onToggleFollow;
  paintRef.current = { accent: paintAccent, dash: paintDash };
  // Values used only for first paint; later changes flow through the effects below.
  const initialRef = useRef(null);
  if (!initialRef.current) {
    initialRef.current = {
      center,
      p,
      d,
      providerAvatar,
      providerName,
      heading: provider?.heading,
      stale,
    };
  }

  const fitRoute = useCallback(() => {
    onToggleFollow?.(false);
    setFitTrigger((count) => count + 1);
  }, [onToggleFollow]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const { latitude, longitude } = pos.coords;
        onToggleFollowRef.current?.(false);
        focusOnLocation(mapRef.current, [longitude, latitude]);
        toast.success('Centered on your GPS location');
      },
      (err) => {
        setLocatingGps(false);
        if (err.code === 1) {
          toast.error('Location permission denied. Please allow location access.');
        } else {
          toast.error('Unable to fetch device location.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    fitRoute,
  }), [fitRoute]);

  useEffect(() => {
    if (!mapContainer.current) return undefined;
    const initial = initialRef.current;

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: STYLE_STREETS,
      center: [initial.center[1], initial.center[0]],
      zoom: 15,
      pitch: 0,
      maxPitch: 0,
      pitchWithRotate: false,
      bearing: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    appliedStyleRef.current = STYLE_STREETS;
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');

    const initialProviderPos = initial.p?.[0] != null && initial.p?.[1] != null
      ? [initial.p[1], initial.p[0]]
      : null;
    const providerEl = document.createElement('div');
    providerEl.innerHTML = providerMarkup(
      initial.heading,
      initial.providerAvatar,
      initial.providerName,
      initial.stale
    );
    if (!initialProviderPos) providerEl.style.display = 'none';
    providerElRef.current = providerEl;
    providerMarkerRef.current = new Marker({ element: providerEl, anchor: 'center' })
      .setLngLat(initialProviderPos || [initial.center[1], initial.center[0]])
      .addTo(map);
    providerPosRef.current = initialProviderPos;

    const initialHomePos = initial.d?.[0] != null && initial.d?.[1] != null
      ? [initial.d[1], initial.d[0]]
      : null;
    const homeEl = document.createElement('div');
    homeEl.innerHTML = HOME_MARKUP;
    if (!initialHomePos) homeEl.style.display = 'none';
    homeElRef.current = homeEl;
    homeMarkerRef.current = new Marker({ element: homeEl, anchor: 'bottom', offset: [0, -2] })
      .setLngLat(initialHomePos || [initial.center[1], initial.center[0]])
      .addTo(map);

    const syncOverlays = () => {
      if (!map.getStyle()) return;
      ensureOverlayLayers(map, paintRef.current.accent, paintRef.current.dash);
      map.getSource('track-route')?.setData(routeDataRef.current);
      map.getSource('track-trail')?.setData(trailDataRef.current);
      map.getSource('track-accuracy')?.setData(accuracyDataRef.current);
    };

    map.on('load', () => {
      map.resize();
      syncOverlays();
    });
    map.on('style.load', syncOverlays);

    // A failed base map load reverts to the street map instead of leaving a
    // blank canvas.
    map.on('styledata', () => {
      pendingBasemapRef.current = null;
    });
    map.on('error', () => {
      if (!pendingBasemapRef.current) return;
      pendingBasemapRef.current = null;
      setBasemap('streets');
      toast.error('That base map failed to load; switched back to the street map.');
    });

    const onDragStart = () => onToggleFollowRef.current?.(false);
    map.on('dragstart', onDragStart);

    map.resize();
    const t1 = setTimeout(() => map.resize(), 250);
    const t2 = setTimeout(() => map.resize(), 600);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.resize()) : null;
    ro?.observe(mapContainer.current);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro?.disconnect();
      map.off('dragstart', onDragStart);
      map.remove();
      mapRef.current = null;
      providerMarkerRef.current = null;
      homeMarkerRef.current = null;
      providerElRef.current = null;
      homeElRef.current = null;
    };
  }, []);

  // Swap basemap; theme is handled by the muted/dark canvas filter, not the style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = BASEMAP_STYLES[basemap] || STYLE_STREETS;
    if (appliedStyleRef.current === next) return;
    appliedStyleRef.current = next;
    pendingBasemapRef.current = basemap === 'streets' ? null : basemap;
    map.setStyle(next);
  }, [basemap]);

  useEffect(() => {
    routeDataRef.current = routeGeoJson(route);
    mapRef.current?.getSource('track-route')?.setData(routeDataRef.current);
  }, [route]);

  useEffect(() => {
    trailDataRef.current = trailGeoJson(trail);
    mapRef.current?.getSource('track-trail')?.setData(trailDataRef.current);
  }, [trail]);

  useEffect(() => {
    accuracyDataRef.current = pLat == null || pLng == null
      ? EMPTY_FC
      : accuracyGeoJson([pLat, pLng], provider?.accuracy);
    mapRef.current?.getSource('track-accuracy')?.setData(accuracyDataRef.current);
  }, [pLat, pLng, provider?.accuracy]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const paint = (id, property, color) => {
      if (map.getLayer(id)) map.setPaintProperty(id, property, color);
    };
    paint('track-route-casing', 'line-color', paintAccent);
    paint('track-route-line', 'line-color', paintAccent);
    paint('track-route-dash', 'line-color', paintDash);
    paint('track-trail', 'line-color', paintAccent);
    paint('track-accuracy-fill', 'fill-color', paintAccent);
    paint('track-accuracy-line', 'line-color', paintAccent);
  }, [paintAccent, paintDash]);

  // Marker state is updated imperatively so the halo animation is not restarted.
  useEffect(() => {
    const vehicle = providerElRef.current?.firstElementChild;
    vehicle?.classList.toggle('mc-nav-stale', stale);
  }, [stale]);

  useEffect(() => {
    const headingEl = providerElRef.current?.querySelector('.mc-nav-heading');
    if (!headingEl) return;
    const heading = provider?.heading;
    const deg = heading != null && isFinite(heading) ? Number(heading) : 0;
    headingEl.style.transform = `rotate(${deg}deg)`;
  }, [provider?.heading]);

  useEffect(() => {
    const el = providerElRef.current;
    if (!el) return;
    const nextBadge = badgeMarkup(providerAvatar, providerName);
    const existing = el.querySelector('.mc-nav-avatar, .mc-nav-core');
    if (existing) existing.outerHTML = nextBadge;
    else el.querySelector('.mc-nav-vehicle')?.insertAdjacentHTML('beforeend', nextBadge);
  }, [providerAvatar, providerName]);

  useEffect(() => {
    const marker = providerMarkerRef.current;
    const el = providerElRef.current;
    if (!marker || !el) return undefined;
    if (pLat == null || pLng == null) {
      el.style.display = 'none';
      return undefined;
    }
    el.style.display = '';

    const target = [pLng, pLat];
    const start = providerPosRef.current || target;
    const reducesMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducesMotion) {
      marker.setLngLat(target);
      providerPosRef.current = target;
      return undefined;
    }

    const t0 = performance.now();
    const dur = 1000;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      marker.setLngLat([
        start[0] + (target[0] - start[0]) * e,
        start[1] + (target[1] - start[1]) * e,
      ]);
      if (k < 1) raf = requestAnimationFrame(step);
      else providerPosRef.current = target;
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      const current = marker.getLngLat();
      providerPosRef.current = [current.lng, current.lat];
    };
  }, [pLat, pLng]);

  useEffect(() => {
    const marker = homeMarkerRef.current;
    const el = homeElRef.current;
    if (!marker || !el) return;
    if (dLat == null || dLng == null) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    marker.setLngLat([dLng, dLat]);
  }, [dLat, dLng]);

  // Re-fit only when the visit destination changes, not on every GPS fix.
  useEffect(() => {
    fittedBothRef.current = false;
    fittedInitialRef.current = false;
  }, [dLat, dLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hasProvider = pLat != null && pLng != null;
    const hasDestination = dLat != null && dLng != null;
    if (hasProvider && hasDestination) {
      if (!fittedBothRef.current) {
        map.fitBounds([[pLng, pLat], [dLng, dLat]], { padding: 65, maxZoom: 17 });
        fittedBothRef.current = true;
      } else if (follow) {
        map.easeTo({ center: [pLng, pLat], duration: 900 });
      }
    } else if ((hasProvider || hasDestination) && !fittedInitialRef.current) {
      map.jumpTo({ center: hasProvider ? [pLng, pLat] : [dLng, dLat], zoom: 16 });
      fittedInitialRef.current = true;
    }
  }, [pLat, pLng, dLat, dLng, follow]);

  useEffect(() => {
    if (fitTrigger === lastFitTriggerRef.current) return;
    lastFitTriggerRef.current = fitTrigger;
    const map = mapRef.current;
    if (!map) return;
    const hasProvider = pLat != null && pLng != null;
    const hasDestination = dLat != null && dLng != null;
    if (hasProvider && hasDestination) {
      map.fitBounds([[pLng, pLat], [dLng, dLat]], { padding: 65, maxZoom: 17, duration: 800 });
    } else if (hasProvider || hasDestination) {
      map.easeTo({
        center: hasProvider ? [pLng, pLat] : [dLng, dLat],
        zoom: 16,
        duration: 800,
      });
    }
  }, [fitTrigger, pLat, pLng, dLat, dLng]);

  // Record a fading trail as fixes arrive. This does not alter the GPS pipeline.
  useEffect(() => {
    if (pLat == null || pLng == null) return;
    const point = [pLat, pLng];
    const last = lastTrailPoint.current;
    const moved = !last || Math.abs(last[0] - pLat) + Math.abs(last[1] - pLng) > 0.000018;
    if (!moved) return;
    lastTrailPoint.current = point;
    setTrail((current) => [...current, point].slice(-48));
  }, [pLat, pLng]);

  return (
    <div
      className={`relative w-full h-full mc-map-wrap ${isFilteredBasemap ? (dark ? 'mc-canvas-tiles--dark' : 'mc-canvas-tiles--muted') : ''} ${className}`}
      role="region"
      aria-label="Live provider map"
    >
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ background: dark ? '#0f172a' : '#eaf2f8' }}
      />

      {/* Redesign: waiting state is a skeleton, never a fake/frozen live pin */}
      {waiting && (
        <div className="mc-map-skeleton" aria-hidden="true">
          <div className="mc-map-skeleton__body">
            <div className="mc-map-skeleton__row">
              <span className="mc-status-dot is-caution">
                <Globe className="w-3 h-3" />
              </span>
              <span className="mc-map-skeleton__text">Locating provider…</span>
            </div>
            <div className="mc-skeleton-line" />
            <div className="mc-skeleton-line mc-skeleton-line--short" />
            <div className="mc-skeleton-line mc-skeleton-line--tiny" />
          </div>
        </div>
      )}

      {/* Redesign: one vertical control stack, no scattered map chrome */}
      <div className={`mc-map-controls ${controlsAlign === 'top' ? 'mc-map-controls--top' : 'mc-map-controls--center'}`}>
        <BasemapControl value={basemap} onChange={setBasemap} />
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locatingGps}
          className="mc-map-control disabled:opacity-40 disabled:cursor-not-allowed"
          title="Use my current GPS location"
          aria-label="Use my current GPS location"
        >
          {locatingGps ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="mc-map-control"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="mc-map-control"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={fitRoute}
          disabled={!p && !d}
          className="mc-map-control disabled:opacity-40 disabled:cursor-not-allowed"
          title="Fit entire route in view"
          aria-label="Fit entire route in view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        {onToggleFollow && (
          <button
            type="button"
            onClick={() => onToggleFollow(!follow)}
            className="mc-map-control"
            title={follow ? 'Following provider (click to unlock)' : 'Follow provider'}
            aria-label={follow ? 'Stop following provider' : 'Follow provider'}
            aria-pressed={follow}
          >
            <Crosshair className="w-4 h-4" />
          </button>
        )}
      </div>

      {compact && (
        <span className="sr-only">Compact live route map</span>
      )}
    </div>
  );
});

export default TrackingMap;
