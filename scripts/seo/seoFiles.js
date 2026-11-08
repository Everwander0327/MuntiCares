import { NOINDEX_PREFIXES, normalizeSiteUrl } from '../../src/lib/seo/seoConfig.js';

/** robots.txt: allow everything public, block logged-in areas, point to the sitemap. */
export function buildRobotsTxt(siteUrl) {
  const base = normalizeSiteUrl(siteUrl);
  return [
    'User-agent: *',
    'Allow: /',
    ...NOINDEX_PREFIXES.flatMap((prefix) => [`Disallow: ${prefix}`, `Disallow: ${prefix}/`]),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

/** sitemap.xml for the given public pages. `lastmod` is YYYY-MM-DD. */
export function buildSitemapXml(siteUrl, pages, lastmod) {
  const base = normalizeSiteUrl(siteUrl);
  const urls = pages
    .map(
      (page) =>
        `  <url>\n    <loc>${base}${page.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Fills index.html placeholders: __SITE_URL__ and the Search Console verification comment. */
export function renderIndexHtml(html, { siteUrl, googleVerification }) {
  const base = normalizeSiteUrl(siteUrl);
  const code = (googleVerification || '').trim();
  const verificationTag = code ? `<meta name="google-site-verification" content="${code}" />` : '';
  return html
    .replaceAll('__SITE_URL__', base)
    .replace('<!-- __GOOGLE_SITE_VERIFICATION__ -->', verificationTag);
}
