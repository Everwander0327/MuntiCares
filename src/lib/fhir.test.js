import { describe, it, expect } from 'vitest';
import {
  SYSTEM_BASE,
  buildPatientResource,
  buildVitalSignObservations,
  buildBloodTypeObservation,
  buildConditionResources,
  buildAllergyResources,
  buildMedicationStatements,
  buildProcedureResources,
  buildVisitEncounterResources,
  buildDocumentReferences,
  buildConsentResources,
  buildIpsBundle,
  buildBundle,
} from './fhir';
import { validateFhirBundle } from './fhirValidator';

const patientId = 'patient-123';

function observations(notes) {
  return buildVitalSignObservations(notes, patientId);
}

function observationIds(notes) {
  return observations(notes).map((o) => o.id);
}

describe('buildVitalSignObservations', () => {
  it('emits numeric values for well-formed vitals including respiratory rate', () => {
    const obs = observations([
      {
        id: 'n1',
        created_at: '2026-01-01T00:00:00Z',
        vitals_bp: '120/80',
        vitals_temp: '36.5',
        vitals_hr: '75',
        vitals_rr: '18',
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
    const rr = obs.find((o) => o.id === 'n1-rr');
    expect(rr.code.coding[0].code).toBe('9279-1');
    expect(rr.valueQuantity.value).toBe(18);
    expect(obs.find((o) => o.id === 'n1-spo2').valueQuantity.value).toBe(98);
    const pain = obs.find((o) => o.id === 'n1-pain');
    expect(pain.code.coding[0].code).toBe('72514-3');
    expect(pain.valueQuantity.value).toBe(5);
  });

  it('omits blood pressure observation when neither value parses', () => {
    const ids = observationIds([{ id: 'n2', vitals_bp: 'abc/def' }]);
    expect(ids).not.toContain('n2-bp');
  });

  it('drops only the unparseable blood pressure component', () => {
    const bp = observations([{ id: 'n3', vitals_bp: '120' }]).find((o) => o.id === 'n3-bp');
    expect(bp.component).toHaveLength(1);
    expect(bp.component[0].valueQuantity.value).toBe(120);
  });

  it('omits observations whose value cannot be parsed', () => {
    const ids = observationIds([
      {
        id: 'n4',
        vitals_temp: 'N/A',
        vitals_hr: 'abc',
        vitals_rr: '?',
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

describe('buildPatientResource', () => {
  it('omits empty strings and empty arrays to satisfy FHIR ele-1', () => {
    const minimal = buildPatientResource({ id: 'p-min', full_name: 'Elena' }, {});
    expect(minimal.name).toEqual([{ use: 'official', text: 'Elena', given: ['Elena'] }]);
    expect(minimal.name[0]).not.toHaveProperty('family');
    expect(minimal).not.toHaveProperty('telecom');
    expect(minimal).not.toHaveProperty('address');
    expect(minimal).not.toHaveProperty('contact');
    expect(minimal).not.toHaveProperty('birthDate');
  });

  it('maps DOB, structured PH address, emergency contacts, caregiver, and language', () => {
    const pat = buildPatientResource(
      {
        id: 'p-full',
        full_name: 'Elena Dela Cruz',
        email: 'elena@example.ph',
        created_at: '2026-05-01T08:00:00Z',
      },
      {
        phone: '09171234567',
        date_of_birth: '1958-06-14',
        unit: 'Unit 4B',
        subdivision: 'Victoria Homes',
        address: 'Unit 4B, Victoria Homes, Tunasan',
        emergency_contact_name: 'Marco Dela Cruz',
        emergency_contact_phone: '09187654321',
        caregiver_name: 'Liza Santos',
        caregiver_relationship: 'Daughter',
        caregiver_phone: '09191112222',
        preferred_language: 'fil',
      }
    );

    expect(pat.birthDate).toBe('1958-06-14');
    expect(pat.address[0]).toMatchObject({
      city: 'Muntinlupa City',
      state: 'Metro Manila',
      country: 'PH',
      line: ['Unit 4B', 'Victoria Homes'],
    });
    expect(pat.contact).toHaveLength(2);
    expect(pat.communication[0].language.coding[0].code).toBe('fil');
  });
});

describe('clinical history, documents, and consent builders', () => {
  it('maps conditions, allergies, medications, procedures, and blood type', () => {
    const mh = {
      chronic_conditions: 'Hypertension, Type 2 Diabetes, hypertension',
      allergies: 'Penicillin, Shellfish',
      medications: 'Amlodipine 5mg OD\nMetformin 500mg BID',
      past_surgeries: 'Appendectomy (2015), Knee Arthroscopy',
      blood_type: 'O+',
    };

    expect(buildConditionResources(mh, patientId)).toHaveLength(2);
    expect(buildAllergyResources(mh, patientId)).toHaveLength(2);
    const meds = buildMedicationStatements(mh, patientId);
    expect(meds).toHaveLength(2);
    expect(meds[0].resourceType).toBe('MedicationStatement');
    const procs = buildProcedureResources(mh, patientId);
    expect(procs).toHaveLength(2);
    expect(procs[0].resourceType).toBe('Procedure');

    const bt = buildBloodTypeObservation(mh, patientId);
    expect(bt.code.coding[0].code).toBe('882-1');
    expect(bt.valueCodeableConcept.text).toBe('O+');
    expect(buildBloodTypeObservation({ blood_type: 'Unknown' }, patientId)).toBeNull();
  });

  it('builds metadata-only DocumentReferences with valid LOINC code and no storage URLs', () => {
    const docs = buildDocumentReferences(
      [
        {
          id: 'doc-1',
          document_title: 'CBC_Lab_Result.pdf',
          file_path: 'patient-123/secret.pdf',
          uploaded_at: '2026-10-01T10:00:00Z',
        },
      ],
      patientId
    );

    expect(docs).toHaveLength(1);
    expect(docs[0].type.coding[0].code).toBe('51852-2');
    expect(docs[0].content[0].attachment.contentType).toBe('application/pdf');
    expect(docs[0].content[0].attachment).not.toHaveProperty('url');
  });

  it('builds Encounter and clinical note DocumentReference from visit notes', () => {
    const res = buildVisitEncounterResources(
      [
        {
          id: 'vn-1',
          created_at: '2026-11-10T09:00:00Z',
          services_rendered: 'Nursing Care',
          notes: 'Wound clean and dry. Dressing changed.',
        },
      ],
      patientId
    );
    expect(res.map((r) => r.resourceType)).toEqual(['Encounter', 'DocumentReference']);
    expect(res[1].type.coding[0].code).toBe('11506-3');
    expect(res[1].content[0].attachment.data).toBeTruthy();
  });

  it('maps RA 10173 consent grants into Consent resources', () => {
    const consents = buildConsentResources(
      [
        {
          id: 'grant-1',
          is_enabled: true,
          permissions: { medical_history: true, visit_notes: true, documents: false },
          expires_at: '2027-01-01T00:00:00Z',
        },
      ],
      patientId
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].status).toBe('active');
    expect(consents[0].provision.class.map((c) => c.code)).toEqual([
      'medical_history',
      'visit_notes',
    ]);
  });
});

describe('buildIpsBundle & buildBundle', () => {
  it('assembles a strict IPS document Bundle with Composition entry #0 that passes validation', () => {
    const bundle = buildIpsBundle({
      userData: {
        id: patientId,
        full_name: 'Elena Dela Cruz',
        email: 'elena@example.ph',
        created_at: '2026-01-15T00:00:00Z',
      },
      patientData: {
        phone: '09171234567',
        date_of_birth: '1958-06-14',
        address: 'Block 4 Lot 2, Putatan, Muntinlupa City',
        emergency_contact_name: 'Marco Dela Cruz',
        emergency_contact_phone: '09187654321',
        preferred_language: 'fil',
      },
      medicalHistory: {
        allergies: 'Penicillin',
        chronic_conditions: 'Hypertension',
        medications: 'Amlodipine 5mg once daily',
        past_surgeries: 'Appendectomy',
        blood_type: 'O+',
      },
      visitNotes: [
        {
          id: 'vn-1',
          created_at: '2026-11-12T10:00:00Z',
          vitals_bp: '124/80',
          vitals_temp: '36.6',
          vitals_hr: '74',
          vitals_rr: '16',
          vitals_spo2: '99',
          services_rendered: 'Vital Signs Monitoring',
          notes: 'Stable home visit checkup.',
        },
      ],
      documents: [
        {
          id: 'doc-1',
          document_title: 'ECG_Report.pdf',
          uploaded_at: '2026-11-05T08:00:00Z',
        },
      ],
      consents: [
        {
          id: 'c-1',
          is_enabled: true,
          permissions: { medical_history: true, documents: true, visit_notes: true },
          expires_at: '2027-02-01T00:00:00Z',
        },
      ],
    });

    expect(bundle.type).toBe('document');
    expect(bundle.entry[0].resource.resourceType).toBe('Composition');
    expect(bundle.entry[0].resource.type.coding[0].code).toBe('60591-5');
    expect(bundle.entry[0].fullUrl).toContain(SYSTEM_BASE);
    expect(SYSTEM_BASE).not.toContain('munticares.com');
    expect(bundle.entry.every((e) => !e.request)).toBe(true);

    const validation = validateFhirBundle(bundle);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
    expect(validation.valid).toBe(true);
    expect(validation.profile).toBe('IPS-R4');
    expect(validation.checksPassed).toBe(validation.checksTotal);
  });

  it('produces valid IPS emptyReason sections when a patient has no clinical history yet', () => {
    const patient = buildPatientResource({ id: 'p-empty', full_name: 'Rosa Mendoza' }, {});
    const bundle = buildBundle([patient]);
    const comp = bundle.entry[0].resource;
    expect(comp.resourceType).toBe('Composition');
    expect(comp.section).toHaveLength(3); // Allergies, Medications, Problems (IPS required)
    expect(comp.section.every((s) => s.emptyReason?.coding?.[0]?.code === 'nilknown')).toBe(true);

    const validation = validateFhirBundle(bundle);
    expect(validation.valid).toBe(true);
    expect(validation.profile).toBe('IPS-R4');
  });
});
