// Single source of truth for SEO data. Plain JS (no import.meta.env, no aliases)
// so both the browser bundle and vite.config.js can import it.

export const DEFAULT_SITE_URL = 'https://munti-cares.vercel.app';
export const SITE_NAME = 'MuntiCares';
export const SITE_ALTERNATE_NAME = 'Munti Cares';

export const HOME_TITLE = 'MuntiCares — Home Care, Right at Your Doorstep';
export const HOME_DESCRIPTION =
  'MuntiCares — Connecting Muntinlupa City residents with trusted, verified home care providers. Fast, secure, and patient-first.';

// Pages search engines may index. Everything else is noindex.
export const PUBLIC_PAGES = [
  { path: '/', title: HOME_TITLE, description: HOME_DESCRIPTION },
  {
    path: '/privacy',
    title: 'Privacy Policy | MuntiCares',
    description: 'How MuntiCares collects, uses, and protects the personal and health information of patients and providers.',
  },
  {
    path: '/terms',
    title: 'Terms of Service | MuntiCares',
    description: 'The terms that govern using MuntiCares to book and provide home care services in Muntinlupa City.',
  },
];

// Route prefixes behind login; also disallowed in robots.txt.
export const NOINDEX_PREFIXES = ['/patient', '/provider', '/admin'];

/** Returns the site URL without a trailing slash, falling back to the default. */
export function normalizeSiteUrl(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  return (trimmed || DEFAULT_SITE_URL).replace(/\/+$/, '');
}
