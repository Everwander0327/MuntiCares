import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, LocateFixed, Loader2, Check, MapPin, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { geocodeAddress, savePatientCoords } from '../services/geocoding';

const pinIcon = L.divIcon({
  className: '',
  iconSize: [40, 50],
  iconAnchor: [20, 48],
  html: `<div class="mc-home-pin"><div class="mc-home-pin-head"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></div><div class="mc-home-pin-shadow"></div></div>`,
});

function ClickToMove({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function MapAutoResize({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    if (mapRef) mapRef.current = map;
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 300);
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return () => clearTimeout(t);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [map, mapRef]);
  return null;
}

function Recenter({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 17)); }, [pos?.lat, pos?.lng]);
  return null;
}

/**
 * Lets a patient pin an exact location (home or a specific visit).
 * props: userId, address, initial {lat,lng}|null, onSaved(coords)
 * Optional: onSave(pos) to override persistence, saveLabel, locateLabel, emptyHint
 */
export default function LocationPicker({
  userId,
  address,
  initial,
  onSaved,
  onSave,
  saveLabel = 'Save pin',
  locateLabel = "I'm at home now",
  emptyHint = 'Tap the map to pin your home',
}) {
  const { dark } = useTheme();
  const [pos, setPos] = useState(initial || null);
  const [busy, setBusy] = useState(null); // 'geo' | 'gps' | 'save'
  const markerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (initial?.lat != null && initial?.lng != null) setPos(initial);
  }, [initial?.lat, initial?.lng]);

  const handlers = useMemo(() => ({
    dragend() {
      const m = markerRef.current;
      if (m) { const ll = m.getLatLng(); setPos({ lat: ll.lat, lng: ll.lng }); }
    },
  }), []);

  const findAddress = async () => {
    setBusy('geo');
    const hit = await geocodeAddress(address);
    setBusy(null);
    if (hit) { setPos(hit); toast.success('Address found. Drag the pin to adjust.'); }
    else toast.error("Couldn't find that address. Tap the map to pin it.");
  };

  const useGps = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported on this device.');
    if (!window.isSecureContext) {
      return toast.error('Location requires HTTPS or localhost. Use npm run dev:https');
    }
    setBusy('gps');
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(null); setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      (err) => {
        setBusy(null);
        if (err.code === 1) {
          toast.error('Location permission denied. Click the lock/tune icon beside the URL to allow Location.');
        } else if (err.code === 2) {
          toast.error('Location unavailable. Check if device GPS or Windows location service is turned ON.');
        } else {
          toast.error('Unable to get current location: ' + (err.message || 'Timed out'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const save = async () => {
    if (!pos) return;
    setBusy('save');
    try {
      if (onSave) {
        await onSave(pos);
      } else {
        await savePatientCoords(userId, pos);
        toast.success('Home location saved!');
        onSaved?.(pos);
      }
    } catch {
      toast.error('Failed to save location.');
    } finally { setBusy(null); }
  };

  useEffect(() => { if (!initial && address) findAddress(); }, []); // auto-try once

  return (
    <div className="mc-stack">
      <div className="mc-location-map">
        <MapContainer
          center={pos ? [pos.lat, pos.lng] : [14.4081, 121.0415]}
          zoom={pos ? 17 : 13}
          className="w-full h-full"
          zoomControl={false}
          style={{ background: dark ? '#0f172a' : '#eaf2f8' }}
        >
          <TileLayer
            key={dark ? 'dark' : 'light'}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
            maxZoom={19}
            className={`mc-map-tiles mc-muted-tiles${dark ? ' mc-dark-tiles' : ''}`}
          />
          <ClickToMove onPick={setPos} />
          <Recenter pos={pos} />
          <MapAutoResize mapRef={mapRef} />
          {pos && <Marker position={[pos.lat, pos.lng]} icon={pinIcon} draggable eventHandlers={handlers} ref={markerRef} />}
        </MapContainer>

        {/* Desktop zoom stays as one compact vertical control stack */}
        <div className="mc-map-controls m-0 hidden sm:flex" style={{ top: 'auto', bottom: 12, transform: 'none' }}>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom in"
            aria-label="Zoom in"
            className="mc-map-control"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom out"
            aria-label="Zoom out"
            className="mc-map-control"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {!pos && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
            <span className="flex items-center gap-2 rounded-lg border border-[var(--trk-border)] bg-[var(--trk-surface-overlay)] px-3 py-2 text-xs font-semibold text-[var(--trk-text-secondary)] shadow-[var(--trk-shadow-sm)] backdrop-blur-md">
              <MapPin className="h-3.5 w-3.5 text-[var(--trk-accent)]" /> {emptyHint}
            </span>
          </div>
        )}
      </div>

      {/* Responsive 2-col on mobile, inline flex on desktop */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={findAddress}
          disabled={!address || !!busy}
          className="mc-btn mc-btn--secondary col-span-1 px-3"
        >
          {busy === 'geo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="truncate">Find my address</span>
        </button>
        <button
          type="button"
          onClick={useGps}
          disabled={!!busy}
          className="mc-btn mc-btn--secondary col-span-1 px-3"
        >
          {busy === 'gps' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          <span className="truncate">{locateLabel}</span>
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!pos || !!busy}
          className="mc-btn mc-btn--primary col-span-2 sm:col-span-1 sm:ml-auto"
        >
          {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{saveLabel}</span>
        </button>
      </div>

      {pos && (
        <p className="mc-metric-row">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--trk-good)]" />
          <span>{pos.lat.toFixed(6)}, {pos.lng.toFixed(6)} &bull; Drag pin or tap map to fine-tune</span>
        </p>
      )}
    </div>
  );
}
