import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateFhirBundle } from './fhirValidator';
import { buildIpsBundle } from './fhir';

const repoRoot = path.resolve(import.meta.dirname, '../..');

describe('validateFhirBundle', () => {
  it('validates the shipped synthetic hospital discharge IPS fixture with zero errors', () => {
    const raw = fs.readFileSync(
      path.join(repoRoot, 'public/samples/sample-hospital-discharge-ips.json'),
      'utf8'
    );
    const sample = JSON.parse(raw);
    const result = validateFhirBundle(sample);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.profile).toBe('IPS-R4');
    expect(result.checksPassed).toBe(result.checksTotal);
  });

  it('rejects empty strings and empty arrays (FHIR invariant ele-1)', () => {
    const broken = buildIpsBundle({
      userData: { id: 'p-1', full_name: 'Elena Dela Cruz' },
    });
    broken.entry[1].resource.name[0].family = '';
    broken.entry[1].resource.address = [];

    const result = validateFhirBundle(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ele-1' && e.path.includes('family'))).toBe(true);
    expect(result.errors.some((e) => e.code === 'ele-1' && e.path.includes('address'))).toBe(true);
  });

  it('rejects document bundles whose entry[0] is not Composition or that contain entry.request', () => {
    const badDoc = {
      resourceType: 'Bundle',
      id: 'bad-doc',
      identifier: { system: 'https://example.org', value: '1' },
      type: 'document',
      timestamp: '2026-11-19T00:00:00Z',
      entry: [
        {
          fullUrl: 'https://example.org/Patient/p1',
          resource: { resourceType: 'Patient', id: 'p1', name: [{ text: 'Juan' }] },
          request: { method: 'PUT', url: 'Patient/p1' },
        },
      ],
    };

    const result = validateFhirBundle(badDoc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'bdl-1')).toBe(true);
    expect(result.errors.some((e) => e.code === 'bdl-3')).toBe(true);
  });

  it('rejects unresolved internal references in document bundles', () => {
    const broken = buildIpsBundle({
      userData: { id: 'p-2', full_name: 'Maria Santos' },
    });
    broken.entry[0].resource.section[0].entry = [{ reference: 'AllergyIntolerance/does-not-exist' }];
    delete broken.entry[0].resource.section[0].emptyReason;

    const result = validateFhirBundle(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'bdl-ref-unresolved')).toBe(true);
  });

  it('flags LOINC Part codes on DocumentReference and warns on expiring signed URLs', () => {
    const bundle = {
      resourceType: 'Bundle',
      id: 'doc-check',
      type: 'collection',
      entry: [
        {
          resource: { resourceType: 'Patient', id: 'p1', name: [{ text: 'Liza Cruz' }] },
        },
        {
          resource: {
            resourceType: 'DocumentReference',
            id: 'd1',
            status: 'current',
            type: { coding: [{ system: 'http://loinc.org', code: 'LP29684-5' }] },
            subject: { reference: 'Patient/p1' },
            content: [
              {
                attachment: {
                  contentType: 'application/pdf',
                  url: 'https://storage.example/file.pdf?token=secret123',
                },
              },
            ],
          },
        },
      ],
    };

    const result = validateFhirBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'doc-loinc-part')).toBe(true);
    expect(result.warnings.some((w) => w.code === 'doc-signed-url')).toBe(true);
  });
});
