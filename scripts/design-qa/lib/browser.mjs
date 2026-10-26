import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, OUT_DIR, SHOTS_DIR } from './config.mjs';

export function ensureDirs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

export async function assertAppReachable() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    console.error(`Cannot reach ${BASE_URL} — start the dev server (npm run dev) before running the design QA harness.`);
    console.error(String(error).slice(0, 200));
    process.exit(1);
  }
}

export function launchBrowser() {
  return chromium.launch({ channel: 'chrome', headless: true });
}

export async function newContext(browser, viewport, theme = 'light') {
  const context = await browser.newContext({
    viewport,
    ignoreHTTPSErrors: true,
    colorScheme: theme,
  });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(30000);
  await context.addInitScript((mode) => {
    try {
      localStorage.setItem('mc_cookie_consent', 'accepted');
      localStorage.setItem('mc_theme', mode);
    } catch {
      /* storage unavailable */
    }
  }, theme);
  return context;
}

export async function applyTheme(page, theme) {
  await page.evaluate((mode) => {
    try {
      localStorage.setItem('mc_theme', mode);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, theme);
  await page.waitForTimeout(350);
}

export function watchConsole(page, sink) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push(msg.text().slice(0, 240));
  });
  page.on('pageerror', (err) => sink.push(`PAGEERROR ${String(err).slice(0, 240)}`));
}

export async function login(page, account) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  const email = page.locator('input[type="email"]').first();
  await email.waitFor({ state: 'visible', timeout: 15000 });
  await email.fill(account.email);
  await page.locator('input[type="password"]').first().fill(account.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25000 });
  await page.waitForTimeout(1500);
}

export async function screenshot(page, name, suffix, fullPage = true) {
  const file = path.join(SHOTS_DIR, `${name}--${suffix}.png`);
  await page.screenshot({ path: file, fullPage, timeout: 20000, animations: 'disabled' });
  return path.relative(OUT_DIR, file).replace(/\\/g, '/');
}

export const slug = (route) =>
  route === '/' ? 'landing' : route.replace(/^\//, '').replace(/[/:]+/g, '-').replace(/-+$/, '');
