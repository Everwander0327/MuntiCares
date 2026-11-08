const SYSTEM_BASE = 'https://munticares.com/fhir';

function buildName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  const family = parts.length > 1 ? parts.pop() : '';
  const given = parts.length > 0 ? [parts.join(' ')] : [fullName || ''];
  return [{ use: 'official', text: fullName || '', family, given }];
}

function buildTelecom(email, phone) {
  const telecom = [];
  if (email) telecom.push({ system: 'email', value: email, use: 'home' });
  if (phone) telecom.push({ system: 'phone', value: phone, use: 'mobile' });
  return telecom;
}

function buildAddress(address) {
  return address ? [{ text: address, use: 'home' }] : [];
}

export function buildPatientResource(userData, patientData) {
  return {
    resourceType: 'Patient',
    id: userData.id,
    name: buildName(userData.full_name || userData.fullName),
    telecom: buildTelecom(userData.email, patientData?.phone),
    address: buildAddress(patientData?.address),
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
      lastUpdated: new Date().toISOString(),
    },
  };
}

function buildObservationCode(code, display, system = 'http://loinc.org') {
  return {
    coding: [{ system, code, display }],
    text: display,
  };
}

function toFiniteNumber(value) {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

const VITAL_SIGNS_CATEGORY = [
  { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] },
];

export function buildVitalSignObservations(visitNotes, patientId) {
  if (!visitNotes?.length) return [];

  const observations = [];

  visitNotes.forEach((note) => {
    const base = {
      status: 'final',
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: note.created_at,
      meta: {
        tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
      },
    };

    if (note.vitals_bp) {
      const parts = note.vitals_bp.split('/');
      const systolic = toFiniteNumber(parts[0]);
      const diastolic = toFiniteNumber(parts[1]);
      const component = [];
      if (systolic != null) {
        component.push({
          code: buildObservationCode('8480-6', 'Systolic blood pressure'),
          valueQuantity: { value: systolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
        });
      }
      if (diastolic != null) {
        component.push({
          code: buildObservationCode('8462-4', 'Diastolic blood pressure'),
          valueQuantity: { value: diastolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
        });
      }
      if (component.length > 0) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: `${note.id}-bp`,
          code: buildObservationCode('85354-9', 'Blood pressure panel'),
          category: VITAL_SIGNS_CATEGORY,
          component,
        });
      }
    }

    if (note.vitals_temp) {
      const value = toFiniteNumber(note.vitals_temp);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: `${note.id}-temp`,
          code: buildObservationCode('8310-5', 'Body temperature'),
          category: VITAL_SIGNS_CATEGORY,
          valueQuantity: { value, unit: '°C', system: 'http://unitsofmeasure.org', code: 'Cel' },
        });
      }
    }

    if (note.vitals_hr) {
      const value = toFiniteNumber(note.vitals_hr);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: `${note.id}-hr`,
          code: buildObservationCode('8867-4', 'Heart rate'),
          category: VITAL_SIGNS_CATEGORY,
          valueQuantity: { value, unit: 'bpm', system: 'http://unitsofmeasure.org', code: '/min' },
        });
      }
    }

    if (note.vitals_spo2) {
      const value = toFiniteNumber(note.vitals_spo2);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: `${note.id}-spo2`,
          code: buildObservationCode('59408-5', 'Oxygen saturation in Arterial blood'),
          category: VITAL_SIGNS_CATEGORY,
          valueQuantity: { value, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
        });
      }
    }

    if (note.pain_scale != null && note.pain_scale !== '') {
      const value = toFiniteNumber(note.pain_scale);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: `${note.id}-pain`,
          code: buildObservationCode('38221-8', 'Pain severity'),
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
          valueQuantity: { value, unit: '{score}', system: 'http://unitsofmeasure.org', code: '{score}' },
        });
      }
    }
  });

  return observations;
}

export function buildConditionResources(medicalHistory, patientId) {
  if (!medicalHistory?.chronic_conditions?.trim()) return [];

  return medicalHistory.chronic_conditions
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((condition, idx) => ({
      resourceType: 'Condition',
      id: `chronic-${patientId}-${idx}`,
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
      },
      code: { text: condition },
      subject: { reference: `Patient/${patientId}` },
      meta: {
        tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
      },
    }));
}

export function buildAllergyResources(medicalHistory, patientId) {
  if (!medicalHistory?.allergies?.trim()) return [];

  return medicalHistory.allergies
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((allergy, idx) => ({
      resourceType: 'AllergyIntolerance',
      id: `allergy-${patientId}-${idx}`,
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active', display: 'Active' }],
      },
      code: { text: allergy },
      patient: { reference: `Patient/${patientId}` },
      meta: {
        tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
      },
    }));
}

export function buildDocumentReferences(documents, patientId, signedUrls) {
  if (!documents?.length) return [];

  return documents.map((doc, idx) => ({
    resourceType: 'DocumentReference',
    id: doc.id || `doc-${patientId}-${idx}`,
    status: 'current',
    type: {
      coding: [{ system: 'http://loinc.org', code: 'LP29684-5', display: 'Medical document' }],
      text: 'Medical Document',
    },
    subject: { reference: `Patient/${patientId}` },
    content: [
      {
        attachment: {
          contentType: 'application/octet-stream',
          title: doc.document_title,
          url: signedUrls?.[idx] || '',
        },
      },
    ],
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
  }));
}

export function buildBundle(resources) {
  const now = new Date().toISOString();
  return {
    resourceType: 'Bundle',
    id: `munticares-bundle-${Date.now()}`,
    type: 'transaction',
    timestamp: now,
    entry: resources.map((r) => ({
      fullUrl: `${SYSTEM_BASE}/${r.resourceType}/${r.id}`,
      resource: r,
      request: {
        method: 'PUT',
        url: `${r.resourceType}/${r.id}`,
      },
    })),
  };
}
