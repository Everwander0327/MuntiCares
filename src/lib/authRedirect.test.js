import { describe, it, expect } from 'vitest';
import { buildAuthRedirectUrl } from './authRedirect';
describe('browser auth redirects', () => {
  it('keeps the current website origin', () => {
    expect(buildAuthRedirectUrl('/login', { origin: 'https://preview.example.com' })).toBe('https://preview.example.com/login');
  });
  it('normalizes trailing and leading slashes', () => {
    expect(buildAuthRedirectUrl('reset-password', { origin: 'https://example.com/' })).toBe('https://example.com/reset-password');
  });
  it('uses the production fallback without a browser origin', () => {
    expect(buildAuthRedirectUrl('/login')).toBe('https://munti-cares.vercel.app/login');
  });
});
