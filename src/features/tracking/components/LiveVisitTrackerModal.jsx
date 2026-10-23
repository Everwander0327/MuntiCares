import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Navigation, Clock, Route, Wifi, WifiOff, MessageSquare, Loader2, MapPin, CheckCircle2, UserRound, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import TrackingMap from './TrackingMap';
import VisitDestinationModal from './VisitDestinationModal';
import useRouteEta from '../hooks/useRouteEta';
import { subscribeToProvider, updateTrackingDestination } from '../services/trackingService';
import { ensurePatientCoords } from '../services/geocoding';
import { formatDistance, formatDuration } from '../services/geo';

const STALE_AFTER_S = 45;
const SESSION_STALE_AFTER_S = 90;

/**
 * Patient-facing live tracker.
 * props: isOpen, onClose, request { id, providerId, patientId, provider (name), providerAvatarUrl, service }
 */
export default function LiveVisitTrackerModal({ isOpen, onClose, request }) {
  const [provider, setProvider] = useState(null);
  const [destination, setDestination] = useState(null);
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [initialDist, setInitialDist] = useState(null);
  const [providerMeta, setProviderMeta] = useState(null);

  const { route, distance, duration } = useRouteEta(
    provider,
    destination,
    destination?.version || 0
  );

  // Track initial distance to compute a smooth visual progress bar
  useEffect(() => {
    if (!isOpen) {
      setInitialDist(null);
      return;
    }
    if (distance != null && isFinite(distance) && (initialDist == null || distance > initialDist)) {
      setInitialDist(distance);
    }
  }, [isOpen, distance, initialDist]);

  useEffect(() => {
    setInitialDist(null);
  }, [destination?.version]);

  // Close on Escape key for desktop UX
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Load destination + status + provider profile, subscribe to live location
  useEffect(() => {
    if (!isOpen || !request?.id) return;
    let alive = true;
    setProvider(null);
    setProviderMeta(null);
    setSession(null);
    setConnectionError(null);

    supabase
      .from('requests')
      .select('status, dest_lat, dest_lng, dest_address, dest_source, dest_version, provider_id, provider:provider_id(full_name, avatar_url)')
      .eq('id', request.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!alive) return;
        setStatus(data?.status);
        if (data?.provider || data?.provider_id) {
          setProviderMeta({
            id: data.provider_id,
            name: data.provider?.full_name,
            avatarUrl: data.provider?.avatar_url,
          });
        }
        if (data?.dest_lat != null) {
          setDestination({
            lat: data.dest_lat,
            lng: data.dest_lng,
            address: data.dest_address || null,
            source: data.dest_source || null,
            version: data.dest_version || 0,
          });
        } else if (request.patientId) {
          const c = await ensurePatientCoords(request.patientId);
          if (alive && c) setDestination({ ...c, address: null, version: 0 });
        }
      });

    const unsub = subscribeToProvider(request.id, {
      onLocation: (fix) => {
        if (!alive) return;
        setConnectionError(null);
        setProvider(fix);
      },
      onSession: (next) => alive && setSession(next),
      onStopped: (ended) => {
        if (!alive) return;
        setSession((prev) => ({ ...(prev || {}), ...ended, status: 'ended' }));
      },
      onRequest: (row) => {
        if (!alive) return;
        setStatus(row.status);
        if (row.dest_lat != null) {
          setDestination({
            lat: row.dest_lat,
            lng: row.dest_lng,
            address: row.dest_address || null,
            source: row.dest_source || null,
            version: row.dest_version || 0,
          });
        }
      },
      onError: (err) => {
        if (alive) setConnectionError(err?.message || 'Live updates are reconnecting…');
      },
    });

    return () => { alive = false; unsub(); };
  }, [isOpen, request?.id, request?.patientId]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  const ageS = provider?.timestamp ? Math.max(0, Math.round((now - provider.timestamp) / 1000)) : null;
  const sessionAgeS = session?.lastSeenAt ? Math.max(0, Math.round((now - session.lastSeenAt) / 1000)) : null;
  const sessionLive = session?.status === 'active'
    && (sessionAgeS == null || sessionAgeS < SESSION_STALE_AFTER_S);
  const fixFresh = ageS != null && ageS < STALE_AFTER_S;
  const live = Boolean(provider) && fixFresh && (sessionLive || !session);
  const stationary = Boolean(provider) && !fixFresh && sessionLive;
  const arrived = status === 'Arrived' || status === 'Completed';
  const eta = duration != null ? new Date(Date.now() + duration * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

  const liveLabel = arrived
    ? 'Arrived'
    : live
      ? 'Live GPS'
      : stationary
        ? 'Provider stationary'
        : session && session.status !== 'active'
          ? 'Tracking paused'
          : provider
            ? 'Signal lost'
            : 'Waiting for GPS';

  const progressPct = arrived
    ? 100
    : initialDist && distance != null && initialDist > 0
      ? Math.min(95, Math.max(12, Math.round((1 - distance / initialDist) * 100)))
      : provider
        ? 35
        : 8;

  const providerId = request?.providerId || providerMeta?.id;
  const providerName = request?.provider || providerMeta?.name || 'Healthcare Provider';
  const avatarUrl = request?.providerAvatarUrl || providerMeta?.avatarUrl || null;

  const initials = (providerName || 'PR')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const saveDestination = async (next) => {
    if (!request?.id) return;
    const updated = await updateTrackingDestination(request.id, {
      ...next,
      source: 'manual',
    });
    if (!updated) throw new Error('The visit destination could not be saved.');
    setDestination(updated);
    toast.success('Visit location updated.');
  };

  const canEditDestination = !arrived && !['Completed', 'Cancelled', 'Rejected'].includes(status);

  return (
    <>
      {createPortal(
        <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4 md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full sm:max-w-3xl lg:max-w-4xl h-[92dvh] sm:h-[84vh] max-h-[860px] rounded-t-[2rem] sm:rounded-[2.25rem] overflow-hidden neu-flat flex flex-col border border-white/60 dark:border-white/10 shadow-2xl"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Interactive Map Area */}
            <div className="relative flex-1 min-h-0">
              <TrackingMap
                provider={provider}
                destination={destination}
                route={route}
                follow={follow}
                onToggleFollow={setFollow}
                providerAvatar={avatarUrl}
                providerName={providerName}
              />

              {/* Top Floating HUD Bar */}
              <div className="absolute top-3.5 left-3.5 right-3.5 z-[1000] flex items-center justify-between gap-2 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/70 dark:border-white/10">
                  {arrived ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : live ? (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  ) : stationary ? (
                    <Wifi className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-100">
                    {liveLabel}
                  </span>
                  {provider?.accuracy != null && !arrived && (
                    <span className={`hidden xs:inline text-3xs font-bold border-l border-slate-200 dark:border-slate-700 pl-2 tabular-nums ${provider.degraded ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-400'}`}>
                      ±{Math.round(provider.accuracy)}m
                    </span>
                  )}
                </div>

                <button
                  type="button" onClick={onClose} title="Close tracker"
                  className="pointer-events-auto w-10 h-10 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/70 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!provider && !arrived && (
                <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none p-4">
                  <div className="px-4 py-3 rounded-2xl bg-white/92 dark:bg-slate-900/92 backdrop-blur-md shadow-xl border border-white/60 dark:border-white/10 flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    <span>Waiting for provider location…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Sheet (Mobile & Desktop Responsive Dock) */}
            <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 space-y-3.5 bg-[var(--neu-bg,#EEF3F8)] dark:bg-[#132233] border-t border-[#D2E0EE]/80 dark:border-[#2D3F54]">
              {/* Mobile drag indicator pill */}
              <div className="w-10 h-1 rounded-full bg-slate-300/90 dark:bg-slate-600/80 mx-auto sm:hidden" />

              {/* Provider Header + Action */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {providerId ? (
                    <Link
                      to={`/patient/providers/${providerId}/profile`}
                      onClick={onClose}
                      title="View Provider Profile"
                      className="relative shrink-0 group"
                    >
                      <div className="neu-flat-sm w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-primary font-black text-xs sm:text-sm overflow-hidden ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={providerName} className="w-full h-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#EEF3F8] dark:border-[#132233] ${
                        arrived || live || stationary ? 'bg-emerald-500' : 'bg-amber-400'
                      }`} />
                    </Link>
                  ) : (
                    <div className="relative shrink-0">
                      <div className="neu-flat-sm w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-primary font-black text-xs sm:text-sm overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={providerName} className="w-full h-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#EEF3F8] dark:border-[#132233] ${
                        arrived || live || stationary ? 'bg-emerald-500' : 'bg-amber-400'
                      }`} />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-3xs font-extrabold uppercase tracking-wider ${
                        arrived ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary dark:text-[#8CBDF0]'
                      }`}>
                        {arrived ? 'Your provider has arrived' : 'Provider on the way'}
                      </p>
                    </div>
                    {providerId ? (
                      <Link
                        to={`/patient/providers/${providerId}/profile`}
                        onClick={onClose}
                        className="font-display font-extrabold text-sm sm:text-lg text-slate-900 dark:text-white hover:text-primary dark:hover:text-[#8CBDF0] transition-colors truncate block"
                      >
                        {providerName}
                      </Link>
                    ) : (
                      <h2 className="font-display font-extrabold text-sm sm:text-lg text-slate-900 dark:text-white truncate">
                        {providerName}
                      </h2>
                    )}
                    <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {request?.service}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {providerId && (
                    <Link
                      to={`/patient/providers/${providerId}/profile`}
                      onClick={onClose}
                      title="View Provider Profile"
                      className="neu-btn px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <UserRound className="w-3.5 h-3.5 text-primary dark:text-[#8CBDF0]" />
                      <span className="hidden xs:inline">Profile</span>
                    </Link>
                  )}
                  <Link
                    to={`/patient/messages?provider=${providerId}&name=${encodeURIComponent(providerName)}`}
                    onClick={onClose}
                    className="neu-btn-primary px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </Link>
                </div>
              </div>

              {/* Journey Progress Bar (Provider -> Visit Destination) */}
              <div className="neu-inset rounded-2xl px-3.5 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-3xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 text-primary dark:text-[#8CBDF0]">
                    <Navigation className="w-3 h-3" /> On Route
                  </span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {arrived ? 'On-Site at Visit Location' : eta ? `Est. Arrival ${eta}` : 'Calculating route…'}
                  </span>
                  <span className={`flex items-center gap-1 ${arrived ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    <MapPin className="w-3 h-3" /> Visit
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      arrived
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-[#2F6FB5] to-sky-400'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <p className="text-3xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {destination?.address || (destination ? 'Pinned visit location' : 'Visit location not confirmed')}
                  </p>
                  {canEditDestination && (
                    <button
                      type="button"
                      onClick={() => setDestinationModalOpen(true)}
                      className="text-3xs font-extrabold text-primary dark:text-[#8CBDF0] hover:underline shrink-0 cursor-pointer"
                    >
                      {destination ? 'Change' : 'Set location'}
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Stat
                  icon={Clock}
                  label="ETA"
                  value={arrived ? 'Here' : formatDuration(duration)}
                  sub={!arrived && eta ? `≈ ${eta}` : arrived ? 'Arrived' : ''}
                  accent
                />
                <Stat
                  icon={Route}
                  label="Distance"
                  value={arrived ? '—' : formatDistance(distance)}
                  sub={!arrived && distance != null ? 'Door-to-door' : ''}
                />
                <Stat
                  icon={live || sessionLive ? Wifi : WifiOff}
                  label="Updated"
                  value={ageS == null ? '—' : ageS < 5 ? 'now' : `${ageS}s ago`}
                  sub={sessionLive
                    ? (live ? 'Real-time sync' : 'Stationary · session live')
                    : session
                      ? 'Tracking paused'
                      : provider
                        ? 'Reconnecting…'
                        : 'Waiting…'}
                />
              </div>

              {!destination && canEditDestination && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-2xs text-amber-700 dark:text-amber-300 font-semibold">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span className="truncate">Set the visit location for an exact road ETA.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDestinationModalOpen(true)}
                    className="text-3xs font-extrabold underline shrink-0 cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              )}

              {!arrived && session && session.status !== 'active' && (
                <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-2xs text-amber-700 dark:text-amber-300 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>Live sharing is paused. The provider&apos;s app will resume it automatically when connected.</span>
                </div>
              )}

              {connectionError && !arrived && (
                <p className="text-3xs font-semibold text-rose-500 dark:text-rose-400 px-1">
                  {connectionError}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
        </AnimatePresence>,
        document.body
      )}
      <VisitDestinationModal
        isOpen={destinationModalOpen}
        onClose={() => setDestinationModalOpen(false)}
        initial={destination}
        title="Update visit location"
        description="This updates the destination for this visit only. Your provider's ETA will refresh automatically."
        confirmLabel="Update visit location"
        onConfirm={saveDestination}
      />
    </>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="neu-inset rounded-2xl px-3 py-2.5 flex flex-col justify-between">
      <div className="flex items-center gap-1 text-3xs font-extrabold uppercase tracking-wider text-slate-400">
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`font-display font-black text-sm sm:text-lg tabular-nums mt-0.5 ${accent ? 'text-primary dark:text-[#8CBDF0]' : 'text-slate-800 dark:text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-3xs text-slate-500 dark:text-slate-400 font-semibold truncate">{sub}</div>}
    </div>
  );
}
