import fs from 'node:fs';
import path from 'node:path';
import { loadQaEnv, accounts } from './lib/env.mjs';
import { BASE_URL, OUT_DIR } from './lib/config.mjs';
import { ensureDirs, assertAppReachable, launchBrowser, newContext, login, screenshot, applyTheme } from './lib/browser.mjs';
import { auditPage } from './lib/audit.mjs';

// Focused capture for the routes that are not part of the main role sweep's
// static list: public pages and the two detail routes reached through the UI.
loadQaEnv();
await assertAppReachable();
ensureDirs();
const credentials = accounts();
const results = [];

const browser = await launchBrowser();

async function snap(page, name) {
  const shots = [];
  await applyTheme(page, 'light');
  for (const [width, height, suffix] of [
    [1440, 900, 'desktop-light'],
    [390, 844, 'mobile-light'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(500);
    shots.push(await screenshot(page, name, suffix));
    results.push(await page.evaluate(auditPage, { name, theme: 'light', viewport: String(width) }));
  }
  console.log(`captured ${name} -> ${new URL(page.url()).pathname}`);
  return shots;
}

try {
  {
    const context = await newContext(browser, { width: 1440, height: 900 }, 'light');
    const page = await context.newPage();
    for (const [name, route] of [
      ['public-landing', '/'],
      ['public-login', '/login'],
      ['public-register', '/register'],
    ]) {
      await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1600);
      if (route === '/') {
        const height = await page.evaluate(() => document.body.scrollHeight);
        for (let y = 0; y < height; y += 600) {
          await page.evaluate((v) => window.scrollTo(0, v), y);
          await page.waitForTimeout(120);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(700);
      }
      await snap(page, name);
    }
    await context.close();
  }

  {
    const context = await newContext(browser, { width: 1440, height: 900 }, 'light');
    const page = await context.newPage();
    await login(page, credentials.patient);
    await page.goto(`${BASE_URL}/patient/providers`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const card = page.getByRole('button', { name: /view (profile|details)/i }).first();
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(1800);
      const fullProfile = page.getByText('View Full Profile', { exact: true }).first();
      if (await fullProfile.count()) {
        await fullProfile.click();
        await page.waitForTimeout(2200);
        if (/\/patient\/providers\/[^/]+\/profile/.test(page.url())) {
          await snap(page, 'patient-provider-detail');
        } else {
          console.log(`provider detail not reached, url=${page.url()}`);
        }
      }
    } else {
      console.log('no provider card trigger found');
    }
    await context.close();
  }

  {
    const context = await newContext(browser, { width: 1440, height: 900 }, 'light');
    const page = await context.newPage();
    await login(page, credentials.provider);
    await page.goto(`${BASE_URL}/provider/patients`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const profile = page.getByRole('button', { name: /^profile$/i }).first();
    if (await profile.count()) {
      await profile.click();
      await page.waitForTimeout(2400);
      if (/\/provider\/patients\/[^/]+\/profile/.test(page.url())) {
        await snap(page, 'provider-patient-detail');
      } else {
        console.log(`patient detail not reached, url=${page.url()}`);
      }
    } else {
      console.log('no patient profile trigger found');
    }
    await context.close();
  }
} finally {
  await browser.close();
  const file = path.join(OUT_DIR, 'gap-report.json');
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE_URL, results }, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), file)} (${results.length} audits)`);
}
