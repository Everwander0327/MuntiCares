import fs from 'node:fs';
import path from 'node:path';
import { loadQaEnv, accounts } from './lib/env.mjs';
import {
  BASE_URL,
  OUT_DIR,
  REPORT_FILE,
  BASELINE_DIR,
  PUBLIC_ROUTES,
  ROLE_ROUTES,
  VIEWPORTS,
  THEMES,
  TARGET_PROBES,
} from './lib/config.mjs';
import {
  ensureDirs,
  assertAppReachable,
  launchBrowser,
  newContext,
  applyTheme,
  watchConsole,
  login,
  screenshot,
  slug,
} from './lib/browser.mjs';
import { auditPage } from './lib/audit.mjs';
import { runOverlayProbes } from './lib/overlays.mjs';
import { evaluateGates, printGateTable, gatesExitCode, readBaseline, summarizeForBaseline } from './lib/gate.mjs';

const argv = new Set(process.argv.slice(2));
const isGate = argv.has('--gate');
const saveBaseline = argv.has('--save-baseline');
const skipPublic = argv.has('--skip-public');
const skipOverlays = argv.has('--no-overlays');

loadQaEnv();
await assertAppReachable();
ensureDirs();

const credentials = accounts();
const result = {
  generatedAt: new Date().toISOString(),
  base: BASE_URL,
  viewports: VIEWPORTS.map((viewport) => viewport.name),
  themes: THEMES,
  pages: [],
  targetProbes: [],
  overlays: [],
  login: {},
};

const collector = { errors: [] };

const localDate = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

