import { normalizeSiteUrl, DEFAULT_SITE_URL } from './seo/seoConfig';

export function buildAuthRedirectUrl(path, { origin } = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeSiteUrl(origin || DEFAULT_SITE_URL)}${normalizedPath}`;
}

export function buildAuthRedirect(path) {
  return buildAuthRedirectUrl(path, {
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  });
}
