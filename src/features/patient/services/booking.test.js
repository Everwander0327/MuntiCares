import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bookVisitWithConsent,
  getProviderBusyBookingSlots,
  filterAvailableBookingSlots,
  startBookingAvailabilityRefresh,
  preserveOpenSlotPeriod,
  shouldClearSelectedBookingSlot,
} from './booking';
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }));
const input = {
  providerId: '33333333-3333-4333-8333-333333333333',
  values: { service: 'Nursing', date: '2030-01-15', time: '09:00', notes: 'Ring bell' },
  durationMinutes: 60,
  destination: { lat: 14.4, lng: 121, address: 'Home' },
};
describe('atomic booking client', () => {
  beforeEach(() => vi.resetAllMocks());
  it('sends one RPC with destination and returns the saved request ID without direct writes', async () => {
    rpc.mockResolvedValue({ data: '44444444-4444-4444-8444-444444444444', error: null });
    await expect(bookVisitWithConsent(input)).resolves.toBe('44444444-4444-4444-8444-444444444444');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('book_visit_with_consent', {
      p_provider_id: '33333333-3333-4333-8333-333333333333',
      p_service: 'Nursing', p_duration_minutes: 60,
      p_date: '2030-01-15', p_time: '09:00:00', p_notes: 'Ring bell',
      p_dest_lat: 14.4, p_dest_lng: 121, p_dest_address: 'Home',
    });
    expect(from).not.toHaveBeenCalled();
  });
  it.each(['23505', '23514', '42501'])('propagates %s without fallback writes', async code => {
    const error = { code, message: 'Database rejected booking' };
    rpc.mockResolvedValue({ data: null, error });
    await expect(bookVisitWithConsent(input)).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });
  it('turns a database slot overlap into a patient-friendly message', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23P01', message: 'exclusion constraint violation' } });
    await expect(bookVisitWithConsent(input)).rejects.toThrow('This time slot was just taken. Please choose another time.');
  });
  it.each([null, '', undefined])('rejects a successful response without a request ID (%s)', async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(bookVisitWithConsent(input)).rejects.toThrow('Booking did not return a request ID');
    expect(from).not.toHaveBeenCalled();
  });
  it('sends explicit nulls for optional notes and destination address', async () => {
    rpc.mockResolvedValue({ data: '44444444-4444-4444-8444-444444444444', error: null });
    await bookVisitWithConsent({ ...input, values: { ...input.values, notes: undefined },
      destination: { lat: 14.4, lng: 121 } });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_notes: null, p_dest_address: null });
  });
  it('reads only busy slot time and duration for the requested provider and date', async () => {
    const busySlots = [{ time: '09:00:00', duration_minutes: 60 }];
    rpc.mockResolvedValue({ data: busySlots, error: null });
    await expect(getProviderBusyBookingSlots({ providerId: input.providerId, date: input.values.date }))
      .resolves.toEqual(busySlots);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_provider_busy_booking_slots', {
      p_provider_id: input.providerId,
      p_date: input.values.date,
    });
    expect(from).not.toHaveBeenCalled();
  });
  it('propagates availability lookup errors so the page can retain its last result', async () => {
    const error = { code: '42501', message: 'Availability unavailable' };
    rpc.mockResolvedValue({ data: null, error });
    await expect(getProviderBusyBookingSlots({ providerId: input.providerId, date: input.values.date }))
      .rejects.toBe(error);
  });
  it('omits past slots and slots overlapping another active booking', () => {
    const slots = [
      { time: '09:00', durationMinutes: 30, isPast: false },
      { time: '09:30', durationMinutes: 30, isPast: false },
      { time: '10:00', durationMinutes: 30, isPast: true },
      { time: '10:30', durationMinutes: 30, isPast: false },
    ];
    const busySlots = [{ time: '09:15:00', duration_minutes: 60 }];
    expect(filterAvailableBookingSlots(slots, busySlots, '2030-01-15')).toEqual([
      { time: '10:30', durationMinutes: 30, isPast: false, available: true },
    ]);
  });
  it('refreshes availability every 15 seconds and stops when cancelled', async () => {
    vi.useFakeTimers();
    rpc.mockResolvedValue({ data: [], error: null });
    const onSlots = vi.fn();
    const stop = startBookingAvailabilityRefresh({
      providerId: input.providerId,
      date: input.values.date,
      onSlots,
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(onSlots).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(15000);
      expect(onSlots).toHaveBeenCalledTimes(2);
      stop();
      await vi.advanceTimersByTimeAsync(30000);
      expect(onSlots).toHaveBeenCalledTimes(2);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });
  it('ignores an in-flight availability response after the booking context closes', async () => {
    vi.useFakeTimers();
    let resolveRpc;
    rpc.mockImplementation(() => new Promise(resolve => { resolveRpc = resolve; }));
    const onSlots = vi.fn();
    const stop = startBookingAvailabilityRefresh({
      providerId: input.providerId,
      date: input.values.date,
      onSlots,
    });
    try {
      stop();
      resolveRpc({ data: [{ time: '09:00:00', duration_minutes: 60 }], error: null });
      await Promise.resolve();
      await Promise.resolve();
      expect(onSlots).not.toHaveBeenCalled();
    } finally {
      stop();
      vi.useRealTimers();
    }
  });
  it('keeps the selected period when it still has open slots after refresh', () => {
    const morningSlots = [{ available: true }];
    const afternoonSlots = [{ available: true }];
    expect(preserveOpenSlotPeriod('pm', morningSlots, afternoonSlots)).toBe('pm');
  });
  it('moves to the other period only when the current period becomes full', () => {
    expect(preserveOpenSlotPeriod('pm', [{ available: true }], [{ available: false }])).toBe('am');
    expect(preserveOpenSlotPeriod('am', [{ available: false }], [{ available: true }])).toBe('pm');
  });
  it('clears a selected booking slot only after availability has loaded and it is no longer listed', () => {
    const openSlots = [{ time: '09:00' }];
    expect(shouldClearSelectedBookingSlot('09:00', openSlots, true)).toBe(false);
    expect(shouldClearSelectedBookingSlot('09:00', openSlots, false)).toBe(false);
    expect(shouldClearSelectedBookingSlot('09:00', [], false)).toBe(true);
  });
});
