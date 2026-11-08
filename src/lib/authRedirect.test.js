import { describe, it, expect } from 'vitest';
import { buildAuthRedirectUrl } from './authRedirect';

describe('buildAuthRedirectUrl', () => {
  it('uses the web origin when not native', () => {
    expect(
      buildAuthRedirectUrl('/login', { origin: 'https://app.example.com', isNative: false })
    ).toBe('https://app.example.com/login');
  });

  it('uses the production site URL instead of the localhost origin when native', () => {
    expect(
      buildAuthRedirectUrl('/reset-password', {
        origin: 'https://localhost',
        siteUrl: 'https://munti-cares.vercel.app',
        isNative: true,
      })
    ).toBe('https://munti-cares.vercel.app/reset-password');
  });

  it('strips a trailing slash from the native site URL', () => {
    expect(
      buildAuthRedirectUrl('/login', {
        origin: 'https://localhost',
        siteUrl: 'https://munti-cares.vercel.app/',
        isNative: true,
      })
    ).toBe('https://munti-cares.vercel.app/login');
  });

  it('falls back to the default site URL when none is provided for native', () => {
    expect(
      buildAuthRedirectUrl('/login', {
        origin: 'https://localhost',
        siteUrl: undefined,
        isNative: true,
      })
    ).toBe('https://munti-cares.vercel.app/login');
  });

  it('normalizes a path without a leading slash', () => {
    expect(
      buildAuthRedirectUrl('login', { origin: 'https://app.example.com', isNative: false })
    ).toBe('https://app.example.com/login');
  });
});
