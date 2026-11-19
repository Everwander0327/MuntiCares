import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildIpsBundle } from './fhir';
import { parseFhirBundleForImport, buildMergedProfileUpdate, mergeUniqueList } from './fhirImport';

const repoRoot = path.resolve(import.meta.dirname, '../..');

describe('mergeUniqueList', () => {
  it('deduplicates case-insensitively and preserves existing ordering', () => {
    const merged = mergeUniqueList('Shellfish, Peanuts', ['penicillin', 'SHELLFISH', 'Latex']);
    expect(merged.newItems).toEqual(['penicillin', 'Latex']);
    expect(merged.mergedValue).toBe('Shellfish, Peanuts, penicillin, Latex');
    expect(merged.hasChanges).toBe(true);
  });
});

describe('parseFhirBundleForImport & buildMergedProfileUpdate', () => {
  it('parses the synthetic hospital discharge IPS bundle and builds selective merges', () => {
    const raw = fs.readFileSync(
      path.join(repoRoot, 'public/samples/sample-hospital-discharge-ips.json'),
      'utf8'
    );
    const sample = JSON.parse(raw);

    const currentProfile = {
      phone: '09170000000',
      date_of_birth: '',
      address: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      medical_notes: 'Gate code 1234',
      allergies: 'Shellfish',
      chronic_conditions: '',
      medications: '',
      past_surgeries: '',
      blood_type: '',
    };

    const parsed = parseFhirBundleForImport(sample, currentProfile);
    expect(parsed.validation.valid).toBe(true);
    expect(parsed.patientDisplayName).toBe('Elena Dela Cruz');
    expect(parsed.sourceFacility).toContain('Sample Metro Discharge Clinic');

    const allergies = parsed.categories.find((c) => c.key === 'allergies');
    expect(allergies.newItems).toEqual(['Penicillin']); // Shellfish already present

    const meds = parsed.categories.find((c) => c.key === 'medications');
    expect(meds.newItems).toHaveLength(2);

    const discharge = parsed.categories.find((c) => c.key === 'discharge_summary');
    expect(discharge.defaultSelected).toBe(false); // opt-in append to medical_notes
    expect(discharge.vitalsPreview.length).toBeGreaterThanOrEqual(4);
    expect(discharge.notesPreview[0]).toContain('Synthetic demo discharge note');

    // Merge selected categories including opt-in discharge_summary
    const merged = buildMergedProfileUpdate(
      parsed,
      ['demographics', 'allergies', 'chronic_conditions', 'medications', 'past_surgeries', 'blood_type', 'discharge_summary'],
      currentProfile
    );

    expect(merged.hasPatientUpdate).toBe(true);
    expect(merged.hasMedicalHistoryUpdate).toBe(true);
    expect(merged.patientPatch.date_of_birth).toBe('1958-06-14');
    expect(merged.patientPatch.emergency_contact).toBe('Marco Dela Cruz - 09185550144');
    expect(merged.patientPatch.medical_notes).toContain('Gate code 1234');
    expect(merged.patientPatch.medical_notes).toContain('Imported FHIR summary');
    expect(merged.medicalHistoryPatch.allergies).toBe('Shellfish, Penicillin');
    expect(merged.medicalHistoryPatch.blood_type).toBe('O+');
    expect(merged.medicalHistoryPatch.past_surgeries).toBe('Laparoscopic Cholecystectomy (2021)');

    // Re-importing the exact same bundle into the merged profile detects zero new duplicates
    const secondPass = parseFhirBundleForImport(sample, merged.nextProfile);
    expect(secondPass.hasMergeableChanges).toBe(false);
  });

  it('supports clean round-trip export -> validate -> import -> merge without duplicates', () => {
    const exported = buildIpsBundle({
      userData: { id: 'p-rt', full_name: 'Juan Dela Cruz', email: 'juan@example.ph' },
      patientData: {
        phone: '09171234567',
        date_of_birth: '1962-03-20',
        address: 'Alabang, Muntinlupa City',
        emergency_contact_name: 'Maria Cruz',
        emergency_contact_phone: '09187654321',
      },
      medicalHistory: {
        allergies: 'Latex, Aspirin',
        chronic_conditions: 'Asthma',
        medications: 'Salbutamol inhaler PRN',
        past_surgeries: 'Tonsillectomy',
        blood_type: 'A+',
      },
    });

    const parsed = parseFhirBundleForImport(exported, {});
    expect(parsed.validation.valid).toBe(true);
    expect(parsed.validation.profile).toBe('IPS-R4');
    expect(parsed.hasMergeableChanges).toBe(true);

    const merged = buildMergedProfileUpdate(
      parsed,
      parsed.categories.filter((c) => c.defaultSelected).map((c) => c.key),
      {}
    );

    expect(merged.nextProfile.allergies).toBe('Latex, Aspirin');
    expect(merged.nextProfile.medications).toBe('Salbutamol inhaler PRN');
    expect(merged.nextProfile.blood_type).toBe('A+');

    const reimported = parseFhirBundleForImport(exported, merged.nextProfile);
    expect(reimported.hasMergeableChanges).toBe(false);
  });
});
