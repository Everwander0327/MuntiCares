import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(import.meta.dirname, '..');
const TRACKING = path.join(SRC, 'features', 'tracking');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const rel = (file) => path.relative(SRC, file).replace(/\\/g, '/');

describe('single map library', () => {
  it('imports no leaflet module or stylesheet anywhere in src/', () => {
    const offenders = walk(SRC)
      .filter((file) => /from ['"](?:react-)?leaflet|import ['"]leaflet\/dist/.test(fs.readFileSync(file, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('does not export the unrendered LocationPicker from the tracking barrel', () => {
    const barrel = fs.readFileSync(path.join(TRACKING, 'components', 'index.js'), 'utf8');
    expect(barrel).not.toMatch(/(?<!Modern)LocationPicker/);
  });

  it('has no LocationPicker.jsx module left behind', () => {
    expect(fs.existsSync(path.join(TRACKING, 'components', 'LocationPicker.jsx'))).toBe(false);
  });

  it('keeps no dead .leaflet-* selector rules in src/ stylesheets', () => {
    const offenders = walk(SRC)
      .filter((file) => file.endsWith('.css'))
      .filter((file) => /\.leaflet-/.test(fs.readFileSync(file, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
