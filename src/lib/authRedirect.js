import { Capacitor } from '@capacitor/core';
import { normalizeSiteUrl, DEFAULT_SITE_URL } from './seo/seoConfig';

/**
 * Builds the URL Supabase should redirect to after email confirmation or
 * password recovery.
 *
 * The Capacitor Android/iOS shell loads the web app from https://localhost, so
 * window.location.origin is a callback host that does not exist on the device.
 * For native builds we target the production site instead (which Supabase
 * allowlists and which actually serves the confirmation/recovery page); web
 * builds keep their own origin so preview deployments keep working.
 */
export function buildAuthRedirectUrl(path, { origin, siteUrl, isNative } = {}) {
  const normalizedPath = typeof path === 'string' && path.startsWith('/') ? path : `/${path}`;
  const base = isNative ? normalizeSiteUrl(siteUrl) : origin || DEFAULT_SITE_URL;
  return `${base}${normalizedPath}`;
}

/** Resolves the current runtime (native vs web) and returns the redirect URL. */
export function buildAuthRedirect(path) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return buildAuthRedirectUrl(path, {
    origin,
    siteUrl: import.meta.env.VITE_SITE_URL,
    isNative: Capacitor.isNativePlatform(),
  });
}
