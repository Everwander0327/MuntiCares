import { describe, it, expect } from 'vitest';
import { buildAuthUser } from './authProfile';

const authUser = {
  id: 'u1',
  email: 'a@b.com',
  user_metadata: { full_name: 'Meta Name', avatar_url: 'meta.png' },
};

describe('buildAuthUser', () => {
  it('leaves role unknown when the profile fetch failed', () => {
    const user = buildAuthUser(authUser, null, true);
    expect(user.role).toBeNull();
    expect(user.id).toBe('u1');
    expect(user.full_name).toBe('Meta Name');
  });

  it('uses the database role on success', () => {
    const user = buildAuthUser(
      authUser,
      { role: 'provider', full_name: 'Dr A', avatar_url: 'a.png', is_banned: false },
      false
    );
    expect(user.role).toBe('provider');
  });

  it('falls back to patient only for a real row with no role', () => {
    expect(buildAuthUser(authUser, { role: null, full_name: 'X' }, false).role).toBe('patient');
  });

  it('does not synthesize a patient when the profile row is missing', () => {
    expect(buildAuthUser(authUser, null, false).role).toBeNull();
  });

  it('prefers profile fields over metadata', () => {
    const user = buildAuthUser(
      authUser,
      { role: 'admin', full_name: 'Admin', avatar_url: 'av.png' },
      false
    );
    expect(user.full_name).toBe('Admin');
    expect(user.avatar_url).toBe('av.png');
  });
});
