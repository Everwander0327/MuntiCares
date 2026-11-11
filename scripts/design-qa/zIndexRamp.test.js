import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// DESIGN.md section 6: "Z-index is assigned from the documented ramp; ad-hoc z-[9999]-style
// escalation is banned." The ramp lives in the :root block, which DESIGN.md names as a
// source of truth for tokens, and Tailwind re-exposes it as named utilities.
const repoRoot = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const RAMP = ['chrome', 'popover', 'dock', 'shell', 'overlay', 'toast'];

function rampValues() {
  const css = read('src/index.css');
  const found = {};
  for (const match of css.matchAll(/--z-([a-z]+)\s*:\s*(\d+)\s*;/g)) {
    found[match[1]] = Number(match[2]);
  }
  return found;
}

function cssRuleZIndex(selector) {
  const css = read('src/index.css');
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing rule for ${selector}`).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf('}', start));
  return body.match(/z-index:\s*([^;]+);/)?.[1].trim() ?? null;
}

function* sourceFiles(dir = 'src') {
  for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(rel);
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) yield rel;
  }
}

describe('C9 — the page-level overlay ramp is declared once and ordered', () => {
  it('declares every tier in :root', () => {
    const values = rampValues();
    expect(Object.keys(values).sort()).toEqual([...RAMP].sort());
  });

  it('orders chrome < popover < dock < shell < overlay < toast', () => {
    const values = rampValues();
    const ordered = RAMP.map((tier) => values[tier]);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect(new Set(ordered).size).toBe(RAMP.length);
  });

  it('exposes each tier as a named Tailwind utility', () => {
    const config = read('tailwind.config.js');
    for (const tier of RAMP) {
      expect(config, `z-${tier} missing from tailwind.config.js`).toMatch(
        new RegExp(`${tier}:\\s*['"]var\\(--z-${tier}\\)['"]`),
      );
    }
  });
});

// The reported defect: shared dialogs and sheets sit at z-50, below the globally mounted
// provider dock (900) and the patient tracker shell (9999), so ArrivalOverrideDialog
// rendered underneath the dock.
describe('C9 — overlays and tracker layers draw from the ramp', () => {
  it.each([
    ['src/shared/ui/dialog.jsx'],
    ['src/shared/ui/sheet.jsx'],
    ['src/features/tracking/components/VisitDestinationModal.jsx'],
    ['src/shared/components/FhirExportModal.jsx'],
  ])('%s stacks on z-overlay', (rel) => {
    const source = read(rel);
    expect(source).toContain('z-overlay');
    expect(source).not.toMatch(/\bz-50\b/);
  });

  it('puts the tracker shell on the shell tier and the provider dock on the dock tier', () => {
    expect(cssRuleZIndex('.mc-tracker-shell')).toBe('var(--z-shell)');
    expect(cssRuleZIndex('.mc-provider-dock')).toBe('var(--z-dock)');
    expect(cssRuleZIndex('.mc-provider-collapsed')).toBe('var(--z-dock)');
  });

  it('puts the toaster on the toast tier', () => {
    expect(read('src/App.jsx')).toMatch(/zIndex:\s*'var\(--z-toast\)'/);
  });

  // A tier nothing consumes is dead config; chrome and popover are the two the
  // overlay tiers are measured against.
  it('gives the chrome and popover tiers a consumer', () => {
    expect(read('src/shared/navigation/Navbar.jsx')).toContain('z-chrome');
    expect(read('src/shared/navigation/NotificationBell.jsx')).toMatch(/zIndex:\s*'var\(--z-popover\)'/);
  });
});

describe('C9 — no ad-hoc escalation survives', () => {
  it('no z-[N] of 1000 or higher anywhere in src', () => {
    const offenders = [];
    for (const rel of sourceFiles()) {
      for (const match of read(rel).matchAll(/\bz-\[(\d+)\]/g)) {
        if (Number(match[1]) >= 1000) offenders.push(`${rel}: z-[${match[1]}]`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
