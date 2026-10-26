import fs from 'node:fs';
import path from 'node:path';
import { loadQaEnv } from './lib/env.mjs';
import { BASE_URL, OUT_DIR } from './lib/config.mjs';
import { ensureDirs, assertAppReachable, launchBrowser, newContext } from './lib/browser.mjs';

// landing-page scroll verification: Framer's whileInView never fires during a
// single-shot full-page capture, so walk the page first, then shoot.
loadQaEnv();
await assertAppReachable();
ensureDirs();
const report = { generatedAt: new Date().toISOString(), base: BASE_URL, pages: [] };

const browser = await launchBrowser();
try {
  const context = await newContext(browser, { width: 1440, height: 900 }, 'light');
  const page = await context.newPage();
  for (const [route, name] of [
    ['/', 'landing'],
    ['/login', 'login'],
    ['/register', 'register'],
    ['/onboarding', 'onboarding'],
  ]) {
    await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((value) => window.scrollTo(0, value), y);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, 'shots', `scrolled-${name}--desktop.png`), fullPage: true, timeout: 30000 });
    const sections = await page.evaluate(() =>
      [...document.querySelectorAll('section,footer')].map((section) => ({
        id: section.id || null,
        cls: String(section.className).slice(0, 60),
        height: Math.round(section.getBoundingClientRect().height),
        opacity: getComputedStyle(section).opacity,
        text: (section.innerText || '').trim().slice(0, 40),
      }))
    );
    report.pages.push({ name, route, sections });
    console.log(name, JSON.stringify(sections));
  }
  await context.close();
} finally {
  await browser.close();
  const file = path.join(OUT_DIR, 'scroll-report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
}
