import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { playToastSound } from '../lib/audio';

const LAST_NOTIFIED_STATUS = new Map();

function notifyPatientStatusChange(reqId, prevStatus, nextStatus, providerName) {
  if (!nextStatus || prevStatus === nextStatus) return;
  const key = `${reqId}:${nextStatus}`;
  if (LAST_NOTIFIED_STATUS.get(reqId) === key) return;
  LAST_NOTIFIED_STATUS.set(reqId, key);

  const name = providerName && providerName !== 'Unknown' ? providerName : 'Your provider';
  const toastOpts = { id: `req-status-${reqId}-${nextStatus}`, duration: 5000 };

  if (nextStatus === 'Accepted') {
    playToastSound('success');
    toast.success(`${name} accepted your home care visit!`, toastOpts);
  } else if (nextStatus === 'On The Way') {
    playToastSound('success');
    toast.success(`${name} is now On Route! Tap "Track Live" to follow on the map.`, toastOpts);
  } else if (nextStatus === 'Arrived') {
    playToastSound('success');
    toast.success(`${name} has arrived at your location!`, toastOpts);
  } else if (nextStatus === 'Completed') {
    playToastSound('success');
    toast.success(`Home care visit with ${name} is now completed.`, toastOpts);
  } else if (nextStatus === 'Rejected') {
    playToastSound('error');
    toast.error(`${name} could not accommodate the request.`, toastOpts);
  }
}

// Hook to fetch patient requests joined with provider info and subscribe to realtime updates.
export default function usePatientRequests(patientId) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  const fetchRequests = async () => {
    if (!patientId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Select request rows and include provider user (provider is a user id)
      const { data, error } = await supabase
        .from('requests')
        .select('*, provider:provider_id(full_name, email, avatar_url)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const providerIds = [...new Set((data || []).map(r => r.provider_id).filter(Boolean))];
      const locationMap = {};
      if (providerIds.length > 0) {
        const { data: provRows } = await supabase
          .from('providers')
          .select('user_id, location')
          .in('user_id', providerIds);
        (provRows || []).forEach(p => {
          if (p.location) locationMap[p.user_id] = p.location;
        });
      }

      const formatted = (data || []).map(req => ({
        id: req.id,
        patientId: req.patient_id,
        providerId: req.provider_id,
        provider: req.provider?.full_name || 'Unknown',
        providerAvatarUrl: req.provider?.avatar_url || '',
        service: req.service,
        date: req.date,
        time: req.time,
        status: req.status,
        price: req.price || '0',
        location: locationMap[req.provider_id] || req.provider?.location || 'Muntinlupa City',
        originalNotes: req.notes || '',
        destLat: req.dest_lat ?? null,
        destLng: req.dest_lng ?? null,
        routeStartedAt: req.route_started_at ?? null,
        arrivedAt: req.arrived_at ?? null,
      }));

      setRequests(formatted);
    } catch (err) {
      console.error('usePatientRequests fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!patientId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    fetchRequests();

    // Use a unique channel name per hook instance so AnimatePresence page transitions
    // don't tear down the newly mounted page's subscription.
    const channelName = `patient-requests-${patientId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `patient_id=eq.${patientId}` }, payload => {
        try {
          // Supabase payloads use "eventType" or "event" and new/old records; normalize
          const type = payload.event || payload.eventType || (payload.type || '');

          if (type === 'INSERT' || type === 'UPDATE') {
            const newRow = payload.new || payload.record || payload;
            if (!newRow) return;

            setRequests(prev => {
              const exists = prev.find(r => r.id === newRow.id);
              if (exists) {
                const resolvedProvider =
                  newRow.provider?.full_name ||
                  newRow.provider_name ||
                  (exists.provider && exists.provider !== 'Unknown' ? exists.provider : 'Unknown');

                if (newRow.status && newRow.status !== exists.status) {
                  notifyPatientStatusChange(newRow.id, exists.status, newRow.status, resolvedProvider);
                }

                // Preserve joined provider fields (full_name, avatar_url, location) since
                // Supabase Realtime postgres_changes payloads do not include foreign table joins.
                return prev.map(r => r.id === newRow.id ? {
                  ...r,
                  id: newRow.id,
                  patientId: newRow.patient_id ?? r.patientId,
                  providerId: newRow.provider_id ?? r.providerId,
                  provider: resolvedProvider,
                  providerAvatarUrl: newRow.provider?.avatar_url || r.providerAvatarUrl || '',
                  service: newRow.service ?? r.service,
                  date: newRow.date ?? r.date,
                  time: newRow.time ?? r.time,
                  status: newRow.status ?? r.status,
                  price: newRow.price ?? r.price ?? '0',
                  location: newRow.provider?.location || (r.location && r.location !== 'Unknown' ? r.location : 'Muntinlupa City'),
                  originalNotes: newRow.notes ?? r.originalNotes ?? '',
                  destLat: newRow.dest_lat !== undefined ? newRow.dest_lat : r.destLat,
                  destLng: newRow.dest_lng !== undefined ? newRow.dest_lng : r.destLng,
                  routeStartedAt: newRow.route_started_at !== undefined ? newRow.route_started_at : r.routeStartedAt,
                  arrivedAt: newRow.arrived_at !== undefined ? newRow.arrived_at : r.arrivedAt,
                } : r);
              }
              // New request inserted: refetch so joined provider details are populated
              fetchRequests();
              return prev;
            });
          } else if (type === 'DELETE') {
            const oldRow = payload.old || payload.record || payload;
            if (!oldRow) return;
            setRequests(prev => prev.filter(r => r.id !== oldRow.id));
          } else {
            // Fallback: do a full fetch when unsure
            fetchRequests();
          }
        } catch (err) {
          console.warn('Realtime handler error, falling back to refetch', err);
          fetchRequests();
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [patientId]);

  return { requests, loading, refetch: fetchRequests };
}
