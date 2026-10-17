import { describe, it, expect } from 'vitest';
import { haversine, distanceToPolyline, formatDistance, formatDuration } from '../services/geo';
import { createGpsFilter } from '../services/gpsFilter';

describe('geo', () => {
  it('haversine ~ 1.11 km per 0.01° lat', () => {
    const d = haversine({ lat: 14.40, lng: 121.04 }, { lat: 14.41, lng: 121.04 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
  it('distanceToPolyline is ~0 on the line', () => {
    const line = [[14.40, 121.04], [14.41, 121.04]];
    expect(distanceToPolyline({ lat: 14.405, lng: 121.04 }, line)).toBeLessThan(1);
  });
  it('formats', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(2345)).toBe('2.3 km');
    expect(formatDuration(600)).toBe('10 min');
  });
});

describe('gpsFilter', () => {
  it('rejects inaccurate fixes after the first', () => {
    const f = createGpsFilter();
    expect(f({ lat: 14.4, lng: 121.04, accuracy: 10, timestamp: 0 })).not.toBeNull();
    expect(f({ lat: 14.4, lng: 121.04, accuracy: 500, timestamp: 1000 })).toBeNull();
  });
  it('rejects teleports', () => {
    const f = createGpsFilter();
    f({ lat: 14.4, lng: 121.04, accuracy: 10, timestamp: 0 });
    // ~11 km in 1s
    expect(f({ lat: 14.5, lng: 121.04, accuracy: 10, timestamp: 1000 })).toBeNull();
  });
  it('accepts normal driving movement', () => {
    const f = createGpsFilter();
    f({ lat: 14.4, lng: 121.04, accuracy: 10, timestamp: 0 });
    const r = f({ lat: 14.4001, lng: 121.04, accuracy: 10, timestamp: 3000 }); // ~11m in 3s
    expect(r).not.toBeNull();
    expect(r.lat).toBeGreaterThan(14.4);
  });
});
