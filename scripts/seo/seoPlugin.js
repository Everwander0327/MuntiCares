import { loadEnv } from 'vite';
import { PUBLIC_PAGES, normalizeSiteUrl } from '../../src/lib/seo/seoConfig.js';
import { buildRobotsTxt, buildSitemapXml, renderIndexHtml } from './seoFiles.js';

/**
 * Fills index.html SEO placeholders and emits robots.txt + sitemap.xml at build.
 * Reads VITE_SITE_URL and VITE_GOOGLE_SITE_VERIFICATION from env / .env files.
 */
export function seoPlugin() {
  let siteUrl = normalizeSiteUrl();
  let googleVerification = '';

  return {
    name: 'munticares-seo',
    configResolved(config) {
      // loadEnv merges .env files with VITE_* vars from process.env (e.g. Vercel env).
      const env = loadEnv(config.mode, config.envDir || process.cwd(), 'VITE_');
      siteUrl = normalizeSiteUrl(env.VITE_SITE_URL);
      googleVerification = env.VITE_GOOGLE_SITE_VERIFICATION || '';
    },
    transformIndexHtml(html) {
      return renderIndexHtml(html, { siteUrl, googleVerification });
    },
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10);
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobotsTxt(siteUrl) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemapXml(siteUrl, PUBLIC_PAGES, lastmod) });
    },
  };
}
