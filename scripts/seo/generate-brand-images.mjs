// Generates the SEO logo (512x512) and share image (1200x630) into public/images/brand/.
// Run: node scripts/seo/generate-brand-images.mjs  (uses local Chrome via Playwright)
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'public/images/brand');

const HEART =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';
const mark = (size, radius) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" rx="${radius}" fill="#2563eb"/><g transform="translate(4,4)"><path d="${HEART}" fill="#fff"/></g></svg>`;

const hero = (await readFile(path.join(root, 'public/images/landing/hero-wash.jpg'))).toString('base64');

const logoHtml = `<html><body style="margin:0;background:transparent">${mark(512, 7)}</body></html>`;

const ogHtml = `<html><head><style>
  body{margin:0;width:1200px;height:630px;font-family:'Segoe UI',Arial,sans-serif;color:#fff;
    background:linear-gradient(90deg,rgba(15,23,42,.92) 0%,rgba(15,23,42,.75) 55%,rgba(15,23,42,.35) 100%),
    url(data:image/jpeg;base64,${hero}) center/cover;display:flex;flex-direction:column;justify-content:center;padding:0 88px;box-sizing:border-box}
  .brand{display:flex;align-items:center;gap:24px;font-size:72px;font-weight:800;letter-spacing:-1px}
  h1{font-size:52px;font-weight:700;margin:36px 0 16px;max-width:820px;line-height:1.15}
  p{font-size:28px;margin:0;color:#cbd5e1;max-width:820px}
</style></head><body>
  <div class="brand">${mark(96, 7)}MuntiCares</div>
  <h1>Home Care, Right at Your Doorstep</h1>
  <p>Trusted, verified home care providers for Muntinlupa City residents.</p>
</body></html>`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(logoHtml);
  await page.screenshot({ path: path.join(outDir, 'logo-512.png'), omitBackground: true });

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outDir, 'og-image.png') });
} finally {
  await browser.close();
}
console.log('Wrote logo-512.png and og-image.png to', outDir);
