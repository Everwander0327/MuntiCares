import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe, Plus, Minus, Maximize2, Crosshair } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// 100% Free tile layers (zero API key required)
const TILES = {
  streets: {
    name: 'Modern Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
};

const escapeAttr = (str = '') => String(str).replace(/["'<>]/g, '');

const providerIcon = (heading, avatarUrl, providerName, stale = false) => {
  const initials = (providerName || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const innerBadge = avatarUrl
    ? `<div class="mc-nav-avatar"><img src="${escapeAttr(avatarUrl)}" alt="" /></div>`
    : initials
      ? `<div class="mc-nav-avatar"><span>${escapeAttr(initials)}</span></div>`
      : `<div class="mc-nav-core"></div>`;

  return L.divIcon({
    className: '',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    html: `
      <div class="mc-nav-vehicle mc-provider-marker${stale ? ' mc-nav-stale' : ''}">
        <div class="mc-nav-halo"></div>
        <div class="mc-nav-heading" style="transform: rotate(${heading != null && isFinite(heading) ? heading : 0}deg);">
          <div class="mc-nav-arrow">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#2F6FB5">
              <path d="M12 2L4 21l8-4 8 4L12 2z"/>
            </svg>
          </div>
        </div>
        ${innerBadge}
      </div>`,
  });
};

const homeIcon = L.divIcon({
  className: '',
  iconSize: [40, 50],
  iconAnchor: [20, 48],
  html: `
    <div class="mc-home-pin mc-home-marker">
      <div class="mc-home-pin-head">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>
        </svg>
      </div>
      <div class="mc-home-pin-shadow"></div>
    </div>`,
});

/** Smoothly animates a marker between GPS fixes instead of jumping. */
function AnimatedMarker({ position, heading, avatarUrl, providerName, stale }) {
  const ref = useRef(null);
  const from = useRef(position);
  const lat = position?.[0];
  const lng = position?.[1];
  const icon = useMemo(
    () => providerIcon(heading, avatarUrl, providerName, stale),
    [heading, avatarUrl, providerName, stale]
  );

  useEffect(() => {
    const marker = ref.current;
    if (!marker || lat == null || lng == null) return undefined;
    const target = [lat, lng];
    const reducesMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducesMotion) {
      marker.setLatLng(target);
      from.current = target;
      return undefined;
    }
    const start = from.current || target;
    const t0 = performance.now();
    const dur = 1000;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const nextLat = start[0] + (target[0] - start[0]) * e;
      const nextLng = start[1] + (target[1] - start[1]) * e;
      marker.setLatLng([nextLat, nextLng]);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lat, lng]);

  if (!position) return null;
  return <Marker ref={ref} position={from.current || position} icon={icon} zIndexOffset={1000} />;
}

function MapAutoResize({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    if (mapRef) mapRef.current = map;
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 250);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') {
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [map, mapRef]);
  return null;
}

function FitBounds({ provider, destination, follow, fitTrigger }) {
  const map = useMap();
  const fittedBoth = useRef(false);
  const fittedInitial = useRef(false);
  const pLat = provider?.[0];
  const pLng = provider?.[1];
  const dLat = destination?.[0];
  const dLng = destination?.[1];

  // Re-fit only when the visit destination changes, not on every GPS fix.
  useEffect(() => {
    fittedBoth.current = false;
    fittedInitial.current = false;
  }, [dLat, dLng]);

  useEffect(() => {
    const p = pLat != null && pLng != null ? [pLat, pLng] : null;
    const d = dLat != null && dLng != null ? [dLat, dLng] : null;
    if (p && d) {
      if (!fittedBoth.current) {
        map.fitBounds([p, d], { padding: [65, 65], maxZoom: 17 });
        fittedBoth.current = true;
      } else if (follow) {
        map.panTo(p, { animate: true });
      }
    } else if ((p || d) && !fittedInitial.current) {
      map.setView(p || d, 16);
      fittedInitial.current = true;
    }
  }, [pLat, pLng, dLat, dLng, follow, map]);

  useEffect(() => {
    if (!fitTrigger) return;
    const p = pLat != null && pLng != null ? [pLat, pLng] : null;
    const d = dLat != null && dLng != null ? [dLat, dLng] : null;
    if (p && d) {
      map.fitBounds([p, d], { padding: [65, 65], maxZoom: 17, animate: true });
    } else if (p || d) {
      map.setView(p || d, 16, { animate: true });
    }
  }, [fitTrigger, pLat, pLng, dLat, dLng, map]);

  return null;
}

/** Manual map movement releases follow mode instead of fighting the user. */
function PanGuard({ onPan }) {
  useMapEvents({
    dragstart() { onPan?.(); },
  });
  return null;
}

/** Presentation-only breadcrumb of recent fixes; older points fade out. */
function TrailLayer({ trail, accent }) {
  const segments = useMemo(() => {
    if (!trail || trail.length < 2) return [];
    return trail.slice(1).map((point, index) => {
      const progress = (index + 1) / (trail.length - 1);
      return {
        key: `trail-${index}`,
        positions: [trail[index], point],
        opacity: 0.08 + progress * 0.62,
        weight: 2 + progress * 4,
      };
    });
  }, [trail]);

  return segments.map((segment) => (
    <Polyline
      key={segment.key}
      positions={segment.positions}
      pathOptions={{
        color: accent,
        weight: segment.weight,
        opacity: segment.opacity,
        lineCap: 'round',
      }}
    />
  ));
}

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
  const [layerType, setLayerType] = useState('auto'); // 'auto' | 'satellite' | 'streets'
  const [fitTrigger, setFitTrigger] = useState(0);
  const [trail, setTrail] = useState([]);
  const lastTrailPoint = useRef(null);
  const mapRef = useRef(null);

  const p = provider ? [provider.lat, provider.lng] : null;
  const d = destination ? [destination.lat, destination.lng] : null;
  const pLat = p?.[0];
  const pLng = p?.[1];
  const center = p || d || [14.4081, 121.0415]; // Muntinlupa
  const accent = dark ? '#8CBDF0' : '#2F6FB5';
  const activeTileKey = layerType === 'satellite' ? 'satellite' : 'streets';
  const isDarkStreet = activeTileKey === 'streets' && dark;
  const tile = TILES[activeTileKey];

  const fitRoute = useCallback(() => {
    onToggleFollow?.(false);
    setFitTrigger((count) => count + 1);
  }, [onToggleFollow]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    fitRoute,
  }), [fitRoute]);

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
      className={`relative w-full h-full mc-map-wrap ${className}`}
      role="region"
      aria-label="Live provider map"
    >
      <MapContainer
        center={center}
        zoom={15}
        zoomControl={false}
        className="w-full h-full"
        style={{ background: dark ? '#0f172a' : '#eaf2f8' }}
      >
        <TileLayer
          key={`${activeTileKey}-${isDarkStreet ? 'dark' : 'light'}`}
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
          className={`mc-map-tiles${isDarkStreet ? ' mc-dark-tiles' : ''}${activeTileKey === 'streets' ? ' mc-muted-tiles' : ''}`}
        />

        {/* Planned route, kept legible above the muted basemap */}
        {route?.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: accent, weight: 10, opacity: 0.16, lineCap: 'round' }} />
            <Polyline positions={route} pathOptions={{ color: accent, weight: 5, opacity: 0.9, lineCap: 'round' }} />
            <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.78, dashArray: '6, 10' }} />
          </>
        )}

        {/* Recent movement trail: older fades, newest bold */}
        <TrailLayer trail={trail} accent={accent} />

        {/* Accuracy radar circle */}
        {p && provider.accuracy > 0 && (
          <Circle
            center={p}
            radius={Math.min(provider.accuracy, 120)}
            pathOptions={{
              color: accent,
              weight: 1.5,
              fillColor: accent,
              fillOpacity: 0.1,
            }}
          />
        )}

        {d && <Marker position={d} icon={homeIcon} />}
        <AnimatedMarker
          position={p}
          heading={provider?.heading}
          avatarUrl={providerAvatar}
          providerName={providerName}
          stale={stale}
        />
        <FitBounds provider={p} destination={d} follow={follow} fitTrigger={fitTrigger} />
        <MapAutoResize mapRef={mapRef} />
        {onToggleFollow && <PanGuard onPan={() => onToggleFollow(false)} />}
      </MapContainer>

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
        <button
          type="button"
          onClick={() => setLayerType(layerType === 'satellite' ? 'auto' : 'satellite')}
          className="mc-map-control"
          title={layerType === 'satellite' ? 'Switch to street map' : 'Switch to satellite view'}
          aria-label={layerType === 'satellite' ? 'Switch to street map' : 'Switch to satellite view'}
          aria-pressed={layerType === 'satellite'}
        >
          <Globe className="w-4 h-4" />
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
