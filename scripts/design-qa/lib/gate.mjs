import fs from 'node:fs';
import path from 'node:path';
import { GATE_THRESHOLDS } from './config.mjs';

const SRC_DIR = path.resolve('src');

const BANNED_SOURCE = [
  { id: 'h-screen', pattern: /\bh-screen\b/ },
  { id: 'text-4xs', pattern: /\btext-4xs\b/ },
  { id: 'shadow-xs', pattern: /\bshadow-xs\b/ },
  { id: 'z-index-escalation', pattern: /z-\[9\d*\]/ },
  { id: 'pure-black-hex', pattern: /#000(?![0-9a-fA-F])/ },
  {
    id: 'purple-classes',
    pattern: /\b(?:text|bg|border|ring|from|via|to|divide)-(?:purple|violet|fuchsia|indigo)(?:-\d{2,3})?\b/,
  },
  { id: 'ui-avatars', pattern: /ui-avatars\.com/ },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(target);
  }
  return out;
}

export function scanSource(root = SRC_DIR) {
  const hits = Object.fromEntries(BANNED_SOURCE.map((entry) => [entry.id, []]));
  for (const file of walk(root)) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const entry of BANNED_SOURCE) {
        if (entry.pattern.test(line)) {
          hits[entry.id].push({
            file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
            line: index + 1,
            text: line.trim().slice(0, 120),
          });
        }
      }
    });
  }
  return hits;
}

function flattenAudits(report) {
  const entries = [];
  for (const page of report.pages) {
    for (const audit of page.audits) {
      entries.push({ page: page.name, route: page.route, consoleErrors: page.consoleErrors || [], audit });
    }
  }
  return entries;
}

