import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Map as MapLibreMap, AttributionControl } from 'maplibre-gl';
import { CrosshairSimple, Plus, Minus } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SkeletonText } from '@/shared/ui/skeleton';
import CenterMapPin from './CenterMapPin';
import BasemapControl from './BasemapControl';
import { reverseGeocode } from '../services/geocoding';
import { BASEMAP_STYLES, STYLE_STREETS, focusOnLocation } from '../mapStyles';

const PAN_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const ModernLocationPicker = forwardRef(function ModernLocationPicker(
  {
    initial,
    initialCenter = null,
    onPinChange,
    readOnly = false,
    basemap: controlledBasemap,
    onBasemapChange,
    hideBasemapControl = false,
    basemapVariant = 'toggle',
    fullBleed = false,
    hudInsets = null,
    className = 'h-[20rem] sm:h-[25rem]',
  },
  ref
) {
  const { dark } = useTheme();
  const { t } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const hasInitialPin = Boolean(initial?.lat != null && initial?.lng != null);
  const [ready, setReady] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [hasConfirmedPin, setHasConfirmedPin] = useState(hasInitialPin);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [internalBasemap, setInternalBasemap] = useState('streets');
  const basemap = controlledBasemap ?? internalBasemap;
  const setBasemap = (nextMode) => {
    setInternalBasemap(nextMode);
    onBasemapChange?.(nextMode);
  };
  const setBasemapRef = useRef(setBasemap);
  setBasemapRef.current = setBasemap;
  const debounceTimer = useRef(null);
  const pendingBasemapRef = useRef(null);
  const appliedStyleRef = useRef(null);
  const userMovedRef = useRef(hasInitialPin);
  const isMountedRef = useRef(true);
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const initialCenterRef = useRef(initialCenter);
  initialCenterRef.current = initialCenter;
  const topPad = fullBleed ? Math.max(0, Number(hudInsets?.top) || 0) : 0;
  const bottomPad = fullBleed ? Math.max(0, Number(hudInsets?.bottom) || 0) : 0;
  const centerOffsetY = fullBleed ? Math.round((topPad - bottomPad) / 2) : 0;
  const paddingRef = useRef({ top: topPad, bottom: bottomPad });
  paddingRef.current = { top: topPad, bottom: bottomPad };

  // Expose flyTo capability to parent components (e.g. for autocomplete search)
  useImperativeHandle(ref, () => ({
    flyToLocation: ({ lat, lng }) => {
      if (!mapRef.current) return;
      userMovedRef.current = true;
      setHasConfirmedPin(true);
      focusOnLocation(mapRef.current, [lng, lat]);
    },
    getCenter: () => {
      if (!mapRef.current) return null;
      const c = mapRef.current.getCenter();
      return { lat: c.lat, lng: c.lng };
    },
    // True after the user dragged, arrow-panned, searched, or tapped locate.
    hasUserMoved: () => userMovedRef.current,
  }));

  useEffect(() => {
    if (!mapContainer.current) return;
    isMountedRef.current = true;
    const initCoords = initialRef.current;
    const centerHint = initialCenterRef.current;

    // An unconfirmed destination opens near its geocoded estimate, but the
    // hint never becomes a pin until the user moves the map.
    const cameraAnchor =
      initCoords?.lat != null && initCoords?.lng != null
        ? initCoords
        : centerHint?.lat != null && centerHint?.lng != null
          ? centerHint
          : null;
    // Default to Muntinlupa City Hall / Alabang
    const startCenter = cameraAnchor ? [cameraAnchor.lng, cameraAnchor.lat] : [121.0415, 14.4081];

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: STYLE_STREETS,
      center: startCenter,
      zoom: cameraAnchor ? 17 : 14.5,
      pitch: 0, // Flat top-down 2D perspective
      maxPitch: 0,
      pitchWithRotate: false,
      bearing: 0,
      attributionControl: false,
      interactive: !readOnlyRef.current,
    });

    mapRef.current = map;
    appliedStyleRef.current = STYLE_STREETS;
    if (paddingRef.current.top || paddingRef.current.bottom) {
      map.setPadding({ top: paddingRef.current.top, bottom: paddingRef.current.bottom, left: 0, right: 0 });
    }

    // Add minimal attribution in corner
    map.addControl(
      new AttributionControl({ compact: true }),
      'bottom-left'
    );

    map.on('load', () => {
      map.resize();
      if (isMountedRef.current) setReady(true);
    });

    // A failed base map load reverts to the street map instead of leaving a
    // blank canvas.
    map.on('styledata', () => {
      pendingBasemapRef.current = null;
    });
    map.on('error', () => {
      if (!pendingBasemapRef.current) return;
      pendingBasemapRef.current = null;
      setBasemapRef.current('streets');
      toast.error(tRef.current('tracking.map.basemapFailed'));
    });

    const onMoveStart = () => setIsPanning(true);
    const onDragStart = () => {
      userMovedRef.current = true;
      if (isMountedRef.current) setHasConfirmedPin(true);
    };
    const onCanvasKeyDown = (e) => {
      if (readOnlyRef.current || !PAN_KEYS.has(e.key)) return;
      userMovedRef.current = true;
      if (isMountedRef.current) setHasConfirmedPin(true);
    };

    const canvasContainer = map.getCanvasContainer();
    canvasContainer?.addEventListener('keydown', onCanvasKeyDown);

    const onMoveEnd = () => {
      setIsPanning(false);
      if (readOnlyRef.current) return;
      // Ignore the initial moveend so the default Muntinlupa center isn't
      // silently accepted as the patient's home before they touch the map.
      if (!userMovedRef.current) return;
      if (isMountedRef.current) setHasConfirmedPin(true);
      const center = map.getCenter();
      const pos = { lat: center.lat, lng: center.lng };

      // The pin itself is valid immediately; only the address label depends on
      // the lookup, so the parent never waits on Nominatim to accept the pin.
      onPinChangeRef.current?.({ ...pos, resolved: false, pending: true });

      // Debounce reverse geocoding to prevent excessive requests
      clearTimeout(debounceTimer.current);
      setLoadingAddress(true);
      debounceTimer.current = setTimeout(async () => {
        const resolved = await reverseGeocode(pos.lat, pos.lng);
        if (!isMountedRef.current) return;
        setLoadingAddress(false);
        onPinChangeRef.current?.({
          ...pos,
          address: resolved || undefined,
          resolved: Boolean(resolved),
          pending: false,
        });
      }, 350);
    };

    map.on('movestart', onMoveStart);
    map.on('dragstart', onDragStart);
    map.on('moveend', onMoveEnd);

    // Auto-resize on container size changes
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(mapContainer.current);

    return () => {
      isMountedRef.current = false;
      clearTimeout(debounceTimer.current);
      ro.disconnect();
      canvasContainer?.removeEventListener('keydown', onCanvasKeyDown);
      map.off('movestart', onMoveStart);
      map.off('dragstart', onDragStart);
      map.off('moveend', onMoveEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync map camera when initial coordinates arrive asynchronously (and user hasn't manually panned yet)
  useEffect(() => {
    if (!mapRef.current || userMovedRef.current) return;
    const pin = initialRef.current;
    const hint = initialCenterRef.current;
    const hasPin = pin?.lat != null && pin?.lng != null;
    const focus = hasPin ? pin : hint;
    if (focus?.lat == null || focus?.lng == null) return;
    mapRef.current.jumpTo({
      center: [focus.lng, focus.lat],
      zoom: 17,
    });
    if (hasPin) setHasConfirmedPin(true);
  }, [initial?.lat, initial?.lng, initialCenter?.lat, initialCenter?.lng]);

  // Keep MapLibre center padded into the visible window between floating overlays.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setPadding({ top: topPad, bottom: bottomPad, left: 0, right: 0 });
  }, [topPad, bottomPad]);

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
      toast.error(t('tracking.map.geoUnsupported'));
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const { latitude, longitude } = pos.coords;
        userMovedRef.current = true;
        setHasConfirmedPin(true);
        focusOnLocation(mapRef.current, [longitude, latitude]);
        toast.success(t('tracking.map.centeredGps'));
      },
      (err) => {
        setLocatingGps(false);
        if (err.code === 1) {
          toast.error(t('tracking.map.permissionDenied'));
        } else {
          toast.error(t('tracking.map.locationFailed'));
        }
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div
      style={fullBleed ? { '--mc-hud-top': `${topPad}px`, '--mc-hud-bottom': `${bottomPad}px` } : undefined}
      className={`${fullBleed ? 'absolute inset-0 h-full' : 'relative'} isolate z-0 w-full overflow-hidden focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${
        fullBleed
          ? 'mc-map-fullbleed focus-within:ring-inset'
          : 'rounded-2xl shadow-inner border border-surface-border'
      } ${
        basemap !== 'satellite' ? (dark ? 'mc-canvas-tiles--dark' : 'mc-canvas-tiles--muted') : ''
      } ${className}`}
    >
      {/* WebGL Map Canvas */}
      <div ref={mapContainer} className="w-full h-full" />

      {!ready && (
        <div
          className="absolute inset-0 z-30 flex flex-col justify-between p-4 bg-surface-subtle"
          style={fullBleed ? { paddingTop: `${topPad + 16}px`, paddingBottom: `${bottomPad + 16}px` } : undefined}
          role="status"
          aria-label={t('tracking.map.loadingMap')}
        >
          <div className="flex justify-end">
            <SkeletonText width="w-24" className="h-11 rounded-xl" />
          </div>
          <div className="mx-auto flex flex-col items-center gap-2">
            <SkeletonText width="w-10" className="h-10 rounded-xl" />
            <span className="text-[max(0.75rem,12px)] font-medium text-tertiary">
              {t('tracking.map.loadingMap')}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <SkeletonText width="w-24" className="h-11 rounded-xl" />
            <SkeletonText width="w-11" className="h-24 rounded-xl" />
          </div>
        </div>
      )}

      {/* Care Home Beacon */}
      <CenterMapPin
        isPanning={isPanning}
        loading={loadingAddress}
        confirmed={hasConfirmedPin}
        hideLabel={readOnly}
        centerOffsetY={centerOffsetY}
      />

      {/* Map HUD: compact & unified */}
      {!readOnly && ready && (
        <>
          {!hideBasemapControl && (
            <div className="mc-basemap-dock mc-basemap-dock--top-right">
              <BasemapControl value={basemap} onChange={setBasemap} variant={basemapVariant} />
            </div>
          )}

          {!fullBleed && (
            <div className="mc-gps-dock--bottom-left">
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locatingGps}
                className="mc-gps-pill-btn disabled:opacity-70 disabled:cursor-not-allowed"
                title={t('tracking.map.useGpsTitle')}
                aria-label={t('tracking.map.useGpsTitle')}
              >
                <CrosshairSimple className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{locatingGps ? t('tracking.map.locating') : t('tracking.map.myGps')}</span>
              </button>
            </div>
          )}

          <div className="mc-split-controls mc-split-controls--bottom">
            {fullBleed && (
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locatingGps}
                className="mc-gps-pill-btn disabled:opacity-70 disabled:cursor-not-allowed"
                title={t('tracking.map.useGpsTitle')}
                aria-label={t('tracking.map.useGpsTitle')}
              >
                <CrosshairSimple className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{locatingGps ? t('tracking.map.locating') : t('tracking.map.myGps')}</span>
              </button>
            )}

            <div className="mc-zoom-pod" role="group" aria-label={t('tracking.map.zoomControlsAria')}>
              <button
                type="button"
                onClick={() => {
                  mapRef.current?.zoomIn();
                }}
                className="mc-zoom-pod__btn"
                title={t('tracking.map.zoomIn')}
                aria-label={t('tracking.map.zoomIn')}
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  mapRef.current?.zoomOut();
                }}
                className="mc-zoom-pod__btn"
                title={t('tracking.map.zoomOut')}
                aria-label={t('tracking.map.zoomOut')}
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default ModernLocationPicker;
