import { describe, it, expect } from 'vitest';
import { canApproveProvider } from './providerEligibility';

const base = {
  id: 'p1',
  is_banned: false,
  is_approved: false,
  is_profile_complete: true,
};

describe('canApproveProvider', () => {
  it('allows a pending provider with a complete profile', () => {
    expect(canApproveProvider(base)).toBe(true);
  });

  it('rejects an incomplete profile', () => {
    expect(canApproveProvider({ ...base, is_profile_complete: false })).toBe(false);
  });

  it('rejects a banned provider', () => {
    expect(canApproveProvider({ ...base, is_banned: true })).toBe(false);
  });

  it('rejects an already-approved provider', () => {
    expect(canApproveProvider({ ...base, is_approved: true })).toBe(false);
  });

  it('rejects a missing provider', () => {
    expect(canApproveProvider(null)).toBe(false);
  });
});
