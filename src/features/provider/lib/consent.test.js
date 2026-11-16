import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchConsentGrant } from './consent';
const { query } = vi.hoisted(() => ({ query: { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() } }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => query } }));
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
});
describe('verified consent grants', () => {
  it.each([
    null,
    { is_enabled: false, expires_at: null },
    { is_enabled: true, expires_at: '2000-01-01' },
    { is_enabled: true, expires_at: 'invalid' },
    { is_enabled: true },
  ])('denies absent, disabled, expired or unverifiable grant %j', async data => {
    query.maybeSingle.mockResolvedValue({ data });
    expect(await fetchConsentGrant('patient', 'provider')).toBeNull();
  });
  it.each([null, '2099-01-01'])('accepts explicit permissions with expiry %s', async expires_at => {
    query.maybeSingle.mockResolvedValue({ data: { is_enabled: true, expires_at,
      permissions: { medical_history: true, documents: false } } });
    expect(await fetchConsentGrant('patient', 'provider')).toEqual({ is_enabled: true,
      permissions: { medical_history: true, documents: false, visit_notes: false } });
  });
  it('does not convert missing or string permissions into opt-ins', async () => {
    query.maybeSingle.mockResolvedValue({ data: { is_enabled: true, expires_at: null,
      permissions: { documents: 'true' } } });
    expect((await fetchConsentGrant('patient', 'provider')).permissions).toEqual({
      medical_history: false, documents: false, visit_notes: false });
  });
  it('fails closed on a missing expiry column without a compatibility retry', async () => {
    const error = { code: '42703' };
    query.maybeSingle.mockResolvedValue({ error });
    await expect(fetchConsentGrant('patient', 'provider')).rejects.toEqual(error);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });
});
