import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookVisitWithConsent } from './booking';
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
  it.each(['23505', '23P01', '23514', '42501'])('propagates %s without fallback writes', async code => {
    const error = { code, message: 'Database rejected booking' };
    rpc.mockResolvedValue({ data: null, error });
    await expect(bookVisitWithConsent(input)).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
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
});
