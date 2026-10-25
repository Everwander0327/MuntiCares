import { describe, it, expect } from 'vitest';
import {
  getTrackingStatus,
  getProviderStatus,
  formatAccuracy,
  formatFreshness,
} from '../components/trackingStatus';

const provider = { lat: 14.4, lng: 121.04, accuracy: 12 };

describe('patient tracking status', () => {
  it('prioritises arrival', () => {
    expect(getTrackingStatus({ arrived: true, approximate: true, live: true, provider })).toMatchObject({
      level: 'good',
      label: 'Arrived',
    });
  });

  it('marks coarse GPS as caution', () => {
    expect(getTrackingStatus({ approximate: true, live: true, provider })).toMatchObject({
      level: 'caution',
      label: 'Approximate location',
    });
  });

  it('marks a fresh fix as live', () => {
    expect(getTrackingStatus({ live: true, provider })).toMatchObject({
      level: 'good',
      label: 'Live GPS',
      pulse: true,
    });
  });

  it('explains stationary, paused and lost states', () => {
    expect(getTrackingStatus({ stationary: true, provider })).toMatchObject({ level: 'caution', label: 'Provider stationary' });
    expect(getTrackingStatus({ session: { status: 'ended' }, provider })).toMatchObject({ level: 'caution', label: 'Tracking paused' });
    expect(getTrackingStatus({ provider })).toMatchObject({ level: 'problem', label: 'Signal lost' });
    expect(getTrackingStatus({})).toMatchObject({ level: 'caution', label: 'Waiting for GPS' });
  });
});

describe('provider tracking status', () => {
  it('surfaces errors and acquisition', () => {
    expect(getProviderStatus({ error: 'denied' })).toMatchObject({ level: 'problem', label: 'Location issue' });
    expect(getProviderStatus({})).toMatchObject({ level: 'caution', label: 'Acquiring GPS' });
  });

  it('does not show a stale fix as live', () => {
    expect(getProviderStatus({ fix: provider, stale: true })).toMatchObject({
      level: 'caution',
      label: 'GPS signal delayed',
    });
    expect(getProviderStatus({ fix: { ...provider, degraded: true } })).toMatchObject({
      level: 'caution',
      label: 'Approximate location',
    });
    expect(getProviderStatus({ fix: provider })).toMatchObject({
      level: 'good',
      label: 'On route · Live GPS',
      pulse: true,
    });
  });
});

describe('formatters', () => {
  it('formats accuracy with readable units', () => {
    expect(formatAccuracy(12)).toBe('±12m');
    expect(formatAccuracy(1200)).toBe('±1.2km');
    expect(formatAccuracy(0)).toBeNull();
  });

  it('formats freshness', () => {
    expect(formatFreshness(null)).toBe('waiting for signal');
    expect(formatFreshness(3)).toBe('updated now');
    expect(formatFreshness(20)).toBe('updated 20s ago');
    expect(formatFreshness(120)).toBe('updated 2m ago');
    expect(formatFreshness(7200)).toBe('updated 2h ago');
  });
});
