import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

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
        .select('*, provider:provider_id(full_name, email)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(req => ({
        id: req.id,
        providerId: req.provider_id,
        provider: req.provider?.full_name || 'Unknown',
        service: req.service,
        date: req.date,
        time: req.time,
        status: req.status,
        price: req.price || '0',
        location: req.provider?.location || 'Unknown',
        originalNotes: req.notes || '',
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

    // subscribe to realtime changes for this patient's requests
    const channel = supabase
      .channel('patient-requests-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `patient_id=eq.${patientId}` }, payload => {
        try {
          // Supabase/v1 payloads use "event" and new/old records; normalize
          const type = payload.event || payload.eventType || (payload.type || '');

          if (type === 'INSERT' || type === 'UPDATE') {
            const newRow = payload.new || payload.record || payload;
            if (!newRow) return;
            // Map incoming row to our formatted shape
            const mapped = {
              id: newRow.id,
              providerId: newRow.provider_id,
              provider: newRow.provider?.full_name || newRow.provider_name || 'Unknown',
              service: newRow.service,
              date: newRow.date,
              time: newRow.time,
              status: newRow.status,
              price: newRow.price || '0',
              location: newRow.provider?.location || 'Unknown',
              originalNotes: newRow.notes || '',
            };

            setRequests(prev => {
              const exists = prev.find(r => r.id === mapped.id);
              if (exists) {
                return prev.map(r => r.id === mapped.id ? { ...r, ...mapped } : r);
              }
              return [mapped, ...prev];
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
