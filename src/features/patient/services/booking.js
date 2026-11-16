import { supabase } from '@/lib/supabase';
import { slotsOverlap } from '@/lib/localDate';

export async function getProviderBusyBookingSlots({ providerId, date }) {
  const { data, error } = await supabase.rpc('get_provider_busy_booking_slots', {
    p_provider_id: providerId,
    p_date: date,
  });
  if (error) throw error;
  return data || [];
}

export function startBookingAvailabilityRefresh({ providerId, date, onSlots, onError }) {
  let active = true;
  let inFlight = false;
  const refresh = async () => {
    if (!active || inFlight) return;
    inFlight = true;
    try {
      const busySlots = await getProviderBusyBookingSlots({ providerId, date });
      if (active) onSlots(busySlots);
    } catch (error) {
      if (active) onError?.(error);
    } finally {
      inFlight = false;
    }
  };

  void refresh();
  const timer = setInterval(refresh, 15000);
  return () => {
    active = false;
    clearInterval(timer);
  };
}

export function filterAvailableBookingSlots(slots, busySlots, date) {
  return slots
    .filter(slot => !slot.isPast && !busySlots.some(busy =>
      slotsOverlap(date, slot.time, date, busy.time, slot.durationMinutes, busy.duration_minutes || 30)
    ))
    .map(slot => ({ ...slot, available: true }));
}

export function preserveOpenSlotPeriod(currentPeriod, morningSlots, afternoonSlots) {
  const currentSlots = currentPeriod === 'pm' ? afternoonSlots : morningSlots;
  const otherSlots = currentPeriod === 'pm' ? morningSlots : afternoonSlots;
  if (currentSlots.some(slot => slot.available)) return currentPeriod;
  if (otherSlots.some(slot => slot.available)) return currentPeriod === 'pm' ? 'am' : 'pm';
  return currentPeriod;
}

export function shouldClearSelectedBookingSlot(selectedTime, availableSlots, loading) {
  return Boolean(selectedTime && !loading && !availableSlots.some(slot => slot.time === selectedTime));
}

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
  if (error) {
    if (error.code === '23P01') {
      throw new Error('This time slot was just taken. Please choose another time.');
    }
    throw error;
  }
  if (typeof requestId !== 'string' || !requestId) {
    throw new Error('Booking did not return a request ID');
  }
  return requestId;
}
