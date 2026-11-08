import { describe, it, expect } from 'vitest';
import { buildVitalSignObservations } from './fhir';

const patientId = 'patient-123';

function observations(notes) {
  return buildVitalSignObservations(notes, patientId);
}

function observationIds(notes) {
  return observations(notes).map((o) => o.id);
}

describe('buildVitalSignObservations', () => {
  it('emits numeric values for well-formed vitals', () => {
    const obs = observations([
      {
        id: 'n1',
        created_at: '2026-01-01T00:00:00Z',
        vitals_bp: '120/80',
        vitals_temp: '36.5',
        vitals_hr: '75',
        vitals_spo2: '98',
        pain_scale: '5',
      },
    ]);

    const bp = obs.find((o) => o.id === 'n1-bp');
    expect(bp.component).toHaveLength(2);
    expect(bp.component[0].valueQuantity.value).toBe(120);
    expect(bp.component[1].valueQuantity.value).toBe(80);

    expect(obs.find((o) => o.id === 'n1-temp').valueQuantity.value).toBe(36.5);
    expect(obs.find((o) => o.id === 'n1-hr').valueQuantity.value).toBe(75);
    expect(obs.find((o) => o.id === 'n1-spo2').valueQuantity.value).toBe(98);
    expect(obs.find((o) => o.id === 'n1-pain').valueQuantity.value).toBe(5);
  });

  it('omits blood pressure observation when neither value parses', () => {
    const ids = observationIds([{ id: 'n2', vitals_bp: 'abc/def' }]);
    expect(ids).not.toContain('n2-bp');
  });

  it('drops only the unparseable blood pressure component', () => {
    const bp = observations([{ id: 'n3', vitals_bp: '120' }]).find(
      (o) => o.id === 'n3-bp'
    );
    expect(bp.component).toHaveLength(1);
    expect(bp.component[0].valueQuantity.value).toBe(120);
  });

  it('omits observations whose value cannot be parsed', () => {
    const ids = observationIds([
      {
        id: 'n4',
        vitals_temp: 'N/A',
        vitals_hr: 'abc',
        vitals_spo2: '--',
        pain_scale: 'N/A',
      },
    ]);
    expect(ids).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(observations([])).toEqual([]);
    expect(observations(null)).toEqual([]);
  });
});
