import fs from 'node:fs';
import path from 'node:path';
import { loadQaEnv, accounts } from './lib/env.mjs';
import { BASE_URL, OUT_DIR } from './lib/config.mjs';
import { ensureDirs, assertAppReachable, launchBrowser, newContext, login } from './lib/browser.mjs';
import { runOverlayProbes } from './lib/overlays.mjs';

// Focused overlay/dialog probe — the same list capture.mjs runs, without the
// full route sweep. Writes overlay-report.json.
loadQaEnv();
await assertAppReachable();
ensureDirs();
const credentials = accounts();
const overlays = [];

const browser = await launchBrowser();
try {
  for (const roleName of Object.keys(credentials)) {
    const context = await newContext(browser, { width: 1440, height: 900 }, 'light');
    const page = await context.newPage();
    await login(page, credentials[roleName]);
    await runOverlayProbes(page, roleName, overlays);
    await context.close();
  }
} finally {
  await browser.close();
  const file = path.join(OUT_DIR, 'overlay-report.json');
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE_URL, overlays }, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), file)} (${overlays.length} overlays)`);
}
