import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import useRouteEta from '../hooks/useRouteEta';
import { subscribeToProvider } from '../services/trackingService';
import { ensureNotificationPermission, notifyTracking } from '../services/trackingNotifications';

const THRESHOLDS = [120, 300, 600];

/**
 * Global patient-side monitor. Watches On The Way visits even when the tracker
 * modal is closed and raises 10/5/2-minute + arrival alerts.
 * Persists notified keys in sessionStorage to survive page reloads.
 */
export default function PatientTrackingMonitor() {
  const { user } = useAuth();
  const [active, setActive] = useState([]);
  const activeRef = useRef([]);
  const arrivedNotified = useRef(new Set());

  useEffect(() => {
    if (user?.role === 'patient') ensureNotificationPermission();
  }, [user?.role]);

  const load = useCallback(async () => {
    if (user?.role !== 'patient' || !user?.id) {
      setActive([]);
      activeRef.current = [];
      return;
    }
    const { data } = await supabase
      .from('requests')
      .select('id, patient_id, provider_id, service, status, dest_lat, dest_lng, dest_address, dest_source, dest_version, provider:provider_id(full_name)')
      .eq('patient_id', user.id)
      .eq('status', 'On The Way')
      .order('route_started_at', { ascending: false, nullsFirst: false });
    activeRef.current = data || [];
    setActive(data || []);
  }, [user?.role, user?.id]);

  useEffect(() => {
    if (user?.role !== 'patient' || !user?.id) return;
    load();

    const channel = supabase
      .channel(`patient-tracking-monitor-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: `patient_id=eq.${user.id}` },
        ({ eventType, new: row, old: oldRow }) => {
          const previous = oldRow?.status
            || activeRef.current.find((r) => r.id === row?.id)?.status;

          if (row?.status === 'Arrived' && previous !== 'Arrived') {
            const key = `arrived:${row.id}`;
            let alreadyNotified = arrivedNotified.current.has(key);
            if (!alreadyNotified) {
              try {
                alreadyNotified = sessionStorage.getItem(`mc_arrived_${row.id}`) === 'true';
              } catch { /* ignore */ }
            }

            if (!alreadyNotified) {
              arrivedNotified.current.add(key);
              try {
                sessionStorage.setItem(`mc_arrived_${row.id}`, 'true');
              } catch { /* ignore */ }

              notifyTracking(
                'Provider has arrived',
                'Your provider is at the visit location. Please be ready to welcome them.',
                { tag: key }
              );
            }
          }

          if (eventType === 'DELETE') {
            const id = oldRow?.id;
            activeRef.current = activeRef.current.filter((r) => r.id !== id);
            setActive(activeRef.current);
            return;
          }
          load();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.role, user?.id, load]);

  if (user?.role !== 'patient' || active.length === 0) return null;

  return active.map((request) => (
    <TrackingAlertWatcher key={request.id} request={request} />
  ));
}

function TrackingAlertWatcher({ request }) {
  const [provider, setProvider] = useState(null);
  const [session, setSession] = useState(null);

  const getPersistedSent = () => {
    try {
      const raw = sessionStorage.getItem(`mc_eta_sent_${request.id}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  };

  const markPersistedSent = (seconds) => {
    try {
      const current = getPersistedSent();
      current.add(seconds);
      sessionStorage.setItem(`mc_eta_sent_${request.id}`, JSON.stringify([...current]));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const unsubscribe = subscribeToProvider(request.id, {
      onLocation: setProvider,
      onSession: setSession,
      onStopped: (ended) => setSession((prev) => ({ ...(prev || {}), ...ended, status: 'ended' })),
    });
    return unsubscribe;
  }, [request.id]);

  const destLat = request.dest_lat;
  const destLng = request.dest_lng;
  const destVersion = request.dest_version || 0;

  const destination = useMemo(() => {
    return destLat != null && destLng != null
      ? { lat: destLat, lng: destLng, version: destVersion }
      : null;
  }, [destLat, destLng, destVersion]);

  const { duration, source } = useRouteEta(
    provider,
    destination,
    destVersion,
    request.id
  );

  useEffect(() => {
    // Skip notifications if duration is missing, fix is degraded, or ETA is based on pure straight-line estimate
    if (!duration || !provider || provider.degraded || source === 'estimate') return;
    if (session?.status !== 'active') return;
    if (provider.timestamp && Date.now() - provider.timestamp > 120000) return;

    const sent = getPersistedSent();
    const threshold = THRESHOLDS.find(
      (seconds) => duration <= seconds && !sent.has(seconds)
    );
    if (!threshold) return;

    const minutes = threshold / 60;
    const providerName = request.provider?.full_name || 'Your provider';
    notifyTracking(
      'Provider arriving soon',
      `${providerName} is about ${minutes} minute${minutes === 1 ? '' : 's'} away for ${request.service}.`,
      { tag: `eta:${request.id}:${threshold}` }
    );

    THRESHOLDS.forEach((seconds) => {
      if (seconds >= threshold) markPersistedSent(seconds);
    });
  }, [duration, source, provider, session?.status, request.id, request.provider?.full_name, request.service]);

  return null;
}
