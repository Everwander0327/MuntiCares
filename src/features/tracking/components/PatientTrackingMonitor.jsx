import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import useRouteEta from '../hooks/useRouteEta';
import { subscribeToProvider } from '../services/trackingService';
import { ensureNotificationPermission, notifyTracking } from '../services/trackingNotifications';

const THRESHOLDS = [120, 300, 600];

/**
 * Global patient-side monitor. Watches On The Way visits even when the tracker
 * modal is closed and raises 10/5/2-minute + arrival alerts.
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
            if (!arrivedNotified.current.has(key)) {
              arrivedNotified.current.add(key);
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
  const sent = useRef(new Set());

  useEffect(() => {
    const unsubscribe = subscribeToProvider(request.id, {
      onLocation: setProvider,
      onSession: setSession,
      onStopped: (ended) => setSession((prev) => ({ ...(prev || {}), ...ended, status: 'ended' })),
    });
    return unsubscribe;
  }, [request.id]);

  const destination = request.dest_lat != null && request.dest_lng != null
    ? {
        lat: request.dest_lat,
        lng: request.dest_lng,
        version: request.dest_version || 0,
      }
    : null;

  const { duration } = useRouteEta(provider, destination, destination?.version || 0);

  useEffect(() => {
    if (!duration || !provider || provider.degraded) return;
    if (session?.status !== 'active') return;
    if (provider.timestamp && Date.now() - provider.timestamp > 120000) return;

    const threshold = THRESHOLDS.find(
      (seconds) => duration <= seconds && !sent.current.has(seconds)
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
      if (seconds >= threshold) sent.current.add(seconds);
    });
  }, [duration, provider, session?.status, request.id, request.provider?.full_name, request.service]);

  return null;
}
