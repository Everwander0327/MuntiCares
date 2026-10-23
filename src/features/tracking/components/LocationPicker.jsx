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
    <div className="space-y-3">
      <div className="relative h-64 sm:h-72 rounded-2xl overflow-hidden neu-inset border border-[#D2E0EE]/70 dark:border-[#2D3F54]">
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
            attribution="&copy; OpenStreetMap"
            maxZoom={19}
            className={dark ? 'mc-dark-tiles' : ''}
          />
          <ClickToMove onPick={setPos} />
          <Recenter pos={pos} />
          <MapAutoResize mapRef={mapRef} />
          {pos && <Marker position={[pos.lat, pos.lng]} icon={pinIcon} draggable eventHandlers={handlers} ref={markerRef} />}
        </MapContainer>

        {/* Desktop Zoom (+/-) Controls */}
        <div className="hidden sm:flex flex-col absolute bottom-3 right-3 z-[500] rounded-xl overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md border border-white/70 dark:border-white/10">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom in"
            className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary cursor-pointer border-b border-slate-200/60 dark:border-white/10"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom out"
            className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        {!pos && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none p-4">
            <span className="px-3.5 py-2 rounded-xl bg-white/92 dark:bg-slate-900/92 backdrop-blur-md text-2xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 shadow-lg border border-white/60 dark:border-white/10">
              <MapPin className="w-3.5 h-3.5 text-primary" /> {emptyHint}
            </span>
          </div>
        )}
      </div>

      {/* Responsive 2-col on mobile, inline flex on desktop */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={findAddress}
          disabled={!address || !!busy}
          className="col-span-1 neu-btn px-3 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-primary dark:text-[#8CBDF0] flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
        >
          {busy === 'geo' ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Search className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">Find my address</span>
        </button>
        <button
          type="button"
          onClick={useGps}
          disabled={!!busy}
          className="col-span-1 neu-btn px-3 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-primary dark:text-[#8CBDF0] flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
        >
          {busy === 'gps' ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <LocateFixed className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{locateLabel}</span>
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!pos || !!busy}
          className="col-span-2 sm:col-span-1 sm:ml-auto neu-btn-primary px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-sm"
        >
          {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
          <span>{saveLabel}</span>
        </button>
      </div>

      {pos && (
        <p className="text-3xs text-slate-400 dark:text-slate-400 font-medium tabular-nums flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>{pos.lat.toFixed(6)}, {pos.lng.toFixed(6)} &bull; Drag pin or tap map to fine-tune</span>
        </p>
      )}
    </div>
  );
}