export function evaluateGates(report, baseline, sourceHits = scanSource()) {
  const entries = flattenAudits(report);
  const gates = [];
  const add = (id, name, threshold, failures, measured, note) => {
    gates.push({
      id,
      name,
      threshold,
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      measured,
      failureCount: failures.length,
      failures: failures.slice(0, 8),
      note,
    });
  };

  // 1 — unlabeled form controls
  {
    const failures = entries
      .filter(({ audit }) => audit.unlabeled.length > 0)
      .map(
        ({ route, audit }) =>
          `${route} @${audit.viewport} ${audit.theme}: ${audit.unlabeled.length} unlabeled (${audit.unlabeled
            .map((u) => u.type)
            .slice(0, 4)
            .join(', ')})`
      );
    const measured = entries.reduce((sum, { audit }) => sum + audit.unlabeled.length, 0);
    add(1, 'Unlabeled form controls', '0 on every route', failures, measured);
  }

  // 2 — overlay dialog semantics + focus behaviour
  {
    const failures = [];
    let reached = 0;
    let compliant = 0;
    for (const overlay of report.overlays || []) {
      if (overlay.status !== 'measured') {
        failures.push(`${overlay.id}: overlay not reached (${overlay.skipReason || 'unknown'})`);
        continue;
      }
      reached += 1;
      const missing = [];
      if (!(overlay.dialogCount >= 1)) missing.push('role=dialog');
      if (overlay.ariaModal !== 'true') missing.push('aria-modal');
      if (!overlay.hasAccessibleName) missing.push('accessible name');
      if (!overlay.focusInsideDialog) missing.push('focus-inside');
      if (!overlay.escapeCloses) missing.push('escape-closes');
      if (!overlay.focusReturnedToTrigger) missing.push('focus-return');
      if (!overlay.closeButtonAccessibleName) missing.push('close-name');
      if (missing.length) failures.push(`${overlay.id}: ${missing.join(', ')}`);
      else compliant += 1;
    }
    add(
      2,
      'Overlays with dialog semantics + focus trap',
      '100%',
      failures,
      `${compliant}/${(report.overlays || []).length} compliant (${reached} reached)`
    );
  }

  // 3 — tiny text
  {
    const failures = entries
      .filter(({ audit }) => audit.tinyText.violationCount > 0)
      .sort((a, b) => b.audit.tinyText.violationCount - a.audit.tinyText.violationCount)
      .map(({ route, audit }) => {
        const sample = audit.tinyText.samples[0];
        return `${route} @${audit.viewport} ${audit.theme}: ${audit.tinyText.violationCount} (<12px non-eyebrow) e.g. ${sample ? `${sample.px}px "${sample.text.slice(0, 30)}"` : ''}`;
      });
    const measured = entries.reduce((sum, { audit }) => sum + audit.tinyText.violationCount, 0);
    add(3, `Text nodes < ${GATE_THRESHOLDS.minTextPx}px (non-eyebrow)`, '0', failures, measured);
  }

  // 4 — body sentences below 14px
  {
    const failures = entries
      .filter(({ audit }) => audit.smallSentences.count > 0)
      .sort((a, b) => b.audit.smallSentences.count - a.audit.smallSentences.count)
      .map(({ route, audit }) => `${route} @${audit.viewport} ${audit.theme}: ${audit.smallSentences.count} sentences <14px`);
    const measured = entries.reduce((sum, { audit }) => sum + audit.smallSentences.count, 0);
    add(4, `Explanatory sentences < ${GATE_THRESHOLDS.minSentencePx}px`, '0', failures, measured);
  }

  // 5 — contrast
  {
    const failures = entries
      .filter(({ audit }) => audit.contrast.failures > 0)
      .sort((a, b) => b.audit.contrast.failures - a.audit.contrast.failures)
      .map(({ route, audit }) => {
        const sample = audit.contrast.samples[0];
        return `${route} @${audit.viewport} ${audit.theme}: ${audit.contrast.failures} e.g. ${sample ? `${sample.ratio}:1 "${sample.text.slice(0, 30)}"` : ''}`;
      });
    const measured = entries.reduce((sum, { audit }) => sum + audit.contrast.failures, 0);
    add(5, 'Contrast failures at >=12px (photo/gradient excluded)', '0', failures, measured);
  }

  // 6 — exactly one h1
  {
    const failures = entries
      .filter(({ audit }) => audit.h1Count !== GATE_THRESHOLDS.h1Count)
      .map(({ route, audit }) => `${route} @${audit.viewport} ${audit.theme}: h1=${audit.h1Count}`);
    add(6, 'h1 count per route', 'exactly 1', failures, failures.length ? failures[0] : 'exactly 1 everywhere');
  }

  // 7 — images without alt
  {
    const failures = entries
      .filter(({ audit }) => audit.images.missingAlt > 0)
      .map(({ route, audit }) => `${route} @${audit.viewport} ${audit.theme}: ${audit.images.missingAlt} img without alt`);
    const measured = entries.reduce((sum, { audit }) => sum + audit.images.missingAlt, 0);
    add(7, 'Images without alt', '0', failures, measured);
  }

  // 8 — hit targets on listed controls
  {
    const failures = [];
    for (const probe of report.targetProbes || []) {
      if (probe.status !== 'measured') continue;
      const small = probe.items.filter((item) => item.w < GATE_THRESHOLDS.minTargetPx || item.h < GATE_THRESHOLDS.minTargetPx);
      if (small.length) {
        failures.push(
          `${probe.id}: ${small.length}/${probe.items.length} under 44px e.g. ${small[0].w}x${small[0].h} "${(small[0].text || '').slice(0, 24)}"`
        );
      }
    }
    for (const overlay of report.overlays || []) {
      const size = overlay.closeButtonSize;
      if (overlay.status === 'measured' && size && (size.w < 44 || size.h < 44)) {
        failures.push(`${overlay.id}: close button ${size.w}x${size.h}`);
      }
    }
    const smallAudit = entries.filter(
      ({ audit }) =>
        audit.targets.smallByClass.close + audit.targets.smallByClass.icon + audit.targets.smallByClass.pagination > 0
    );
    for (const { route, audit } of smallAudit.slice(0, 8)) {
      const { close, icon, pagination } = audit.targets.smallByClass;
      failures.push(`${route} @${audit.viewport} ${audit.theme}: close=${close} icon=${icon} pagination=${pagination} under 44px`);
    }
    if (smallAudit.length > 8) failures.push(`...and ${smallAudit.length - 8} more route/viewport combinations`);
    add(8, 'Hit targets < 44px on listed controls', '0', failures, `${failures.length} failing probes/audits`);
  }

  // 9 — banned patterns (source + rendered DOM)
  {
    const failures = [];
    let measured = 0;
    for (const [id, hits] of Object.entries(sourceHits)) {
      measured += hits.length;
      if (hits.length) {
        failures.push(`src: ${id} x${hits.length} e.g. ${hits[0].file}:${hits[0].line}`);
      }
    }
    const domKeys = ['hScreen', 'text4xs', 'shadowXs', 'zIndexEscalation', 'purpleClasses', 'uiAvatars', 'pureBlackComputed'];
    const domTotals = Object.fromEntries(domKeys.map((key) => [key, 0]));
    for (const { audit } of entries) {
      for (const key of domKeys) domTotals[key] += audit.banned[key] || 0;
    }
    for (const key of domKeys) {
      measured += domTotals[key];
      if (domTotals[key] > 0) failures.push(`dom: ${key} x${domTotals[key]}`);
    }
    add(9, 'Banned patterns (h-screen, text-4xs, shadow-xs, z-[9…], #000, purple, ui-avatars)', '0', failures, measured);
  }

  // 10 — console/page errors vs baseline
  {
    const baselineByPage = new Map((baseline?.routes || []).map((route) => [route.page, route.consoleErrors]));
    const failures = [];
    for (const page of report.pages) {
      const current = (page.consoleErrors || []).length;
      if (!baselineByPage.has(page.name)) continue;
      const base = baselineByPage.get(page.name);
      if (current > base) failures.push(`${page.route}: ${current} errors (baseline ${base}) e.g. ${(page.consoleErrors[0] || '').slice(0, 80)}`);
    }
    const measured = report.pages.reduce((sum, page) => sum + (page.consoleErrors || []).length, 0);
    add(10, 'Console/page errors on route load', '0 new vs baseline', failures, baseline ? measured : `${measured} (baseline run)`);
  }

  // 11 — horizontal overflow
  {
    const failures = entries
      .filter(({ audit }) => audit.rootOverflow.xOverflow)
      .map(({ route, audit }) => `${route} @${audit.viewport} ${audit.theme}: scrollWidth ${audit.rootOverflow.scrollWidth} > ${audit.rootOverflow.clientWidth}`);
    add(11, 'Horizontal overflow', '0', failures, failures.length);
  }

  return gates;
}

