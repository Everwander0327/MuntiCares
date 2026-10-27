import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Map as MapLibreMap, AttributionControl } from 'maplibre-gl';
import { LocateFixed, Plus, Minus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import CenterMapPin from './CenterMapPin';
import BasemapControl from './BasemapControl';
import { reverseGeocode } from '../services/geocoding';
import { BASEMAP_STYLES, STYLE_STREETS, focusOnLocation } from '../mapStyles';

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
  const debounceTimer = useRef(null);
  const pendingBasemapRef = useRef(null);
  const appliedStyleRef = useRef(null);
  const userMovedRef = useRef(false);
  const isMountedRef = useRef(true);
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // Expose flyTo capability to parent components (e.g. for autocomplete search)
  useImperativeHandle(ref, () => ({
    flyToLocation: ({ lat, lng }) => {
      if (!mapRef.current) return;
      userMovedRef.current = true;
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 17,
        pitch: 0,
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
      style: STYLE_STREETS,
      center: startCenter,
      zoom: initCoords ? 17 : 14.5,
      pitch: 0, // Flat top-down 2D perspective
      maxPitch: 0,
      pitchWithRotate: false,
      bearing: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    appliedStyleRef.current = STYLE_STREETS;

    // Add minimal attribution in corner
    map.addControl(
      new AttributionControl({ compact: true }),
      'bottom-left'
    );

    map.on('load', () => {
      map.resize();
    });

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

  // Swap basemap; theme is handled by the muted/dark canvas filter, not the style.
  useEffect(() => {
    if (!mapRef.current) return;
    const next = BASEMAP_STYLES[basemap] || STYLE_STREETS;
    if (appliedStyleRef.current === next) return;
    appliedStyleRef.current = next;
    pendingBasemapRef.current = basemap === 'streets' ? null : basemap;
    mapRef.current.setStyle(next);
  }, [basemap]);

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

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200/80 dark:border-white/10 ${
        basemap !== 'satellite' ? (dark ? 'mc-canvas-tiles--dark' : 'mc-canvas-tiles--muted') : ''
      } ${className}`}
    >
      {/* WebGL Map Canvas */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Foodpanda-style Fixed Center Pin */}
      <CenterMapPin
        isPanning={isPanning}
        addressPreview={addressPreview}
        loading={loadingAddress}
      />

      {/* Control stack mirrors the live visit tracker */}
      <div className="mc-map-controls mc-map-controls--bottom">
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
          onClick={() => {
            userMovedRef.current = true;
            mapRef.current?.zoomIn();
          }}
          className="mc-map-control"
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
          className="mc-map-control"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default ModernLocationPicker;
