import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Map as MapLibreMap, AttributionControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Plus, Minus, Layers, Loader2, Map as MapIcon, Satellite, Mountain, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import CenterMapPin from './CenterMapPin';
import { reverseGeocode } from '../services/geocoding';

// OpenFreeMap vector tile styles (100% free, fast CDN, no API key required)
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

// ArcGIS basemap styles (satellite imagery + terrain relief). Uses the
// vector Basemap Styles v2 endpoint when VITE_ARCGIS_API_KEY is configured,
// and falls back to keyless Esri World Imagery + Labels / World Topo Map
// MapLibre style definitions when the env var is omitted in deployment.
const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;
const FALLBACK_STYLES = {
  satellite: {
    version: 8,
    sources: {
      'esri-imagery': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      },
      'esri-labels': {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      { id: 'esri-imagery-layer', type: 'raster', source: 'esri-imagery' },
      { id: 'esri-labels-layer', type: 'raster', source: 'esri-labels' },
    ],
  },
  terrain: {
    version: 8,
    sources: {
      'esri-terrain': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; Esri, HERE, Garmin, Intermap, USGS',
      },
    },
    layers: [
      { id: 'esri-terrain-layer', type: 'raster', source: 'esri-terrain' },
    ],
  },
};

const ARCGIS_STYLES = ARCGIS_API_KEY
  ? {
      satellite: `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?token=${ARCGIS_API_KEY}`,
      terrain: `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/terrain?token=${ARCGIS_API_KEY}`,
    }
  : FALLBACK_STYLES;

const BASEMAPS = [
  { id: 'streets', label: 'Street', icon: MapIcon },
  { id: 'satellite', label: 'Satellite', icon: Satellite },
  { id: 'terrain', label: 'Terrain', icon: Mountain },
];

// Vite emits the worker as a bundled asset only when imported explicitly;
// MapLibre's runtime import.meta.url lookup points at a file the build never copies.
setWorkerUrl(maplibreWorkerUrl);

