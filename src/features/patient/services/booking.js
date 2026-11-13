import { supabase } from '@/lib/supabase';

// Success requires the server to save both the request and consent.
export async function bookVisitWithConsent({ providerId, values, durationMinutes, destination }) {
  const { data: requestId, error } = await supabase.rpc('book_visit_with_consent', {
    p_provider_id: providerId,
    p_service: values.service,
    p_duration_minutes: durationMinutes,
    p_date: values.date,
    p_time: values.time + ':00',
    p_notes: values.notes || null,
    p_dest_lat: destination.lat,
    p_dest_lng: destination.lng,
    p_dest_address: destination.address || null,
  });
  if (error) throw error;
  if (typeof requestId !== 'string' || !requestId) {
    throw new Error('Booking did not return a request ID');
  }
  return requestId;
}
