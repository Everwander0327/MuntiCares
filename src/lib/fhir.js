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

function buildObservationCode(system, code, display) {
  return {
    coding: [{ system: `${SYSTEM_BASE}/loinc`, code, display }],
    text: display,
  };
}

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
      const systolic = parts[0]?.trim();
      const diastolic = parts[1]?.trim();
      observations.push({
        ...base,
        resourceType: 'Observation',
        id: `${note.id}-bp`,
        code: buildObservationCode('85354-9', '85354-9', 'Blood pressure panel'),
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        component: [
          {
            code: buildObservationCode('8480-6', '8480-6', 'Systolic blood pressure'),
            valueQuantity: { value: parseFloat(systolic) || 0, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
          },
          {
            code: buildObservationCode('8462-4', '8462-4', 'Diastolic blood pressure'),
            valueQuantity: { value: parseFloat(diastolic) || 0, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
          },
        ],
      });
    }

    if (note.vitals_temp) {
      observations.push({
        ...base,
        resourceType: 'Observation',
        id: `${note.id}-temp`,
        code: buildObservationCode('8310-5', '8310-5', 'Body temperature'),
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        valueQuantity: { value: parseFloat(note.vitals_temp) || 0, unit: '°C', system: 'http://unitsofmeasure.org', code: 'Cel' },
      });
    }

    if (note.vitals_hr) {
      observations.push({
        ...base,
        resourceType: 'Observation',
        id: `${note.id}-hr`,
        code: buildObservationCode('8867-4', '8867-4', 'Heart rate'),
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        valueQuantity: { value: parseFloat(note.vitals_hr) || 0, unit: 'bpm', system: 'http://unitsofmeasure.org', code: '/min' },
      });
    }

    if (note.vitals_spo2) {
      observations.push({
        ...base,
        resourceType: 'Observation',
        id: `${note.id}-spo2`,
        code: buildObservationCode('59408-5', '59408-5', 'Oxygen saturation in Arterial blood'),
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        valueQuantity: { value: parseFloat(note.vitals_spo2) || 0, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
      });
    }

    if (note.pain_scale != null) {
      observations.push({
        ...base,
        resourceType: 'Observation',
        id: `${note.id}-pain`,
        code: buildObservationCode('38221-8', '38221-8', 'Pain severity'),
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
        valueQuantity: { value: parseInt(note.pain_scale) || 0, unit: '{score}', system: 'http://unitsofmeasure.org', code: '{score}' },
      });
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
      fullUrl: `urn:uuid:${r.resourceType}-${r.id}`,
      resource: r,
      request: {
        method: 'PUT',
        url: `${r.resourceType}/${r.id}`,
      },
    })),
  };
}

export async function uploadToHapiFhir(bundle) {
  const res = await fetch('https://hapi.fhir.org/baseR4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: JSON.stringify(bundle),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FHIR server error (${res.status}): ${errText.slice(0, 300)}`);
  }

  return res.json();
}
