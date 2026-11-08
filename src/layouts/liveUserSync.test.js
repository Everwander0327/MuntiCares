import { describe, it, expect } from 'vitest';
import { liveUserRowToAction } from './liveUserSync';

describe('liveUserRowToAction', () => {
  it('flags a sign-out when the row is banned', () => {
    expect(liveUserRowToAction({ is_banned: true, full_name: 'A', avatar_url: 'a.png' }).signOut).toBe(true);
  });

  it('does not sign out for a normal row and maps profile fields', () => {
    const action = liveUserRowToAction({ is_banned: false, full_name: 'Ana', avatar_url: 'av.png' });
    expect(action.signOut).toBe(false);
    expect(action.fullName).toBe('Ana');
    expect(action.avatarUrl).toBe('av.png');
  });

  it('treats a missing row as a non-ban', () => {
    const action = liveUserRowToAction(null);
    expect(action.signOut).toBe(false);
    expect(action.fullName).toBeNull();
    expect(action.avatarUrl).toBeNull();
  });
});