const ModernLocationPicker = forwardRef(function ModernLocationPicker(
  { initial, onPinChange, className = 'h-[320px] sm:h-[400px]' },
  ref
) {
  const { dark } = useTheme();
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [addressPreview, setAddressPreview] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [basemap, setBasemap] = useState('streets');
  const [menuOpen, setMenuOpen] = useState(false);
  const debounceTimer = useRef(null);
  const pendingBasemapRef = useRef(null);
  const menuRef = useRef(null);
  const userMovedRef = useRef(false);
  const isMountedRef = useRef(true);
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const darkRef = useRef(dark);
  darkRef.current = dark;

  // Expose flyTo capability to parent components (e.g. for autocomplete search)
  useImperativeHandle(ref, () => ({
    flyToLocation: ({ lat, lng }) => {
      if (!mapRef.current) return;
      userMovedRef.current = true;
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 17,
        pitch: 35,
        essential: true,
      });
    },
    getCenter: () => {
      if (!mapRef.current) return null;
      const c = mapRef.current.getCenter();
      return { lat: c.lat, lng: c.lng };
    },
  }));

  useEffect(() => {
    if (!mapContainer.current) return;
    isMountedRef.current = true;
    const initCoords = initialRef.current;

    // Default to Muntinlupa City Hall / Alabang
    const startCenter =
      initCoords?.lat != null && initCoords?.lng != null
        ? [initCoords.lng, initCoords.lat]
        : [121.0415, 14.4081];

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: darkRef.current ? STYLE_DARK : STYLE_LIGHT,
      center: startCenter,
      zoom: initCoords ? 17 : 14.5,
      pitch: 35, // 35-degree modern delivery app 3D perspective
      bearing: 0,
      attributionControl: false,
    });

    mapRef.current = map;

    // Add minimal attribution in corner
    map.addControl(
      new AttributionControl({ compact: true }),
      'bottom-left'
    );

    map.on('load', () => {
      map.resize();
    });

    // A failed ArcGIS style load (bad key, blocked referrer, network) reverts
    // to the street map instead of leaving a blank canvas.
    map.on('styledata', () => {
      pendingBasemapRef.current = null;
    });
    map.on('error', () => {
      const failed = pendingBasemapRef.current;
      if (!failed) return;
      pendingBasemapRef.current = null;
      if (ARCGIS_API_KEY && FALLBACK_STYLES[failed]) {
        map.setStyle(FALLBACK_STYLES[failed]);
        return;
      }
      setBasemap('streets');
      toast.error(
        `${failed === 'terrain' ? 'Terrain' : 'Satellite'} imagery failed to load; switched back to the street map.`
      );
    });

    const onMoveStart = () => setIsPanning(true);
    const onMoveEnd = () => {
      setIsPanning(false);
      // Ignore the initial moveend so the default Muntinlupa center isn't
      // silently accepted as the patient's home before they touch the map.
      if (!userMovedRef.current) return;
      const center = map.getCenter();
      const pos = { lat: center.lat, lng: center.lng };

      // Debounce reverse geocoding to prevent excessive requests
      clearTimeout(debounceTimer.current);
      setLoadingAddress(true);
      debounceTimer.current = setTimeout(async () => {
        const resolved = await reverseGeocode(pos.lat, pos.lng);
        if (!isMountedRef.current) return;
        const label = resolved || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
        setAddressPreview(label);
        setLoadingAddress(false);
        onPinChangeRef.current?.({ ...pos, address: label });
      }, 350);
    };

    map.on('movestart', onMoveStart);
    map.on('dragstart', () => {
      userMovedRef.current = true;
    });
    map.on('moveend', onMoveEnd);

    // Initial reverse geocode if initial coordinates provided
    if (initCoords?.lat != null && initCoords?.lng != null) {
      reverseGeocode(initCoords.lat, initCoords.lng).then((name) => {
        if (isMountedRef.current && name) setAddressPreview(name);
      });
    }

    // Auto-resize on container size changes
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(mapContainer.current);

    return () => {
      isMountedRef.current = false;
      clearTimeout(debounceTimer.current);
      ro.disconnect();
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync map camera when initial coordinates arrive asynchronously (and user hasn't manually panned yet)
  useEffect(() => {
    if (!mapRef.current || userMovedRef.current) return;
    if (initial?.lat != null && initial?.lng != null) {
      mapRef.current.jumpTo({
        center: [initial.lng, initial.lat],
        zoom: 17,
      });
      reverseGeocode(initial.lat, initial.lng).then((name) => {
        if (isMountedRef.current && name) setAddressPreview(name);
      });
    }
  }, [initial?.lat, initial?.lng]);

  // Switch style when dark mode or base map changes
  useEffect(() => {
    if (!mapRef.current) return;
    const url =
      basemap === 'streets'
        ? dark
          ? STYLE_DARK
          : STYLE_LIGHT
        : ARCGIS_STYLES?.[basemap];
    if (!url) return;
    pendingBasemapRef.current = basemap === 'streets' ? null : basemap;
    mapRef.current.setStyle(url);
  }, [dark, basemap]);

  // Close the base map menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

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
        userMovedRef.current = true;
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: 17.5,
          pitch: 35,
          essential: true,
        });
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

  const availableBasemaps = ARCGIS_STYLES ? BASEMAPS : BASEMAPS.slice(0, 1);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200/80 dark:border-white/10 ${className}`}>
      {/* WebGL Map Canvas */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Foodpanda-style Fixed Center Pin */}
      <CenterMapPin
        isPanning={isPanning}
        addressPreview={addressPreview}
        loading={loadingAddress}
      />

      {/* Floating Map Controls on right */}
      <div className="absolute right-3.5 bottom-3.5 z-[500] flex flex-col items-center gap-2">
        {/* Basemap selector */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200/70 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all hover:scale-105 active:scale-95"
            title="Change base map"
            aria-label="Change base map"
          >
            <Layers className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Base map"
              className="absolute right-0 bottom-12 w-40 rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-slate-200/70 dark:border-white/10 p-1"
            >
              {availableBasemaps.map(({ id, label, icon: Icon }) => {
                const active = basemap === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setBasemap(id);
                      setMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary dark:bg-primary-400/15 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="flex-1 text-left">{label}</span>
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* GPS Locate Me Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locatingGps}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200/70 dark:border-white/10 flex items-center justify-center text-primary dark:text-[#8CBDF0] hover:scale-105 active:scale-95 transition-all"
          title="Use my current GPS location"
          aria-label="Use my current GPS location"
        >
          {locatingGps ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
        </button>

        {/* Zoom Controls */}
        <div className="hidden sm:flex flex-col rounded-xl overflow-hidden shadow-md border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-white/5">
          <button
            type="button"
            onClick={() => {
              userMovedRef.current = true;
              mapRef.current?.zoomIn();
            }}
            className="w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              userMovedRef.current = true;
              mapRef.current?.zoomOut();
            }}
            className="w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default ModernLocationPicker;
