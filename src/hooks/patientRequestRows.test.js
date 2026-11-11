import { describe, it, expect } from 'vitest';
import { formatRequestRow, mergeRequestRow } from './patientRequestRows';

const raw = {
  id: 'req-1',
  patient_id: 'p1',
  provider_id: 'prov-1',
  provider: { full_name: 'Dr. A', avatar_url: 'http://a' },
  service: 'Elderly Care',
  date: '2026-01-01',
  time: '10:00:00',
  status: 'Accepted',
  notes: 'hello',
  duration_minutes: 60,
  dest_lat: 1,
  dest_lng: 2,
  dest_address: 'x',
  dest_source: 'db',
  dest_version: 3,
  dest_updated_at: 't',
  route_started_at: 't2',
  arrived_at: 't3',
};

describe('formatRequestRow', () => {
  it('maps duration_minutes to durationMinutes', () => {
    expect(formatRequestRow(raw).durationMinutes).toBe(60);
  });

  it('maps provider fallback and service', () => {
    const row = formatRequestRow({ ...raw, provider: null });
    expect(row.provider).toBe('Unknown');
    expect(row.service).toBe('Elderly Care');
  });

  it('uses provider location when present', () => {
    const row = formatRequestRow({
      ...raw,
      provider: { full_name: 'Dr. A', avatar_url: '', location: 'Alabang' },
    });
    expect(row.location).toBe('Alabang');
  });

  it('defaults durationMinutes to null when absent', () => {
    const { duration_minutes: _duration_minutes, ...rest } = raw;
    expect(formatRequestRow(rest).durationMinutes).toBeNull();
  });
});

describe('mergeRequestRow', () => {
  it('preserves durationMinutes when update omits it', () => {
    const merged = mergeRequestRow(formatRequestRow(raw), {
      id: 'req-1',
      status: 'On The Way',
    });
    expect(merged.status).toBe('On The Way');
    expect(merged.durationMinutes).toBe(60);
  });

  it('updates durationMinutes when update includes it', () => {
    const merged = mergeRequestRow(formatRequestRow(raw), {
      id: 'req-1',
      duration_minutes: 90,
    });
    expect(merged.durationMinutes).toBe(90);
  });
});
