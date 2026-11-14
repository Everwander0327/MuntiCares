import { describe, it, expect } from 'vitest';
import {
  getInitials,
  computeUserShares,
  buildSparklinePoints,
  computeBookingMomentum,
  getPeakBookingMonth,
  getStatusBadgeClass,
  formatRangeSubtitle,
} from './dashboardMetrics';

describe('dashboardMetrics', () => {
  it('derives clean 2-letter initials from full or single names', () => {
    expect(getInitials('John Lawrence')).toBe('JL');
    expect(getInitials('Paeng Miguel Pineda')).toBe('PP');
    expect(getInitials('Admin')).toBe('AD');
    expect(getInitials('')).toBe('MC');
  });

  it('computes rounded user percentage shares safely including zero totals', () => {
    expect(computeUserShares(10, 3)).toEqual({
      total: 13,
      patientShare: '76.9%',
      providerShare: '23.1%',
    });
    expect(computeUserShares(0, 0)).toEqual({
      total: 0,
      patientShare: '0%',
      providerShare: '0%',
    });
  });

  it('normalizes sparkline coordinates without NaN on zero or single-point arrays', () => {
    expect(buildSparklinePoints([])).toBe('');
    expect(buildSparklinePoints([0, 0, 0, 0])).toBe('2,20 22,20 42,20 62,20');
    const pts = buildSparklinePoints([0, 0, 2, 10]);
    expect(pts.split(' ')).toHaveLength(4);
    expect(pts.endsWith('62,2')).toBe(true);
  });

  it('computes booking momentum tag from latest monthly bars', () => {
    expect(computeBookingMomentum([])).toBe('0 recent');
    expect(computeBookingMomentum([{ month: 'Oct', requests: 2 }, { month: 'Nov', requests: 10 }])).toBe('5x Nov');
    expect(computeBookingMomentum([{ month: 'Oct', requests: 5 }, { month: 'Nov', requests: 6 }])).toBe('+6 Nov');
    expect(computeBookingMomentum([{ month: 'Oct', requests: 2 }, { month: 'Nov', requests: 0 }])).toBe('0 Nov');
  });

  it('finds peak booking month label safely', () => {
    expect(getPeakBookingMonth([{ month: 'Oct', requests: 2 }, { month: 'Nov', requests: 10 }])).toBe('Peak Nov (10)');
    expect(getPeakBookingMonth([{ month: 'Oct', requests: 0 }, { month: 'Nov', requests: 0 }])).toBe('No bookings');
  });

  it('maps status strings uniformly to badge theme classes', () => {
    expect(getStatusBadgeClass('Completed')).toContain('text-success');
    expect(getStatusBadgeClass('Accepted')).toContain('text-link');
    expect(getStatusBadgeClass('Pending')).toContain('text-warning');
    expect(getStatusBadgeClass('Cancelled')).toContain('text-danger');
    expect(getStatusBadgeClass('Unknown')).toContain('text-warning');
  });

  it('formats active range overview subtitles cleanly', () => {
    expect(formatRangeSubtitle('', '', 'ALL')).toBe('All Time Overview');
    expect(formatRangeSubtitle('2026-10-14', '2026-11-14', '30D')).toBe('Last 30 Days Overview');
    expect(formatRangeSubtitle('2026-05-14', '2026-11-14', '6M')).toBe('Last 6 Months Overview');
    expect(formatRangeSubtitle('2026-10-01', '2026-10-31', '')).toBe('2026-10-01 to 2026-10-31 Overview');
  });
});
