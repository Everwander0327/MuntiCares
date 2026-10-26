import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  X,
  Navigation,
  Clock,
  MessageSquare,
  MapPin,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import TrackingMap from './TrackingMap';
import VisitDestinationModal from './VisitDestinationModal';
import useRouteEta from '../hooks/useRouteEta';
import { subscribeToProvider, updateTrackingDestination } from '../services/trackingService';
import { ensurePatientCoords } from '../services/geocoding';
import { formatDistance, formatDuration } from '../services/geo';
import { parseFullVisitAddress } from '../services/addressFormat';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useFocusTrap from '@/hooks/useFocusTrap';
import useMediaQuery from '@/hooks/useMediaQuery';
import { getTrackingStatus, formatAccuracy, formatFreshness } from './trackingStatus';

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
  const [follow, setFollow] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [initialDist, setInitialDist] = useState(null);
  const [providerMeta, setProviderMeta] = useState(null);
  // Redesign: desktop panel state + mobile sheet snap state (presentation only)
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileSheet, setMobileSheet] = useState('half');
  const [dragging, setDragging] = useState(false);
  const [dragHeight, setDragHeight] = useState(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const mapApiRef = useRef(null);
  const sheetRef = useRef(null);
  const railRef = useRef(null);
  const panelToggleRef = useRef(null);
  const restorePanelFocus = useRef(false);
  const dragRef = useRef({ active: false, startY: 0, startH: 0, moved: false });
  const blockHandleClick = useRef(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const wasDesktopRef = useRef(isDesktop);

  useBodyScrollLock(isOpen);
  useFocusTrap(isOpen, dialogRef, closeRef, destinationModalOpen);

  // Keep keyboard focus inside the dialog when the desktop panel collapses.
  useEffect(() => {
    if (!isDesktop) return;
    if (panelOpen && restorePanelFocus.current) {
      restorePanelFocus.current = false;
      panelToggleRef.current?.focus({ preventScroll: true });
    } else if (!panelOpen) {
      railRef.current?.focus({ preventScroll: true });
    }
  }, [panelOpen, isDesktop]);

  // A desktop→mobile resize removes the panel that may hold focus.
  useEffect(() => {
    if (wasDesktopRef.current && !isDesktop && !destinationModalOpen) {
      closeRef.current?.focus({ preventScroll: true });
    }
    wasDesktopRef.current = isDesktop;
  }, [isDesktop, destinationModalOpen]);

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
    setFollow(true);
    setDestinationModalOpen(false);
    setPanelOpen(true);
    setMobileSheet('half');
    setDragHeight(null);
    setDragging(false);
  }, [isOpen, request?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  // Redesign: Esc closes, F toggles follow, +/- zoom the shared map.
  useEffect(() => {
    if (!isOpen || destinationModalOpen) return undefined;
    const onKey = (event) => {
      const target = event.target;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key === 'f' || event.key === 'F') {
        setFollow((current) => !current);
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        mapApiRef.current?.zoomIn();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        mapApiRef.current?.zoomOut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, destinationModalOpen, onClose]);

  const ageS = provider?.timestamp ? Math.max(0, Math.round((now - provider.timestamp) / 1000)) : null;
  const sessionAgeS = session?.lastSeenAt ? Math.max(0, Math.round((now - session.lastSeenAt) / 1000)) : null;
  const sessionLive = session?.status === 'active'
    && (sessionAgeS == null || sessionAgeS < SESSION_STALE_AFTER_S);
  const fixFresh = ageS != null && ageS < STALE_AFTER_S;
  const live = Boolean(provider) && fixFresh && (sessionLive || !session);
  const approximate = Boolean(live && provider?.degraded);
  const stale = Boolean(provider) && !fixFresh;
  const stationary = Boolean(provider) && !fixFresh && sessionLive;
  const arrived = status === 'Arrived' || status === 'Completed';
  const eta = duration != null ? new Date(Date.now() + duration * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  const routeReady = Array.isArray(route) && route.length > 1;
  const etaApproximate = Boolean(eta) && !routeReady && !arrived;
  const statusMeta = getTrackingStatus({ arrived, approximate, live, stationary, session, provider });
  const freshness = formatFreshness(ageS);
  const accuracyText = arrived ? null : formatAccuracy(provider?.accuracy);

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
  const service = request?.service || 'Home care visit';
  const sessionPaused = Boolean(!arrived && session && session.status !== 'active');
  const destinationAddress = destination?.address || (destination ? 'Pinned visit location' : 'Visit location not confirmed');
  const etaValue = arrived ? 'On site' : formatDuration(duration);
  const etaSub = arrived
    ? 'Provider is at the visit location'
    : eta
      ? `${etaApproximate ? 'Approx. arrival' : 'Arrives'} ${eta}`
      : 'Calculating route…';
  const distanceText = arrived
    ? 'At your location'
    : distance != null
      ? `${formatDistance(distance)} away`
      : 'Distance pending';

  const initials = (providerName || 'PR')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const chatTo = `/patient/messages?provider=${providerId}&name=${encodeURIComponent(providerName)}`;
  const providerTo = providerId ? `/patient/providers/${providerId}/profile` : null;

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

  const snapHeights = () => {
    const viewport = typeof window !== 'undefined' ? window.innerHeight : 800;
    const compact = viewport < 560;
    const safeTop = dragRef.current.safeTop || 0;
    return {
      collapsed: 208,
      half: compact ? viewport * 0.8 : viewport * 0.56,
      full: viewport - (compact ? 56 : 76) - safeTop,
    };
  };

  const cycleSheet = () => {
    setMobileSheet((current) => {
      if (current === 'collapsed') return 'half';
      if (current === 'half') return 'full';
      return 'collapsed';
    });
  };

  const onGrabPointerDown = (event) => {
    if (isDesktop) return;
    const element = sheetRef.current;
    if (!element) return;
    const safeTop = parseFloat(getComputedStyle(element).getPropertyValue('--trk-safe-top')) || 0;
    dragRef.current = {
      active: true,
      startY: event.clientY,
      startH: element.getBoundingClientRect().height,
      moved: false,
      safeTop,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onGrabPointerMove = (event) => {
    if (!dragRef.current.active) return;
    const delta = dragRef.current.startY - event.clientY;
    if (Math.abs(delta) > 4) dragRef.current.moved = true;
    const snaps = snapHeights();
    const next = Math.max(snaps.collapsed, Math.min(snaps.full, dragRef.current.startH + delta));
    setDragHeight(next);
  };

  const finishDrag = (event, allowCycle) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    blockHandleClick.current = dragRef.current.moved;
    if (!dragRef.current.moved) {
      setDragHeight(null);
      if (allowCycle) cycleSheet();
      return;
    }
    const snaps = snapHeights();
    const currentH = sheetRef.current?.getBoundingClientRect().height ?? 0;
    const nearest = Object.entries(snaps).reduce((best, entry) => (
      Math.abs(entry[1] - currentH) < Math.abs(best[1] - currentH) ? entry : best
    ));
    setMobileSheet(nearest[0]);
    setDragHeight(null);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch { /* pointer already released */ }
  };

  const handleGrabClick = () => {
    if (blockHandleClick.current) {
      blockHandleClick.current = false;
      return;
    }
    cycleSheet();
  };

  const statusLine = (inline = false) => (
    <StatusLine meta={statusMeta} accuracy={accuracyText} freshness={freshness} inline={inline} />
  );

  const providerSummary = (
    <ProviderSummary
      providerName={providerName}
      avatarUrl={avatarUrl}
      initials={initials}
      service={service}
      online={arrived || (live && !approximate) || stationary}
      caution={approximate || stale || sessionPaused}
      chatTo={chatTo}
      providerTo={providerTo}
      onNavigate={onClose}
    />
  );

  const journeyProgress = (
    <JourneyProgress progressPct={progressPct} arrived={arrived} />
  );

  const warnings = (
    <>
      {approximate && !arrived && (
        <div className="mc-note">
          <AlertTriangle className="w-4 h-4" />
          <span>
            GPS accuracy is low{accuracyText ? ` (about ${accuracyText})` : ''}. The map will refine automatically as the signal improves.
          </span>
        </div>
      )}
      {!destination && canEditDestination && (
        <div className="mc-note">
          <MapPin className="w-4 h-4" />
          <span className="flex-1">Set the visit location for an exact road ETA.</span>
          <button type="button" onClick={() => setDestinationModalOpen(true)} className="mc-link">
            Set
          </button>
        </div>
      )}
      {sessionPaused && (
        <div className="mc-note">
          <AlertTriangle className="w-4 h-4" />
          <span>Live sharing is paused. The provider&apos;s app will resume it automatically when connected.</span>
        </div>
      )}
      {connectionError && !arrived && (
        <div className="mc-note mc-note--problem" role="alert">
          <AlertTriangle className="w-4 h-4" />
          <span>{connectionError}</span>
        </div>
      )}
    </>
  );

  const destinationRow = (
    <DestinationRow
      address={destinationAddress}
      canEdit={canEditDestination}
      hasDestination={Boolean(destination)}
      onChange={() => setDestinationModalOpen(true)}
    />
  );

  const details = (
    <>
      <div className="mc-divider" />
      <div className="mc-metric-row">
        <Clock className="w-4 h-4" />
        <span>{freshness}</span>
        <span className="mc-dot-sep" />
        <span>{sessionLive ? 'Live sharing active' : sessionPaused ? 'Sharing paused' : 'Waiting for session'}</span>
      </div>
      {providerTo && (
        <Link to={providerTo} onClick={onClose} className="mc-link">
          View {providerName}&apos;s profile
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Live provider tracking"
              className="mc-tracker mc-tracker-shell"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className={`mc-map-pane${!isDesktop ? ` mc-map-pane--sheet-${mobileSheet}` : ''}`}>
                <TrackingMap
                  ref={mapApiRef}
                  provider={provider}
                  destination={destination}
                  route={route}
                  follow={follow}
                  onToggleFollow={setFollow}
                  providerAvatar={avatarUrl}
                  providerName={providerName}
                  stale={stale}
                  waiting={!provider && !arrived}
                  controlsAlign={isDesktop ? 'center' : 'top'}
                />
                <p className="sr-only">
                  Live map showing the provider travelling to the confirmed visit location.
                </p>

                {/* Redesign: one status line, one close button, no status chip */}
                <div className="mc-map-hud">
                  {statusLine()}
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    title="Close tracker"
                    aria-label="Close live tracker"
                    className="mc-icon-btn mc-icon-btn--spacer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isDesktop ? (
                <>
                  {panelOpen && (
                    <motion.aside
                      className="mc-side-panel"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      aria-label="Live visit details"
                    >
                      <div className="mc-panel-head">
                        <div className="min-w-0 flex-1">
                          <p className="mc-kicker">Live visit</p>
                          <h2 id="live-tracker-title" className="mc-title truncate">{providerName}</h2>
                        </div>
                        <button
                          ref={panelToggleRef}
                          type="button"
                          onClick={() => setPanelOpen(false)}
                          className="mc-icon-btn"
                          title="Collapse details panel"
                          aria-label="Collapse live visit details"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mc-panel-scroll">
                        <div className="mc-stack mc-stack--tight">
                          {statusLine(true)}
                          {providerSummary}
                        </div>

                        <EtaSummary
                          arrived={arrived}
                          etaValue={etaValue}
                          etaSub={etaSub}
                          distanceText={distanceText}
                          freshness={freshness}
                        />
                        {journeyProgress}
                        {warnings}
                        {destinationRow}
                        {details}

                        <p className="mc-muted">
                          Keyboard: <strong>F</strong> follow · <strong>+/−</strong> zoom · <strong>Esc</strong> close
                        </p>
                      </div>
                    </motion.aside>
                  )}

                  {!panelOpen && (
                    <button
                      ref={railRef}
                      type="button"
                      onClick={() => {
                        restorePanelFocus.current = true;
                        setPanelOpen(true);
                      }}
                      className="mc-panel-rail"
                      title="Open live visit details"
                      aria-label="Open live visit details"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>Live visit</span>
                    </button>
                  )}
                </>
              ) : (
                <section
                  ref={sheetRef}
                  id="live-tracker-sheet"
                  className={`mc-sheet mc-sheet--${mobileSheet}${dragging ? ' is-dragging' : ''}`}
                  style={dragHeight != null ? { height: `${dragHeight}px` } : undefined}
                  aria-label="Live visit details"
                >
                  <button
                    type="button"
                    className="mc-sheet-grab"
                    aria-label={mobileSheet === 'collapsed' ? 'Expand live visit details' : 'Collapse or expand live visit details'}
                    aria-expanded={mobileSheet !== 'collapsed'}
                    aria-controls="live-tracker-sheet"
                    onPointerDown={onGrabPointerDown}
                    onPointerMove={onGrabPointerMove}
                    onPointerUp={(event) => finishDrag(event, false)}
                    onPointerCancel={(event) => finishDrag(event, false)}
                    onClick={handleGrabClick}
                  >
                    <span />
                  </button>

                  <div className="mc-sheet-body">
                    {mobileSheet === 'collapsed' ? (
                      <>
                        {statusLine(true)}
                        <EtaSummary
                          arrived={arrived}
                          etaValue={etaValue}
                          etaSub={etaSub}
                          distanceText={distanceText}
                          freshness={freshness}
                          action={(
                            <Link to={chatTo} onClick={onClose} className="mc-btn mc-btn--primary mc-btn--sm">
                              <MessageSquare className="w-4 h-4" />
                              Chat
                            </Link>
                          )}
                        />
                      </>
                    ) : (
                      <>
                        <div className="mc-stack mc-stack--tight">
                          {statusLine(true)}
                          <h2 id="live-tracker-title" className="sr-only">{providerName}</h2>
                          {providerSummary}
                        </div>
                        <EtaSummary
                          arrived={arrived}
                          etaValue={etaValue}
                          etaSub={etaSub}
                          distanceText={distanceText}
                          freshness={freshness}
                        />
                        {journeyProgress}
                        {warnings}
                        {destinationRow}
                        {mobileSheet === 'full' && details}
                      </>
                    )}
                  </div>
                </section>
              )}
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
    </MotionConfig>
  );
}

function StatusLine({ meta, accuracy, freshness, inline = false }) {
  const { Icon } = meta;
  return (
    <span className={`mc-status-line${inline ? ' mc-status-line--inline' : ''} is-${meta.level}`}>
      <span
        className={`mc-status-dot is-${meta.level}${meta.pulse ? ' mc-status-dot--pulse' : ''}`}
        aria-hidden="true"
      >
        <Icon className={meta.spin ? 'animate-spin' : ''} />
      </span>
      <span
        className="mc-status-line__label"
        role={inline ? undefined : 'status'}
        aria-live={inline ? undefined : 'polite'}
      >
        {meta.label}
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
}

function ProviderSummary({
  providerName,
  avatarUrl,
  initials,
  service,
  online,
  caution,
  chatTo,
  providerTo,
  onNavigate,
}) {
  const avatar = (
    <div className="mc-avatar">
      {avatarUrl ? <img src={avatarUrl} alt={providerName} /> : initials}
      <span className={`mc-avatar__dot${online ? '' : caution ? ' is-caution' : ' is-problem'}`} />
    </div>
  );

  return (
    <div className="mc-provider-row">
      {providerTo ? (
        <Link to={providerTo} onClick={onNavigate} title="View provider profile" className="shrink-0">
          {avatar}
        </Link>
      ) : avatar}

      <div className="min-w-0 flex-1">
        <p className="mc-kicker">Your provider</p>
        {providerTo ? (
          <Link to={providerTo} onClick={onNavigate} className="mc-provider-name block">
            {providerName}
          </Link>
        ) : (
          <p className="mc-provider-name">{providerName}</p>
        )}
        <p className="mc-muted truncate">{service}</p>
      </div>

      <Link to={chatTo} onClick={onNavigate} className="mc-btn mc-btn--secondary mc-btn--sm shrink-0">
        <MessageSquare className="w-4 h-4" />
        Chat
      </Link>
    </div>
  );
}

function EtaSummary({ arrived, etaValue, etaSub, distanceText, freshness, action }) {
  return (
    <div className="mc-eta-block">
      <div className="mc-eta-copy min-w-0">
        <p className="mc-kicker">{arrived ? 'Visit status' : 'Estimated arrival'}</p>
        <div className={`mc-eta-value${arrived ? ' mc-eta-value--text' : ''}`}>{etaValue}</div>
        <p className="mc-eta-meta">
          <span>{etaSub}</span>
          <span className="mc-dot-sep" aria-hidden="true" />
          <span>{distanceText}</span>
          <span className="mc-dot-sep" aria-hidden="true" />
          <span>{freshness}</span>
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function JourneyProgress({ progressPct, arrived }) {
  return (
    <div className="mc-stack mc-stack--tight">
      <div className="mc-progress-labels">
        <span className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5" />
          On route
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          {arrived ? 'On site' : 'Visit'}
        </span>
      </div>
      <div
        className="mc-progress"
        role="progressbar"
        aria-label="Provider journey progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
      >
        <div
          className={`mc-progress__fill${arrived ? ' is-arrived' : ''}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

function DestinationRow({ address, canEdit, hasDestination, onChange }) {
  const parsed = parseFullVisitAddress(address);
  const displayTitle = parsed.baseAddress || address;
  const gateNotes = parsed.instructions;

  return (
    <div className="mc-stack mc-stack--tight p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="mc-kicker text-3xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Delivering care to
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={onChange} className="mc-link text-2xs font-extrabold shrink-0">
            {hasDestination ? 'Adjust' : 'Set location'}
          </button>
        )}
      </div>

      <div className="flex items-start gap-2.5">
        <span className="mc-avatar shrink-0 mt-0.5" aria-hidden="true">
          <MapPin className="w-4 h-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mc-title text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {displayTitle}
          </p>
          {gateNotes && (
            <p className="mt-1 text-3xs font-medium text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
              <strong className="font-extrabold text-primary dark:text-[#8CBDF0]">Gate / Arrival:</strong> {gateNotes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