async function captureRoute(page, name, route) {
  collector.errors.length = 0;
  let navError = null;
  try {
    await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2400);
  } catch (error) {
    navError = String(error).slice(0, 200);
  }
  const shots = [];

  await applyTheme(page, 'light');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  shots.push(await screenshot(page, name, 'desktop-light'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  shots.push(await screenshot(page, name, 'mobile-light'));

  const audits = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(300);
    audits.push(await page.evaluate(auditPage, { name, theme: 'light', viewport: viewport.name }));
  }

  await applyTheme(page, 'dark');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  shots.push(await screenshot(page, name, 'desktop-dark'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  shots.push(await screenshot(page, name, 'mobile-dark'));

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(300);
    audits.push(await page.evaluate(auditPage, { name, theme: 'dark', viewport: viewport.name }));
  }

  await applyTheme(page, 'light');
  await page.setViewportSize({ width: 1440, height: 900 });

  const entry = {
    name,
    route,
    finalPath: audits[0]?.route,
    navError,
    shots,
    consoleErrors: [...new Set(collector.errors)].slice(0, 8),
    audits,
  };
  result.pages.push(entry);
  const worst = audits.reduce(
    (worstSoFar, audit) => ({
      tiny: Math.max(worstSoFar.tiny, audit.tinyText.violationCount),
      sentences: Math.max(worstSoFar.sentences, audit.smallSentences.count),
      contrast: Math.max(worstSoFar.contrast, audit.contrast.failures),
    }),
    { tiny: 0, sentences: 0, contrast: 0 }
  );
  console.log(
    `captured ${name} -> ${entry.finalPath}${navError ? ' (nav error)' : ''} | worst tiny=${worst.tiny} sentences=${worst.sentences} contrast=${worst.contrast} | console=${entry.consoleErrors.length}`
  );
}

async function measureTargetProbes(page, roleName) {
  for (const probe of TARGET_PROBES.filter((item) => item.role === roleName)) {
    const record = { id: probe.id, role: roleName, route: probe.route, items: [], status: 'skipped' };
    try {
      await page.goto(BASE_URL + probe.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      if (probe.prepare) await probe.prepare(page);
      const items = await page.evaluate(
        ({ selector, textRegex }) => {
          const visible = (el) => {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          let els = [...document.querySelectorAll(selector)].filter(visible);
          if (textRegex) {
            const re = new RegExp(textRegex);
            els = els.filter((el) => re.test((el.textContent || '').trim()));
          }
          return els.slice(0, 40).map((el) => {
            const r = el.getBoundingClientRect();
            return {
              w: Math.round(r.width),
              h: Math.round(r.height),
              text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
            };
          });
        },
        { selector: probe.selector, textRegex: probe.textRegex || null }
      );
      record.items = items;
      record.status = items.length > 0 ? 'measured' : 'skipped';
      if (items.length === 0) record.skipReason = 'no matching control rendered';
    } catch (error) {
      record.skipReason = String(error).slice(0, 150);
    }
    result.targetProbes.push(record);
    const small = record.items.filter((item) => item.w < 44 || item.h < 44).length;
    console.log(`targets ${probe.id}: ${record.status} (${record.items.length} measured, ${small} under 44px)`);
  }
}

async function discoverPatientDetailRoute(page) {
  await page.goto(`${BASE_URL}/patient/providers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const card = page.getByRole('button', { name: /view (profile|details)/i }).first();
  if (!(await card.count())) return null;
  await card.click();
  await page.waitForTimeout(1600);
  const fullProfile = page.getByText('View Full Profile', { exact: true }).first();
  if (!(await fullProfile.count())) return null;
  await fullProfile.click();
  await page.waitForTimeout(2400);
  const pathname = new URL(page.url()).pathname;
  return /^\/patient\/providers\/[^/]+\/profile/.test(pathname) ? pathname : null;
}

async function discoverProviderDetailRoute(page) {
  await page.goto(`${BASE_URL}/provider/patients`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const profileButton = page.getByRole('button', { name: /^profile$/i }).first();
  if (!(await profileButton.count())) return null;
  await profileButton.click();
  await page.waitForTimeout(2400);
  const pathname = new URL(page.url()).pathname;
  return /^\/provider\/patients\/[^/]+\/profile/.test(pathname) ? pathname : null;
}

const browser = await launchBrowser();

try {
  if (!skipPublic) {
    const context = await newContext(browser, { width: 1440, height: 900 }, 'light');
    const page = await context.newPage();
    watchConsole(page, collector.errors);
    for (const route of PUBLIC_ROUTES) {
      await captureRoute(page, `public-${slug(route)}`, route);
    }
    await measureTargetProbes(page, 'public');
    await context.close();
  }

  for (const [roleName, routes] of Object.entries(ROLE_ROUTES)) {
    const context = await newContext(browser, { width: 1440, height: 900 }, 'light');
    const page = await context.newPage();
    watchConsole(page, collector.errors);
    try {
      await login(page, credentials[roleName]);
      result.login[roleName] = { ok: true, finalPath: new URL(page.url()).pathname };
    } catch (error) {
      result.login[roleName] = { ok: false, error: String(error).slice(0, 300) };
      console.log(`LOGIN FAILED ${roleName}: ${String(error).slice(0, 200)}`);
      await captureRoute(page, `${roleName}-login`, '/login');
      await context.close();
      continue;
    }

    const allRoutes = [...routes];
    if (roleName === 'patient') {
      const href = await discoverPatientDetailRoute(page);
      if (href) allRoutes.splice(1, 0, href);
    }
    if (roleName === 'provider') {
      const href = await discoverProviderDetailRoute(page);
      if (href) allRoutes.splice(2, 0, href);
    }

    for (const route of allRoutes) {
      await captureRoute(page, `${roleName}-${slug(route)}`, route);
    }
    await measureTargetProbes(page, roleName);
    if (!skipOverlays) await runOverlayProbes(page, roleName, result.overlays);
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(REPORT_FILE, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${path.relative(process.cwd(), REPORT_FILE)} (${result.pages.length} pages, ${result.overlays.length} overlays)`);
}

let exitCode = 0;
if (isGate) {
  const baseline = readBaseline(BASELINE_DIR);
  const gates = evaluateGates(result, baseline);
  printGateTable(gates);
  fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), JSON.stringify({ generatedAt: new Date().toISOString(), gates }, null, 2));
  if (saveBaseline) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    const date = localDate();
    const file = path.join(BASELINE_DIR, `baseline-${date}.json`);
    fs.writeFileSync(file, JSON.stringify(summarizeForBaseline(result, gates), null, 2));
    console.log(`Saved baseline ${path.relative(process.cwd(), file)}`);
  }
  exitCode = gatesExitCode(gates);
} else if (saveBaseline) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const date = localDate();
  const file = path.join(BASELINE_DIR, `baseline-${date}.json`);
  fs.writeFileSync(file, JSON.stringify(summarizeForBaseline(result, []), null, 2));
  console.log(`Saved baseline ${path.relative(process.cwd(), file)}`);
}

process.exitCode = exitCode;
