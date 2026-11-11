import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_ROUTES } from './lib/config.mjs';
import { revealPage } from './lib/browser.mjs';
import { auditPage } from './lib/audit.mjs';
import { evaluateGates } from './lib/gate.mjs';

// The audit is layout-sensitive (getBoundingClientRect, computed opacity) and jsdom has
// no layout engine, so these run in a real browser.
let browser;
let page;

beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
});

afterAll(async () => {
  await browser?.close();
});

// ---------------------------------------------------------------- C2: scrolling

// The counter is instrumented rather than sampled from requestAnimationFrame: under suite
// load Chrome starves frame callbacks, so a rAF sample set under-counts and the test flakes
// even though revealPage did step the scroll.
const TALL_PAGE = `<!doctype html><html><body style="margin:0">
  <div style="height:4000px"></div>
  <script>
    window.__max = 0;
    window.__steps = 0;
    const nativeScrollBy = window.scrollBy.bind(window);
    window.scrollBy = (x, y) => {
      window.__steps += 1;
      nativeScrollBy(x, y);
      window.__max = Math.max(window.__max, window.scrollY);
    };
  </script>
</body></html>`;

describe('C2 — capture reveals below-fold content before auditing', () => {
  it('scrolls past the first viewport in several steps so whileInView reveals fire', async () => {
    await page.setContent(TALL_PAGE);
    await revealPage(page);
    const measured = await page.evaluate(() => ({
      max: window.__max,
      steps: window.__steps,
      end: window.scrollY,
      docHeight: document.documentElement.scrollHeight,
    }));
    // Reached the bottom of a 4000px page from an 844px viewport.
    expect(measured.max + 844).toBeGreaterThanOrEqual(measured.docHeight - 2);
    // Stepped rather than jumping straight to the end, giving observers time to run.
    expect(measured.steps).toBeGreaterThanOrEqual(3);
    // Left the page at the top so screenshots and audits see the real first screen.
    expect(measured.end).toBe(0);
  });
});

// ------------------------------------------------- C2: hidden-content reporting

async function auditFixture(bodyHtml) {
  await page.setContent(`<!doctype html><html><body>${bodyHtml}</body></html>`);
  return page.evaluate(auditPage, { name: 'fixture', theme: 'light', viewport: '390' });
}

describe('C2 — audit reports laid-out content it cannot see', () => {
  it('counts opacity-0 text as hiddenContent, including opacity inherited from a wrapper', async () => {
    const audit = await auditFixture(`
      <main>
        <h1 style="opacity:1">Visible heading</h1>
        <p style="opacity:0">This sentence is laid out but fully transparent.</p>
        <div style="opacity:0"><p>Nested inside a transparent reveal wrapper.</p></div>
        <p style="opacity:1">This sentence is perfectly readable.</p>
      </main>`);
    const texts = audit.hiddenContent.samples.map((sample) => sample.text).join(' ');
    expect(audit.hiddenContent.count).toBe(2);
    expect(texts).toContain('fully transparent');
    expect(texts).toContain('transparent reveal wrapper');
  });

  it('does not count display:none, empty, or readable nodes as hidden content', async () => {
    const audit = await auditFixture(`
      <main>
        <h1>Heading</h1>
        <p style="display:none">Not laid out at all.</p>
        <p style="opacity:0"></p>
        <p style="opacity:1">Readable.</p>
      </main>`);
    expect(audit.hiddenContent.count).toBe(0);
  });
});

// ------------------------------------------------------- C4: public route cover

function mainLayoutRoutes() {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/App.jsx'), 'utf8');
  const start = source.indexOf('<Route path="/" element={<MainLayout />}>');
  const end = source.indexOf('<Route path="/patient"');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = source.slice(start, end);
  const routes = [];
  if (/<Route\b[^>]*\bindex\b/.test(block)) routes.push('/');
  for (const match of block.matchAll(/\bpath="([^"]+)"/g)) {
    if (match[1] === '/') continue;
    routes.push(`/${match[1].replace(/^\//, '')}`);
  }
  return [...new Set(routes)];
}

describe('C4 — every public route is audited', () => {
  it('PUBLIC_ROUTES covers all MainLayout child routes in App.jsx', () => {
    const declared = mainLayoutRoutes();
    expect(declared).toContain('/privacy');
    expect(declared).toContain('/terms');
    expect(declared).toContain('/reset-password');
    const missing = declared.filter((route) => !PUBLIC_ROUTES.includes(route));
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------- C3/C5: landmark gating

// A fully clean audit; individual tests override only the field under scrutiny.
const cleanAudit = (overrides = {}) => ({
  viewport: '390',
  theme: 'light',
  unlabeled: [],
  tinyText: { total: 0, eyebrows: 0, violationCount: 0, samples: [] },
  smallSentences: { count: 0, samples: [] },
  contrast: { failures: 0, failuresBelow12: 0, samples: [] },
  mainCount: 1,
  nestedMain: 0,
  h1Count: 1,
  images: { count: 0, missingAlt: 0 },
  targets: { smallByClass: { close: 0, icon: 0, pagination: 0 } },
  banned: {},
  rootOverflow: { scrollWidth: 390, clientWidth: 390, xOverflow: false },
  hiddenContent: { count: 0, samples: [] },
  ...overrides,
});

const reportFor = (auditOverrides) => ({
  generatedAt: '2026-11-11T00:00:00.000Z',
  base: 'http://localhost:5173',
  pages: [
    { name: 'login', route: '/login', consoleErrors: [], audits: [cleanAudit(auditOverrides)] },
  ],
});

const gate = (gates, id) => gates.find((entry) => entry.id === id);

describe('C3 — gate 6 counts only h1s that are actually visible', () => {
  it('audit excludes a display:none h1, so a hidden-only heading reads as zero', async () => {
    const hidden = await auditFixture('<main><div style="display:none"><h1>Marketing line</h1></div></main>');
    expect(hidden.h1Count).toBe(0);

    const shown = await auditFixture('<main><h1>Welcome back</h1></main>');
    expect(shown.h1Count).toBe(1);
  });

  it('fails a route with no visible h1', () => {
    const gates = evaluateGates(reportFor({ h1Count: 0 }), null, {});
    expect(gate(gates, 6).status).toBe('FAIL');
  });

  it('passes a route with exactly one visible h1', () => {
    const gates = evaluateGates(reportFor({ h1Count: 1 }), null, {});
    expect(gate(gates, 6).status).toBe('PASS');
  });
});

describe('C5 — nested main landmarks are gated', () => {
  it('audit counts a main rendered inside another main', async () => {
    const nested = await auditFixture('<main><div><main>inner</main></div></main>');
    expect(nested.mainCount).toBe(2);
    expect(nested.nestedMain).toBe(1);

    const flat = await auditFixture('<main><div>content</div></main>');
    expect(flat.mainCount).toBe(1);
    expect(flat.nestedMain).toBe(0);
  });

  it('fails a route that nests main landmarks', () => {
    const gates = evaluateGates(reportFor({ mainCount: 2, nestedMain: 1 }), null, {});
    expect(gate(gates, 12).status).toBe('FAIL');
  });

  it('passes a route with a single main landmark', () => {
    const gates = evaluateGates(reportFor({ mainCount: 1, nestedMain: 0 }), null, {});
    expect(gate(gates, 12).status).toBe('PASS');
  });
});
