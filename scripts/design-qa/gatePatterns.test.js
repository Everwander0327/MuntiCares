import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanSource } from './lib/gate.mjs';

const FIXTURE = `
export const A = () => <div className="fixed inset-0 z-[9999]" />;
export const B = () => <div className="fixed inset-0 z-[10000]" />;
export const C = () => <div className="fixed inset-0 z-[99999]" />;
export const D = () => <div className="z-[10000] backdrop-blur-xs" />;
`;

let dir;

function scan(fixture) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-patterns-'));
  fs.writeFileSync(path.join(dir, 'Probe.jsx'), fixture, 'utf8');
  return scanSource(dir);
}

afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const hitsFor = (hits, id) => (hits[id] ?? []).length;

describe('gate 9 banned-class patterns', () => {
  it('catches every z-index escalation literal banned by DESIGN.md', () => {
    const hits = scan(FIXTURE);
    for (const banned of ['z-[9999]', 'z-[10000]', 'z-[99999]']) {
      const found = scan(`export const X = () => <div className="${banned}" />;`);
      expect(hitsFor(found, 'z-index-escalation'), `${banned} should be caught`).toBeGreaterThan(0);
    }
    expect(hitsFor(hits, 'z-index-escalation')).toBe(4);
  });

  it('catches backdrop-blur-xs, a utility Tailwind never emits', () => {
    const hits = scan(FIXTURE);
    expect(hitsFor(hits, 'backdrop-blur-xs')).toBe(1);
  });

  it('still catches the previously-covered shadow-xs and h-screen', () => {
    const hits = scan('export const X = () => <div className="h-screen shadow-xs" />;');
    expect(hitsFor(hits, 'shadow-xs')).toBe(1);
    expect(hitsFor(hits, 'h-screen')).toBe(1);
  });

  it('does not flag ordinary ramp values such as z-50 or z-[60]', () => {
    const hits = scan('export const X = () => <div className="z-50 z-[60] z-[70]" />;');
    expect(hitsFor(hits, 'z-index-escalation')).toBe(0);
  });
});
