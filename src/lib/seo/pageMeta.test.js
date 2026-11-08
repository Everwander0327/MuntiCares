import { describe, it, expect } from 'vitest';
import { getPageMeta } from './pageMeta';
import { DEFAULT_SITE_URL, normalizeSiteUrl } from './seoConfig';

const U = 'https://munti-cares.vercel.app';

describe('getPageMeta', () => {
  it('indexes the home page with a root canonical and brand title', () => {
    const meta = getPageMeta('/', U);
    expect(meta.canonical).toBe(`${U}/`);
    expect(meta.robots).toBe('index, follow');
    expect(meta.title).toContain('MuntiCares');
  });

  it('strips a trailing slash from public page canonicals', () => {
    const meta = getPageMeta('/privacy/', U);
    expect(meta.canonical).toBe(`${U}/privacy`);
    expect(meta.robots).toBe('index, follow');
  });

  it('gives terms its own title', () => {
    expect(getPageMeta('/terms', U).title).not.toBe(getPageMeta('/', U).title);
    expect(getPageMeta('/terms', U).title).toContain('MuntiCares');
  });

  it.each(['/login', '/register', '/reset-password', '/onboarding', '/patient/dashboard', '/provider', '/admin', '/admin/requests'])(
    'noindexes private/auth route %s',
    (path) => {
      expect(getPageMeta(path, U).robots).toBe('noindex, nofollow');
    },
  );

  it('noindexes unknown paths', () => {
    expect(getPageMeta('/does-not-exist', U).robots).toBe('noindex, nofollow');
  });
});

describe('normalizeSiteUrl', () => {
  it('strips a trailing slash', () => {
    expect(normalizeSiteUrl('https://x.app/')).toBe('https://x.app');
  });

  it('falls back to the default when empty', () => {
    expect(normalizeSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(normalizeSiteUrl('  ')).toBe(DEFAULT_SITE_URL);
  });
});
