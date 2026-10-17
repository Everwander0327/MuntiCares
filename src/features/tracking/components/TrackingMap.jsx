import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe, Plus, Minus, Maximize2, Crosshair } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// 100% Free tile layers (zero API key required)
const TILES = {
  streets: {
    name: 'Modern Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
};

const escapeAttr = (str = '') => String(str).replace(/["'<>]/g, '');

const providerIcon = (heading, avatarUrl, providerName) => {
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
      <div class="mc-nav-vehicle mc-provider-marker">
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
function AnimatedMarker({ position, heading, avatarUrl, providerName }) {
  const ref = useRef(null);
  const from = useRef(position);
  const icon = useMemo(
    () => providerIcon(heading, avatarUrl, providerName),
    [heading, avatarUrl, providerName]
  );

  useEffect(() => {
    const marker = ref.current;
    if (!marker || !position) return;
    const start = from.current || position;
    const t0 = performance.now();
    const dur = 1000;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const lat = start[0] + (position[0] - start[0]) * e;
      const lng = start[1] + (position[1] - start[1]) * e;
      marker.setLatLng([lat, lng]);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = position;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [position?.[0], position?.[1]]);

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

  useEffect(() => {
    if (provider && destination) {
      if (!fittedBoth.current) {
        map.fitBounds([provider, destination], { padding: [65, 65], maxZoom: 17 });
        fittedBoth.current = true;
      } else if (follow) {
        map.panTo(provider, { animate: true });
      }
    } else if ((provider || destination) && !fittedInitial.current) {
      map.setView(provider || destination, 16);
      fittedInitial.current = true;
    }
  }, [provider?.[0], provider?.[1], destination?.[0], destination?.[1], follow, map]);

  useEffect(() => {
    if (!fitTrigger) return;
    if (provider && destination) {
      map.fitBounds([provider, destination], { padding: [65, 65], maxZoom: 17, animate: true });
    } else if (provider || destination) {
      map.setView(provider || destination, 16, { animate: true });
    }
  }, [fitTrigger]);

  return null;
}

export default function TrackingMap({
  provider,
  providerAvatar,
  providerName,
  destination,
  route,
  follow = false,
  onToggleFollow,
  compact = false,
  className = '',
}) {
  const { dark } = useTheme();
  const [layerType, setLayerType] = useState('auto'); // 'auto' | 'satellite' | 'streets'
  const [fitTrigger, setFitTrigger] = useState(0);
  const mapRef = useRef(null);

  const activeTileKey = layerType === 'satellite' ? 'satellite' : 'streets';
  const isDarkStreet = activeTileKey === 'streets' && dark;
  const tile = TILES[activeTileKey];

  const p = provider ? [provider.lat, provider.lng] : null;
  const d = destination ? [destination.lat, destination.lng] : null;
  const center = p || d || [14.4081, 121.0415]; // Muntinlupa

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={center}
        zoom={15}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
        style={{ background: dark ? '#0f172a' : '#eaf2f8' }}
      >
        <TileLayer
          key={`${activeTileKey}-${isDarkStreet ? 'dark' : 'light'}`}
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
          className={isDarkStreet ? 'mc-dark-tiles' : ''}
        />

        {/* Glow & outline polyline for traffic/navigation look */}
        {route?.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: '#0ea5e9', weight: 11, opacity: 0.35, lineCap: 'round' }} />
            <Polyline positions={route} pathOptions={{ color: '#0284c7', weight: 6, opacity: 0.95, lineCap: 'round' }} />
            <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.9, dashArray: '6, 10' }} />
          </>
        )}

        {/* Accuracy radar circle */}
        {p && provider.accuracy > 0 && (
          <Circle
            center={p}
            radius={Math.min(provider.accuracy, 120)}
            pathOptions={{
              color: '#0284c7',
              weight: 1.5,
              fillColor: '#38bdf8',
              fillOpacity: 0.12,
            }}
          />
        )}

        {d && <Marker position={d} icon={homeIcon} />}
        <AnimatedMarker
          position={p}
          heading={provider?.heading}
          avatarUrl={providerAvatar}
          providerName={providerName}
        />
        <FitBounds provider={p} destination={d} follow={follow} fitTrigger={fitTrigger} />
        <MapAutoResize mapRef={mapRef} />
      </MapContainer>

      {/* Bottom-Left: Map / Satellite Style Switcher */}
      <div className="absolute bottom-3.5 left-3.5 z-[1000] flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-1 shadow-lg border border-white/70 dark:border-white/10 select-none">
        <button
          type="button"
          onClick={() => setLayerType(layerType === 'satellite' ? 'auto' : 'satellite')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-3xs font-extrabold transition-all cursor-pointer ${
            layerType === 'satellite'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-200 hover:text-primary'
          }`}
          title="Toggle Satellite View"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{layerType === 'satellite' ? 'Satellite' : 'Map'}</span>
        </button>
      </div>

      {/* Bottom-Right: Desktop Zoom (+/-), Fit Route, and Follow Provider Controls */}
      <div className="absolute bottom-3.5 right-3.5 z-[1000] flex flex-col items-center gap-2 select-none">
        {!compact && (
          <div className="hidden sm:flex flex-col rounded-2xl overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/70 dark:border-white/10">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              title="Zoom in"
              className="w-10 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer border-b border-slate-200/60 dark:border-white/10"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              title="Zoom out"
              className="w-10 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        )}

        {(p || d) && (
          <button
            type="button"
            onClick={() => {
              onToggleFollow?.(false);
              setFitTrigger((c) => c + 1);
            }}
            title="Fit entire route in view"
            className="w-10 h-10 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/70 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary active:scale-95 transition-all cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        {onToggleFollow && (
          <button
            type="button"
            onClick={() => onToggleFollow((f) => !f)}
            title={follow ? 'Following provider (click to unlock)' : 'Follow provider'}
            className={`w-10 h-10 rounded-2xl shadow-lg border flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
              follow
                ? 'bg-primary text-white border-primary/50'
                : 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-primary border-white/70 dark:border-white/10'
            }`}
          >
            <Crosshair className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