export function summarizeForBaseline(report, gates) {
  return {
    generatedAt: report.generatedAt,
    base: report.base,
    routes: report.pages.map((page) => ({
      name: page.name,
      route: page.route,
      consoleErrors: (page.consoleErrors || []).length,
      consoleSamples: (page.consoleErrors || []).slice(0, 3),
    })),
    gates: gates.map((gate) => ({
      id: gate.id,
      status: gate.status,
      measured: gate.measured,
      failureCount: gate.failureCount,
    })),
  };
}

export function printGateTable(gates) {
  const rows = gates.map((gate) => [
    String(gate.id),
    gate.name,
    gate.threshold,
    gate.status,
    String(gate.measured),
  ]);
  const header = ['#', 'Gate', 'Threshold', 'Status', 'Measured'];
  const widths = header.map((cell, index) => Math.max(cell.length, ...rows.map((row) => row[index].length)));
  const line = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join('  ');
  console.log('');
  console.log(line(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) console.log(line(row));
  console.log('');
  for (const gate of gates) {
    if (gate.status === 'FAIL' && gate.failures.length) {
      console.log(`FAIL #${gate.id} ${gate.name}`);
      for (const failure of gate.failures) console.log(`  - ${failure}`);
      if (gate.failureCount > gate.failures.length) console.log(`  ... ${gate.failureCount - gate.failures.length} more`);
    }
  }
}

export function gatesExitCode(gates) {
  return gates.some((gate) => gate.status === 'FAIL') ? 1 : 0;
}

export function readBaseline(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => /^baseline-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort();
  if (files.length === 0) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'));
  } catch {
    return null;
  }
}
