import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  Home,
  Loader2,
  AlertTriangle,
  MapPinned,
  Minimize2,
  Maximize2,
  MessageSquare,
  Clock,
  Route,
  MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  TRACKING_STATUS,
  TRACKING_STALE_MS,
  ARRIVAL_RADIUS_M,
  prepareTrackingDestination,
  startPublishing,
  markVisitArrived,
  formatArrivalFailure,
  ARRIVAL_OVERRIDE_REASON,
} from '../services/trackingService';
import { isNative } from '../services/locationSource';
import useRouteEta from '../hooks/useRouteEta';
import useMediaQuery from '@/hooks/useMediaQuery';
import { formatDistance, formatDuration } from '../services/geo';
import TrackingMap from './TrackingMap';
import { getProviderStatus, formatAccuracy, formatFreshness } from './trackingStatus';

const STALE_AFTER_S = TRACKING_STALE_MS / 1000;

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
      .select('id, patient_id, dest_lat, dest_lng, dest_address, dest_source, dest_version, route_started_at, service, patient:patient_id(full_name, avatar_url)')
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
      providerName={user?.full_name || user?.user_metadata?.full_name}
      providerAvatar={user?.avatar_url || user?.user_metadata?.avatar_url}
      onArrived={load}
    />
  );
}

function ActiveRoute({ visit, providerName, providerAvatar, onArrived }) {
  const [fix, setFix] = useState(null);
  const [destination, setDestination] = useState(
    visit.dest_lat != null
      ? {
          lat: visit.dest_lat,
          lng: visit.dest_lng,
          address: visit.dest_address || null,
          source: visit.dest_source || null,
          version: visit.dest_version || 0,
        }
      : null
  );
  const [gpsError, setGpsError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const destinationRef = useRef(destination);
  destinationRef.current = destination;
  const [near, setNear] = useState(false);
  const [view, setView] = useState('map'); // Redesign: underlined Map / Trip details tabs
  const [follow, setFollow] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [now, setNow] = useState(Date.now());
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const minimizeRef = useRef(null);
  const expandRef = useRef(null);
  const wasMinimizedRef = useRef(minimized);
  const mapTabRef = useRef(null);
  const detailsTabRef = useRef(null);
  const session = useRef(null);
  const error = gpsError || syncError;
  const { route, distance, duration } = useRouteEta(
    fix,
    destination,
    destination?.version || 0
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Moving between the dock and the collapsed bar must not drop keyboard focus.
  useEffect(() => {
    if (wasMinimizedRef.current === minimized) return;
    wasMinimizedRef.current = minimized;
    if (minimized) expandRef.current?.focus();
    else minimizeRef.current?.focus();
  }, [minimized]);

  const onTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = view === 'map' ? 'details' : 'map';
    setView(next);
    (next === 'map' ? mapTabRef : detailsTabRef).current?.focus();
  };

  useEffect(() => {
    setNear(false);
  }, [visit.dest_lat, visit.dest_lng]);

  useEffect(() => {
    if (visit.dest_lat == null || visit.dest_lng == null) return;
    const next = {
      lat: visit.dest_lat,
      lng: visit.dest_lng,
      address: visit.dest_address || null,
      source: visit.dest_source || null,
      version: visit.dest_version || 0,
    };
    setDestination((prev) => (
      prev?.lat === next.lat && prev?.lng === next.lng && prev?.version === next.version
        ? prev
        : next
    ));
    session.current?.setDestination(next);
  }, [visit.dest_lat, visit.dest_lng, visit.dest_address, visit.dest_source, visit.dest_version]);

  useEffect(() => {
    let cancelled = false;
    setGpsError(null);
    setSyncError(null);
    (async () => {
      try {
        let dest = destinationRef.current;
        if (!dest) {
          dest = await prepareTrackingDestination(visit.id);
          if (!cancelled && dest) setDestination(dest);
        }
        if (cancelled) return;
        session.current = await startPublishing({
          requestId: visit.id,
          destination: dest,
          onFix: (f) => {
            setFix(f);
            if (!f.degraded) setGpsError(null);
          },
          onGpsError: (e) => setGpsError(e.message),
          onError: (e) => setSyncError(e.message),
          onSession: (s) => {
            setSyncError(null);
            if (s.destination) {
              setDestination((prev) => {
                if (prev?.lat === s.destination.lat && prev?.version === s.destination.version) return prev;
                return s.destination;
              });
            }
          },
          onNearDestination: () => {
            setNear(true);
            setView('map');
            setMinimized(false);
            toast.success("You're near the patient's address. Tap \"Arrived\" when you're there.", { duration: 6000 });
          },
        });
        if (cancelled) session.current?.stop();
      } catch (err) {
        if (!cancelled) setSyncError(err?.message || 'Unable to start live tracking.');
      }
    })();

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        status.onchange = () => {
          if (status.state === 'granted') {
            setGpsError(null);
            setRetryKey((k) => k + 1);
          }
        };
      }).catch(() => {});
    }

    return () => { cancelled = true; session.current?.stop(); session.current = null; };
  }, [visit.id, retryKey]);

  useEffect(() => {
    const ch = supabase
      .channel(`provider-route-${visit.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${visit.id}` },
        (payload) => {
          if (payload?.new && payload.new.status !== TRACKING_STATUS) {
            session.current?.stop(`status_${payload.new.status.toLowerCase()}`);
            onArrived?.();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [visit.id, onArrived]);

  const markArrived = async ({ override = false } = {}) => {
    if (!override) {
      const fixAge = fix?.timestamp ? Date.now() - fix.timestamp : null;
      if (!fix || fix.degraded || fixAge == null || fixAge >= TRACKING_STALE_MS) {
        toast.error('Waiting for a fresh, precise GPS fix before marking arrived.');
        return;
      }
    }
    setArriving(true);
    try {
      const res = await markVisitArrived(
        visit.id,
        session.current?.sessionId,
        override ? ARRIVAL_OVERRIDE_REASON : null
      );
      if (res?.ok) {
        setOverrideOpen(false);
        toast.success(res.override ? 'Arrived — override recorded.' : 'Marked as arrived!');
        try {
          await session.current?.stop('arrived');
        } catch { /* ignore */ }
        onArrived?.();
      } else {
        toast.error(formatArrivalFailure(res));
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to mark arrived.');
    } finally {
      setArriving(false);
    }
  };

  const navUrl = destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
    : null;

  const ageS = fix?.timestamp ? Math.max(0, Math.round((now - fix.timestamp) / 1000)) : null;
  const fixFresh = ageS != null && ageS < STALE_AFTER_S;
  const stale = Boolean(fix) && !fixFresh;
  const statusMeta = getProviderStatus({ fix, error, stale });
  const freshness = formatFreshness(ageS);
  const accuracy = formatAccuracy(fix?.accuracy);
  const preciseFix = Boolean(fix) && !fix.degraded && fixFresh;
  const fixQuality = !fix ? 'No GPS fix' : stale ? 'Last known fix' : fix.degraded ? 'Approximate GPS' : 'Precise GPS';

  // Redesign: arrival stays locked until a fresh, precise fix AND within 50 m.
  const withinArrival = near || (distance != null && distance <= ARRIVAL_RADIUS_M);
  const canArrive = preciseFix && withinArrival;
  const arrivalReason = !fix
    ? 'Waiting for GPS'
    : stale
      ? 'GPS signal delayed — wait for a fresh fix'
      : fix.degraded
        ? 'Waiting for precise GPS'
        : withinArrival
          ? null
          : distance == null
            ? 'Visit location not set'
            : `${formatDistance(distance)} from the visit — arrive within 50 m to unlock`;

  const overrideCause = !fix
    ? 'GPS is unavailable'
    : stale
      ? 'the GPS signal is delayed'
      : fix.degraded
        ? `GPS is ${formatAccuracy(fix.rawAccuracy || fix.accuracy) || 'imprecise'}`
        : distance != null
          ? `you are ${formatDistance(distance)} from the visit location`
          : 'the arrival location could not be verified';

  const patientName = visit.patient?.full_name || 'Patient';
  const patientAvatar = visit.patient?.avatar_url || null;
  const patientInitials = patientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const patientTo = visit.patient_id ? `/provider/patients/${visit.patient_id}/profile` : null;
  const chatTo = visit.patient_id
    ? `/provider/messages?partner=${visit.patient_id}&name=${encodeURIComponent(patientName)}`
    : null;

  const { Icon: StatusIcon } = statusMeta;

  const patientRow = (
    <div className="mc-provider-row">
      {patientTo ? (
        <Link to={patientTo} title="View Patient Profile" className="shrink-0">
          <div className="mc-avatar">
            {patientAvatar ? <img src={patientAvatar} alt={patientName} /> : patientInitials}
            <span className={`mc-avatar__dot${statusMeta.level === 'good' ? '' : statusMeta.level === 'caution' ? ' is-caution' : ' is-problem'}`} />
          </div>
        </Link>
      ) : (
        <div className="mc-avatar">
          {patientAvatar ? <img src={patientAvatar} alt={patientName} /> : patientInitials}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="mc-kicker">On the way to</p>
        {patientTo ? (
          <Link to={patientTo} className="mc-provider-name block">{patientName}</Link>
        ) : (
          <p className="mc-provider-name">{patientName}</p>
        )}
        <p className="mc-muted truncate">{visit.service || 'Home care visit'}</p>
      </div>

      {chatTo && (
        <Link
          to={chatTo}
          title="Message Patient"
          aria-label={`Message ${patientName}`}
          className="mc-icon-btn"
        >
          <MessageSquare className="w-4 h-4" />
        </Link>
      )}
      <button
        ref={minimizeRef}
        type="button"
        onClick={() => setMinimized(true)}
        title="Collapse live tracking"
        aria-label="Collapse live tracking panel"
        className="mc-icon-btn"
      >
        <Minimize2 className="w-4 h-4" />
      </button>
    </div>
  );

  const statusLine = (
    <span className={`mc-status-line mc-status-line--inline is-${statusMeta.level}`}>
      <span
        className={`mc-status-dot is-${statusMeta.level}${statusMeta.pulse ? ' mc-status-dot--pulse' : ''}`}
        aria-hidden="true"
      >
        <StatusIcon className={statusMeta.spin ? 'animate-spin' : ''} />
      </span>
      <span className="mc-status-line__label" role="status" aria-live="polite">
        {statusMeta.label}
      </span>
      {accuracy && (
        <>
          <span className="mc-status-line__sep" aria-hidden="true">·</span>
          <span className="mc-status-line__meta">{accuracy}</span>
        </>
      )}
      <span className="mc-status-line__sep" aria-hidden="true">·</span>
      <span className="mc-status-line__meta">{freshness}</span>
    </span>
  );

  const etaBlock = (
    <div className="mc-eta-block">
      <div className="mc-eta-copy min-w-0">
        <p className="mc-kicker">Estimated arrival</p>
        <div className="mc-eta-value">{formatDuration(duration)}</div>
        <p className="mc-eta-meta">
          <span>{freshness}</span>
          <span className="mc-dot-sep" aria-hidden="true" />
          <span>{fixQuality}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="mc-kicker">Distance</p>
        <div className="mc-distance-value">{formatDistance(distance)}</div>
      </div>
    </div>
  );

  const primaryAction = withinArrival ? (
    <button
      type="button"
      onClick={() => markArrived()}
      disabled={arriving || !canArrive}
      className="mc-btn mc-btn--success mc-btn--block"
      title={arrivalReason || 'Mark arrived'}
    >
      {arriving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
      {arriving ? 'Marking arrived…' : 'Arrived'}
    </button>
  ) : (
    <a
      href={navUrl || '#'}
      target="_blank"
      rel="noreferrer"
      className={`mc-btn mc-btn--primary mc-btn--block${!navUrl ? ' pointer-events-none opacity-50' : ''}`}
      aria-disabled={!navUrl}
    >
      <MapPinned className="w-4 h-4" />
      Navigate
    </a>
  );

  const secondaryAction = withinArrival ? (
    <a
      href={navUrl || '#'}
      target="_blank"
      rel="noreferrer"
      className={`mc-btn mc-btn--secondary mc-btn--block${!navUrl ? ' pointer-events-none opacity-50' : ''}`}
      aria-disabled={!navUrl}
    >
      <MapPinned className="w-4 h-4" />
      Navigate
    </a>
  ) : (
    <button
      type="button"
      onClick={() => markArrived()}
      disabled={arriving || !canArrive}
      className="mc-btn mc-btn--secondary mc-btn--block"
    >
      <Home className="w-4 h-4" />
      Arrived
    </button>
  );

  const tripDetails = (
    <div className="mc-stack mc-stack--tight">
      <div className="mc-metric-row">
        <MapPin className="w-4 h-4" />
        <span className="truncate">{destination?.address || 'Visit location not confirmed'}</span>
      </div>
      <div className="mc-metric-row">
        <Clock className="w-4 h-4" />
        <span>{freshness}</span>
        <span className="mc-dot-sep" aria-hidden="true" />
        <span>{fixQuality}</span>
      </div>
      <div className="mc-metric-row">
        <Route className="w-4 h-4" />
        <span>{formatDistance(distance)} remaining</span>
      </div>
      {!isNative() && (
        <p className="mc-muted">
          Keep this screen open while traveling. Use the MuntiCares app for background tracking.
        </p>
      )}
    </div>
  );

  const alerts = (
    <>
      {error && (
        <div className="mc-note mc-note--problem" role="alert">
          <AlertTriangle className="w-4 h-4" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="mc-link">
            Retry GPS
          </button>
        </div>
      )}
      {!error && (fix?.degraded || !destination) && (
        <div className="mc-note">
          <AlertTriangle className="w-4 h-4" />
          <span>
            {fix?.degraded
              ? `GPS accuracy is ${formatAccuracy(fix.rawAccuracy || fix.accuracy) || 'low'}. Automatic arrival is locked — confirm on site below if you are at the patient's home.`
              : 'The patient has not confirmed a visit destination yet. Navigation and arrival distance are unavailable.'}
          </span>
        </div>
      )}
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {minimized ? (
        <motion.button
          ref={expandRef}
          key="collapsed-bar"
          type="button"
          onClick={() => setMinimized(false)}
            initial={{ opacity: 0, y: isDesktop ? 0 : 16, x: isDesktop ? 16 : 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: isDesktop ? 0 : 16, x: isDesktop ? 16 : 0 }}
            title="Expand Live Route Tracker"
            aria-label={`${statusMeta.label}. Expand live route tracker.`}
            aria-expanded="false"
            className={`mc-tracker mc-provider-collapsed ${isDesktop ? 'mc-provider-collapsed--desktop' : 'mc-provider-collapsed--mobile'}`}
          >
            <span
              className={`mc-status-dot is-${statusMeta.level}${statusMeta.pulse ? ' mc-status-dot--pulse' : ''}`}
              aria-hidden="true"
            >
              <StatusIcon className={statusMeta.spin ? 'animate-spin' : ''} />
            </span>
            <span className="mc-provider-collapsed__text">
              <span className="mc-provider-collapsed__label" role="status" aria-live="polite">{statusMeta.label}</span>
              <span className="mc-provider-collapsed__value">
                {formatDuration(duration)} · {formatDistance(distance)}
              </span>
            </span>
            <Maximize2 className="w-4 h-4 shrink-0" />
          </motion.button>
        ) : (
          <motion.section
            key="docked-panel"
            initial={{ opacity: 0, y: isDesktop ? 0 : 24, x: isDesktop ? 24 : 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: isDesktop ? 0 : 24, x: isDesktop ? 24 : 0 }}
            className={`mc-tracker mc-provider-dock ${isDesktop ? 'mc-provider-dock--desktop' : 'mc-provider-dock--mobile'}`}
            aria-label="Live route tracker"
          >
            <div className="mc-provider-scroll">
              {patientRow}
              {statusLine}
              <div className="mc-divider" />
              {etaBlock}
  
              <div className="mc-actions">
                {primaryAction}
                {secondaryAction}
                {arrivalReason && (
                  <p className="mc-lock-reason">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {arrivalReason}
                  </p>
                )}
                {withinArrival && !arrivalReason && (
                  <p className="mc-muted">You are within 50 m of the visit location.</p>
                )}
                {!canArrive && destination && (
                  overrideOpen ? (
                    <div className="mc-note" role="alert">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="mc-override__title">Confirm you are at the patient&apos;s home</p>
                        <p className="mc-override__copy">
                          Automatic arrival is locked because {overrideCause}. Your confirmation and
                          reported position are recorded.
                        </p>
                        <div className="mc-override__actions">
                          <button
                            type="button"
                            onClick={() => markArrived({ override: true })}
                            disabled={arriving}
                            className="mc-btn mc-btn--success mc-btn--block"
                          >
                            {arriving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Home className="w-4 h-4" />
                            )}
                            {arriving ? 'Marking arrived…' : 'Yes, I am on site'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideOpen(false)}
                            disabled={arriving}
                            className="mc-btn mc-btn--secondary mc-btn--block"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mc-link mc-override__link"
                      onClick={() => setOverrideOpen(true)}
                    >
                      I am at the patient&apos;s home — mark arrived anyway
                    </button>
                  )
                )}
              </div>
  
              {alerts}
  
            <div className="mc-tabs" role="tablist" aria-label="Tracking panel view" onKeyDown={onTabKeyDown}>
              <button
                ref={mapTabRef}
                type="button"
                role="tab"
                id="provider-tab-map"
                aria-controls="provider-view-map"
                aria-selected={view === 'map'}
                tabIndex={view === 'map' ? 0 : -1}
                className="mc-tab"
                onClick={() => setView('map')}
              >
                Map
              </button>
              <button
                ref={detailsTabRef}
                type="button"
                role="tab"
                id="provider-tab-details"
                aria-controls="provider-view-details"
                aria-selected={view === 'details'}
                tabIndex={view === 'details' ? 0 : -1}
                className="mc-tab"
                onClick={() => setView('details')}
              >
                Trip details
              </button>
            </div>

            <div
              role="tabpanel"
              id={`provider-view-${view}`}
              aria-labelledby={`provider-tab-${view}`}
              className={view === 'map' ? 'mc-provider-map' : undefined}
            >
              {view === 'map' ? (
                <TrackingMap
                  provider={fix}
                  destination={destination}
                  route={route}
                  follow={follow}
                  onToggleFollow={setFollow}
                  compact
                  providerAvatar={providerAvatar}
                  providerName={providerName}
                  stale={stale}
                  waiting={!fix}
                />
              ) : (
                tripDetails
              )}
            </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
