import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'src');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const rel = (file) => path.relative(ROOT, file).replace(/\\/g, '/');

const linesMatching = (pattern) =>
  walk(SRC).flatMap((file) =>
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((text, index) => ({ where: `${rel(file)}:${index + 1}`, text }))
      .filter((entry) => pattern.test(entry.text))
      .map((entry) => entry.where)
  );

describe('C16 — no banned font is downloaded', () => {
  it('index.html does not request Inter, which DESIGN.md bans', () => {
    expect(read('index.html')).not.toMatch(/family=Inter/);
  });
});

describe('C12 — safe-area insets can resolve', () => {
  it('index.html opts into viewport-fit=cover', () => {
    const meta = read('index.html').match(/<meta name="viewport"[^>]*>/);
    expect(meta).not.toBeNull();
    expect(meta[0]).toMatch(/viewport-fit=cover/);
  });
});

describe('C17 — no zombie utilities in src/', () => {
  it('shadow-xs is gone (Tailwind emits no such class)', () => {
    expect(linesMatching(/\bshadow-xs\b/)).toEqual([]);
  });

  it('backdrop-blur-xs is gone (Tailwind emits no such class)', () => {
    expect(linesMatching(/\bbackdrop-blur-xs\b/)).toEqual([]);
  });
});

describe('C13 — shared overlay primitives use theme-aware surfaces', () => {
  const overlayPrimitives = ['src/shared/ui/sheet.jsx', 'src/shared/ui/dialog.jsx'];

  // Scrims (bg-black/40 dark:bg-black/70) intentionally vary opacity by theme and are
  // not a surface role, so `black` is excluded here.
  it.each(overlayPrimitives)('%s does not pair a light surface with a dark: override', (file) => {
    const paired = read(file)
      .split(/\r?\n/)
      .map((text, index) => ({ where: `${file}:${index + 1}`, text }))
      .filter((entry) => /\bbg-(?:white|slate|gray|zinc|neutral|stone)(?:-\d+)?(?:\/\d+)?\b[^"']*\bdark:bg-/.test(entry.text))
      .map((entry) => entry.where);
    expect(paired).toEqual([]);
  });
});
