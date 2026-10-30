import { describe, it, expect } from 'vitest';
import { haversine, distanceToPolyline, projectOnRoute, formatDistance, formatDuration } from '../services/geo';
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
  it('projectOnRoute reports progress and remaining distance', () => {
    const line = [[14.40, 121.04], [14.41, 121.04]];
    const projection = projectOnRoute({ lat: 14.405, lng: 121.0401 }, line);
    expect(projection).not.toBeNull();
    expect(projection.total).toBeGreaterThan(1100);
    expect(projection.along).toBeGreaterThan(500);
    expect(projection.remaining).toBeGreaterThan(500);
    expect(projection.offRoute).toBeLessThan(20);
  });
  it('formats', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(2345)).toBe('2.3 km');
    expect(formatDuration(600)).toBe('10 min');
  });
});

describe('gpsFilter', () => {
  it('keeps delivering coarse fixes while flagging them degraded', () => {
    const f = createGpsFilter();
    f({ lat: 14.4, lng: 121.04, accuracy: 1200, timestamp: 0 });
    const next = f({ lat: 14.402, lng: 121.04, accuracy: 900, timestamp: 3000 });

    expect(next).not.toBeNull();
    expect(next.degraded).toBe(true);
    expect(next.lat).toBeCloseTo(14.402, 5);
    expect(next.accuracy).toBeGreaterThanOrEqual(900);
  });
  it('recovers from coarse fixes on a precise fix', () => {
    const f = createGpsFilter();
    f({ lat: 14.4, lng: 121.04, accuracy: 1200, timestamp: 0 });
    f({ lat: 14.402, lng: 121.04, accuracy: 900, timestamp: 3000 });

    const recovered = f({ lat: 14.405, lng: 121.04, accuracy: 25, timestamp: 6000 });
    expect(recovered).not.toBeNull();
    expect(recovered.degraded).toBe(false);
    expect(recovered.lat).toBeCloseTo(14.405, 5);
  });
  it('keeps reported accuracy conservative for coarse fixes', () => {
    const f = createGpsFilter();
    let lastFix = null;
    for (let i = 0; i < 20; i += 1) {
      lastFix = f({ lat: 14.4 + i * 0.0001, lng: 121.04, accuracy: 1200, timestamp: i * 3000 });
    }
    expect(lastFix.degraded).toBe(true);
    expect(lastFix.accuracy).toBeGreaterThanOrEqual(1200);
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
  it('allows one coarse first fix but marks it degraded', () => {
    const f = createGpsFilter();
    const first = f({ lat: 14.4, lng: 121.04, accuracy: 1200, timestamp: 0 });
    expect(first).not.toBeNull();
    expect(first.degraded).toBe(true);
    expect(first.rawAccuracy).toBe(1200);
  });
  it('rejects fixes too coarse to place a pin', () => {
    const f = createGpsFilter();
    expect(f({ lat: 14.4, lng: 121.04, accuracy: 6000, timestamp: 0 })).toBeNull();
  });
});
