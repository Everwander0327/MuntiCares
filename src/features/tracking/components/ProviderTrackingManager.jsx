import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Home, Loader2, ChevronDown, ChevronUp, AlertTriangle, MapPinned, Minimize2, Maximize2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TRACKING_STATUS, prepareRoute, startPublishing } from '../services/trackingService';
import { isNative } from '../services/locationSource';
import useRouteEta from '../hooks/useRouteEta';
import { formatDistance, formatDuration } from '../services/geo';
import TrackingMap from './TrackingMap';

/**
 * Global, always-mounted for providers. Automatically starts sharing GPS
 * whenever one of the provider's visits is "On The Way" (no matter which page
 * changed the status) and stops when it moves on.
 */
export default function ProviderTrackingManager() {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider';
  const [active, setActive] = useState(null);

  const load = useCallback(async () => {
    if (!isProvider) return;
    const { data } = await supabase
      .from('requests')
      .select('id, patient_id, dest_lat, dest_lng, route_started_at, service, patient:patient_id(full_name, avatar_url)')
      .eq('provider_id', user.id)
      .eq('status', TRACKING_STATUS)
      .order('route_started_at', { ascending: false, nullsFirst: false })
      .limit(1);
    setActive(data?.[0] || null);
  }, [isProvider, user?.id]);

  useEffect(() => {
    if (!isProvider) return;
    load();
    const ch = supabase
      .channel(`provider-tracking-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `provider_id=eq.${user.id}` }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [isProvider, user?.id, load]);

  if (!isProvider || !active) return null;
  return (
    <ActiveRoute
      key={active.id}
      visit={active}
      providerId={user.id}
      providerName={user?.full_name || user?.user_metadata?.full_name}
      providerAvatar={user?.avatar_url || user?.user_metadata?.avatar_url}
      onArrived={load}
    />
  );
}

function ActiveRoute({ visit, providerId, providerName, providerAvatar, onArrived }) {
  const [fix, setFix] = useState(null);
  const [destination, setDestination] = useState(
    visit.dest_lat != null ? { lat: visit.dest_lat, lng: visit.dest_lng } : null
  );
  const [error, setError] = useState(null);
  const [near, setNear] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const session = useRef(null);
  const { route, distance, duration } = useRouteEta(fix, destination);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      let dest = destination;
      if (!dest || !visit.route_started_at) {
        dest = (await prepareRoute(visit.id, visit.patient_id)) || dest;
        if (!cancelled && dest) setDestination(dest);
      }
      if (cancelled) return;
      session.current = await startPublishing({
        requestId: visit.id,
        providerId,
        destination: dest,
        onFix: (f) => {
          setError(null);
          setFix(f);
        },
        onError: (e) => { setError(e.message); },
        onNearDestination: () => {
          setNear(true);
          setMinimized(false);
          toast.success("You're near the patient's address. Tap \"Arrived\" when you're there.", { duration: 6000 });
        },
      });
      if (cancelled) session.current?.stop();
    })();

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        status.onchange = () => {
          if (status.state === 'granted') {
            setError(null);
            setRetryKey((k) => k + 1);
          }
        };
      }).catch(() => {});
    }

    return () => { cancelled = true; session.current?.stop(); session.current = null; };
  }, [visit.id, retryKey]);

  const markArrived = async () => {
    setArriving(true);
    const { error: err } = await supabase
      .from('requests')
      .update({ status: 'Arrived', arrived_at: new Date().toISOString() })
      .eq('id', visit.id);
    setArriving(false);
    if (err) toast.error('Failed to mark arrived.');
    else {
      toast.success('Marked as arrived!');
      onArrived?.();
    }
  };

  const navUrl = destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
    : null;

  const patientName = visit.patient?.full_name || 'Patient';
  const patientAvatar = visit.patient?.avatar_url || null;
  const patientInitials = patientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence mode="wait">
      {minimized ? (
        <motion.button
          key="minimized-pill"
          type="button"
          onClick={() => setMinimized(false)}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          title="Expand Live Route Tracker"
          className="fixed z-[900] right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6 neu-flat px-3.5 py-2.5 rounded-full shadow-2xl border border-white/70 dark:border-white/10 flex items-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${error ? 'bg-rose-500' : 'bg-emerald-500'}`} />
          </span>
          <Navigation className="w-4 h-4 text-primary shrink-0" />
          <div className="text-left">
            <p className="text-3xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 leading-none">
              {error ? 'Location issue' : fix ? 'On Route · Live GPS' : 'Acquiring GPS…'}
            </p>
            <p className="text-2xs font-bold text-slate-800 dark:text-white tabular-nums leading-tight mt-0.5">
              {formatDuration(duration)} · {formatDistance(distance)}
            </p>
          </div>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </motion.button>
      ) : (
        <motion.div
          key="expanded-card"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed z-[900] left-3 right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-4 sm:w-[370px] lg:bottom-6 lg:right-6 lg:w-[390px]"
        >
          <div className="neu-flat rounded-[1.75rem] overflow-hidden shadow-2xl border border-white/60 dark:border-white/10">
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 210 }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-b border-[#D2E0EE]/70 dark:border-[#2D3F54]"
                >
                  <TrackingMap
                    provider={fix}
                    destination={destination}
                    route={route}
                    follow
                    compact
                    providerAvatar={providerAvatar}
                    providerName={providerName}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Link
                  to={visit.patient_id ? `/provider/patients/${visit.patient_id}/profile` : '#'}
                  title="View Patient Profile"
                  className="relative w-10 h-10 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-primary dark:text-[#8CBDF0] font-black text-xs"
                >
                  {patientAvatar ? (
                    <img src={patientAvatar} alt={patientName} className="w-full h-full object-cover" />
                  ) : (
                    patientInitials || <Navigation className="w-5 h-5 text-primary dark:text-[#8CBDF0]" />
                  )}
                  {fix && !error && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-900" />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-3xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {error ? 'Location issue' : fix ? 'On Route · Sharing live location' : 'Acquiring GPS…'}
                  </p>
                  <Link
                    to={visit.patient_id ? `/provider/patients/${visit.patient_id}/profile` : '#'}
                    className="text-xs font-bold text-slate-800 dark:text-white hover:text-primary dark:hover:text-[#8CBDF0] transition-colors truncate block"
                  >
                    {patientName} · {visit.service}
                  </Link>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
                    {formatDuration(duration)} · {formatDistance(distance)}
                    {fix?.accuracy ? ` · ±${Math.round(fix.accuracy)}m` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {visit.patient_id && (
                    <Link
                      to={`/provider/messages?partner=${visit.patient_id}&name=${encodeURIComponent(patientName)}`}
                      title="Message Patient"
                      className="neu-btn w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-primary dark:text-[#8CBDF0] cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    title={expanded ? 'Hide map' : 'Show map'}
                    className="neu-btn w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-300 cursor-pointer"
                  >
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setExpanded(false); setMinimized(true); }}
                    title="Minimize tracker"
                    className="neu-btn w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-300 cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-1.5">
                  <div className="flex items-start gap-1.5 text-2xs font-semibold leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                    <span className="flex-1">{error}</span>
                  </div>
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => setRetryKey((k) => k + 1)}
                      className="neu-btn px-2.5 py-1 rounded-lg text-3xs font-extrabold text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      Retry GPS
                    </button>
                  </div>
                </div>
              )}
              {!isNative() && !error && (
                <p className="text-3xs text-slate-400 dark:text-slate-400 font-medium leading-snug">
                  Keep this screen open while traveling. Use the MuntiCares app for background tracking.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={navUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`neu-btn px-3 py-2.5 rounded-xl text-xs font-bold text-primary dark:text-[#8CBDF0] flex items-center justify-center gap-1.5 ${!navUrl ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <MapPinned className="w-3.5 h-3.5" /> Navigate
                </a>
                <button
                  type="button"
                  onClick={markArrived}
                  disabled={arriving}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm ${
                    near ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse' : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {arriving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Home className="w-3.5 h-3.5" />} Arrived
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
