import { describe, it, expect } from 'vitest';
import { buildRobotsTxt, buildSitemapXml, renderIndexHtml } from './seoFiles.js';
import { PUBLIC_PAGES } from '../../src/lib/seo/seoConfig.js';

const U = 'https://x.app';

describe('buildRobotsTxt', () => {
  it('points to the sitemap and disallows private areas', () => {
    const txt = buildRobotsTxt(U);
    expect(txt).toContain('Sitemap: https://x.app/sitemap.xml');
    expect(txt).toContain('Disallow: /patient\n');
    expect(txt).toContain('Disallow: /patient/');
    expect(txt).toContain('Disallow: /provider\n');
    expect(txt).toContain('Disallow: /provider/');
    expect(txt).toContain('Disallow: /admin\n');
    expect(txt).toContain('Disallow: /admin/');
  });

  it('normalizes a trailing slash', () => {
    expect(buildRobotsTxt('https://x.app/')).toContain('Sitemap: https://x.app/sitemap.xml');
  });
});

describe('buildSitemapXml', () => {
  it('lists exactly the three public pages', () => {
    const xml = buildSitemapXml(U, PUBLIC_PAGES, '2026-11-08');
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(['https://x.app/', 'https://x.app/privacy', 'https://x.app/terms']);
    expect(xml).toContain('<lastmod>2026-11-08</lastmod>');
    expect(xml.startsWith('<?xml')).toBe(true);
  });

  it('never produces a double slash with a trailing-slash site url', () => {
    const xml = buildSitemapXml('https://x.app/', PUBLIC_PAGES, '2026-11-08');
    expect(xml).not.toContain('x.app//');
  });
});

describe('renderIndexHtml', () => {
  const html =
    '<head><link rel="canonical" href="__SITE_URL__/" /><!-- __GOOGLE_SITE_VERIFICATION__ --><meta property="og:image" content="__SITE_URL__/a.png" /></head>';

  it('replaces every site url placeholder', () => {
    const out = renderIndexHtml(html, { siteUrl: 'https://x.app/', googleVerification: '' });
    expect(out).not.toContain('__SITE_URL__');
    expect(out).toContain('href="https://x.app/"');
    expect(out).toContain('content="https://x.app/a.png"');
  });

  it('emits no verification tag when the code is empty', () => {
    const out = renderIndexHtml(html, { siteUrl: U, googleVerification: '' });
    expect(out).not.toContain('google-site-verification');
    expect(out).not.toContain('__GOOGLE_SITE_VERIFICATION__');
  });

  it('emits the verification tag when a code is set', () => {
    const out = renderIndexHtml(html, { siteUrl: U, googleVerification: 'abc' });
    expect(out).toContain('<meta name="google-site-verification" content="abc" />');
  });
});
