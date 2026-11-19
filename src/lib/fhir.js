import { normalizeSiteUrl } from './seo/seoConfig';

const FHIR_SITE_BASE = normalizeSiteUrl(
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SITE_URL : ''
);
export const SYSTEM_BASE = `${FHIR_SITE_BASE}/fhir`;

const IPS_BUNDLE_PROFILE = 'http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips';
const IPS_COMPOSITION_PROFILE = 'http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips';
const ORGANIZATION_ID = 'munticares-org';

const VITAL_SIGNS_CATEGORY = [
  {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs',
      },
    ],
  },
];

const SURVEY_CATEGORY = [
  {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'survey',
        display: 'Survey',
      },
    ],
  },
];

const LABORATORY_CATEGORY = [
  {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory',
      },
    ],
  },
];

const ALLOWED_BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

/** Sanitizes an identifier to valid FHIR R4 id syntax: [A-Za-z0-9\-\.]{1,64}. */
export function sanitizeFhirId(raw, fallback = 'res') {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^A-Za-z0-9-.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = cleaned || fallback;
  return base.slice(0, 64);
}

function shortPatientKey(patientId) {
  return sanitizeFhirId(patientId, 'patient').slice(0, 36);
}

function nonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function toValidIsoInstant(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toValidFhirDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return match[1];
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildNarrative(items, emptyMessage) {
  const safeItems = (items || []).map((line) => nonEmptyString(String(line))).filter(Boolean);
  if (safeItems.length === 0) {
    return {
      status: 'empty',
      div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeXml(emptyMessage)}</p></div>`,
    };
  }
  const li = safeItems.map((line) => `<li>${escapeXml(line)}</li>`).join('');
  return {
    status: 'generated',
    div: `<div xmlns="http://www.w3.org/1999/xhtml"><ul>${li}</ul></div>`,
  };
}

function toBase64Utf8(text) {
  const str = String(text || '');
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  // Node.js fallback
  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(str, 'utf8').toString('base64');
  }
  return '';
}

function inferMimeType(filename = '') {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function splitListValues(raw, { preferLines = false } = {}) {
  const text = nonEmptyString(raw);
  if (!text) return [];
  const separator = preferLines && /[\n;]/.test(text) ? /[\n;]+/ : /[,\n;]+/;
  const seen = new Set();
  const result = [];
  for (const part of text.split(separator)) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function buildName(fullName) {
  const cleaned = nonEmptyString(fullName);
  if (!cleaned) return undefined;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const nameObj = { use: 'official', text: cleaned };
  if (parts.length > 1) {
    nameObj.family = parts.pop();
    nameObj.given = [parts.join(' ')];
  } else if (parts.length === 1) {
    nameObj.given = [parts[0]];
  }
  return [nameObj];
}

function buildTelecom(email, phone) {
  const telecom = [];
  const cleanEmail = nonEmptyString(email);
  const cleanPhone = nonEmptyString(phone);
  if (cleanEmail) telecom.push({ system: 'email', value: cleanEmail, use: 'home' });
  if (cleanPhone) telecom.push({ system: 'phone', value: cleanPhone, use: 'mobile' });
  return telecom.length > 0 ? telecom : undefined;
}

function buildAddress(patientData) {
  if (!patientData) return undefined;
  const text = nonEmptyString(patientData.address);
  const unit = nonEmptyString(patientData.unit);
  const subdivision = nonEmptyString(patientData.subdivision);

  const line = [unit, subdivision].filter(Boolean);
  if (!text && line.length === 0) return undefined;

  const addr = {
    use: 'home',
    type: 'physical',
  };
  if (text) addr.text = text;
  if (line.length > 0) addr.line = line;
  addr.city = 'Muntinlupa City';
  addr.state = 'Metro Manila';
  addr.country = 'PH';
  return [addr];
}

function parseLegacyEmergencyContact(raw) {
  const cleaned = nonEmptyString(raw);
  if (!cleaned) return { name: null, phone: null };
  if (cleaned.includes(' - ')) {
    const [name, phone] = cleaned.split(' - ');
    return { name: nonEmptyString(name), phone: nonEmptyString(phone) };
  }
  return { name: cleaned, phone: null };
}

function buildPatientContacts(patientData) {
  if (!patientData) return undefined;
  const contacts = [];

  const legacy = parseLegacyEmergencyContact(patientData.emergency_contact);
  const primaryName = nonEmptyString(patientData.emergency_contact_name) || legacy.name;
  const primaryPhone = nonEmptyString(patientData.emergency_contact_phone) || legacy.phone;

  if (primaryName || primaryPhone) {
    const contact = {
      relationship: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
              code: 'C',
              display: 'Emergency Contact',
            },
          ],
          text: 'Primary Emergency Contact',
        },
      ],
    };
    if (primaryName) contact.name = { text: primaryName };
    if (primaryPhone) contact.telecom = [{ system: 'phone', value: primaryPhone, use: 'mobile' }];
    contacts.push(contact);
  }

  const secName = nonEmptyString(patientData.secondary_emergency_name);
  const secPhone = nonEmptyString(patientData.secondary_emergency_phone);
  if (secName || secPhone) {
    const contact = {
      relationship: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
              code: 'C',
              display: 'Emergency Contact',
            },
          ],
          text: 'Secondary Emergency Contact',
        },
      ],
    };
    if (secName) contact.name = { text: secName };
    if (secPhone) contact.telecom = [{ system: 'phone', value: secPhone, use: 'mobile' }];
    contacts.push(contact);
  }

  const cgName = nonEmptyString(patientData.caregiver_name);
  const cgPhone = nonEmptyString(patientData.caregiver_phone);
  const cgRel = nonEmptyString(patientData.caregiver_relationship);
  if (cgName || cgPhone) {
    const contact = {
      relationship: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
              code: 'N',
              display: 'Next-of-Kin',
            },
          ],
          text: cgRel || 'Caregiver',
        },
      ],
    };
    if (cgName) contact.name = { text: cgName };
    if (cgPhone) contact.telecom = [{ system: 'phone', value: cgPhone, use: 'mobile' }];
    contacts.push(contact);
  }

  return contacts.length > 0 ? contacts : undefined;
}

function buildCommunication(preferredLanguage) {
  const lang = nonEmptyString(preferredLanguage)?.toLowerCase();
  if (!lang) return undefined;
  if (lang === 'fil' || lang === 'tl') {
    return [
      {
        language: {
          coding: [{ system: 'urn:ietf:bcp:47', code: 'fil', display: 'Filipino' }],
          text: 'Filipino / Tagalog',
        },
        preferred: true,
      },
    ];
  }
  if (lang === 'en') {
    return [
      {
        language: {
          coding: [{ system: 'urn:ietf:bcp:47', code: 'en', display: 'English' }],
          text: 'English',
        },
        preferred: true,
      },
    ];
  }
  return undefined;
}

function buildObservationCode(code, display, system = 'http://loinc.org') {
  return {
    coding: [{ system, code, display }],
    text: display,
  };
}

export function buildOrganizationResource() {
  return {
    resourceType: 'Organization',
    id: ORGANIZATION_ID,
    active: true,
    name: 'MuntiCares Home Care Coordination',
    telecom: [{ system: 'email', value: 'support@munticares.ph', use: 'work' }],
    address: [
      {
        use: 'work',
        city: 'Muntinlupa City',
        state: 'Metro Manila',
        country: 'PH',
        text: 'Muntinlupa City, Metro Manila, Philippines',
      },
    ],
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
  };
}

export function buildPatientResource(userData = {}, patientData = null) {
  const id = sanitizeFhirId(userData?.id || patientData?.user_id, 'patient');
  const name = buildName(userData?.full_name || userData?.fullName);
  const telecom = buildTelecom(userData?.email, patientData?.phone);
  const birthDate = toValidFhirDate(patientData?.date_of_birth);
  const address = buildAddress(patientData);
  const contact = buildPatientContacts(patientData);
  const communication = buildCommunication(patientData?.preferred_language);
  const lastUpdated =
    toValidIsoInstant(patientData?.updated_at) ||
    toValidIsoInstant(userData?.updated_at) ||
    toValidIsoInstant(userData?.created_at);

  const resource = {
    resourceType: 'Patient',
    id,
    active: true,
  };

  if (name) resource.name = name;
  if (telecom) resource.telecom = telecom;
  if (birthDate) resource.birthDate = birthDate;
  if (address) resource.address = address;
  if (contact) resource.contact = contact;
  if (communication) resource.communication = communication;

  resource.meta = {
    tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    ...(lastUpdated ? { lastUpdated } : {}),
  };

  return resource;
}

export function buildVitalSignObservations(visitNotes, patientId) {
  if (!visitNotes?.length) return [];

  const pid = sanitizeFhirId(patientId, 'patient');
  const observations = [];

  visitNotes.forEach((note, index) => {
    const noteKey = sanitizeFhirId(note?.id, `note-${index + 1}`).slice(0, 56);
    const effectiveDateTime = toValidIsoInstant(note?.created_at);
    const base = {
      status: 'final',
      subject: { reference: `Patient/${pid}` },
      ...(effectiveDateTime ? { effectiveDateTime } : {}),
      meta: {
        tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
      },
    };

    if (note?.vitals_bp) {
      const parts = String(note.vitals_bp).split('/');
      const systolic = toFiniteNumber(parts[0]);
      const diastolic = toFiniteNumber(parts[1]);
      const component = [];
      if (systolic != null) {
        component.push({
          code: buildObservationCode('8480-6', 'Systolic blood pressure'),
          valueQuantity: {
            value: systolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        });
      }
      if (diastolic != null) {
        component.push({
          code: buildObservationCode('8462-4', 'Diastolic blood pressure'),
          valueQuantity: {
            value: diastolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        });
      }
      if (component.length > 0) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: sanitizeFhirId(`${noteKey}-bp`),
          code: buildObservationCode('85354-9', 'Blood pressure panel'),
          category: VITAL_SIGNS_CATEGORY,
          component,
        });
      }
    }

    if (note?.vitals_temp != null && note.vitals_temp !== '') {
      const value = toFiniteNumber(note.vitals_temp);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: sanitizeFhirId(`${noteKey}-temp`),
          code: buildObservationCode('8310-5', 'Body temperature'),
          category: VITAL_SIGNS_CATEGORY,
          valueQuantity: {
            value,
            unit: '°C',
            system: 'http://unitsofmeasure.org',
            code: 'Cel',
          },
        });
      }
    }

    if (note?.vitals_hr != null && note.vitals_hr !== '') {
      const value = toFiniteNumber(note.vitals_hr);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: sanitizeFhirId(`${noteKey}-hr`),
          code: buildObservationCode('8867-4', 'Heart rate'),
          category: VITAL_SIGNS_CATEGORY,
          valueQuantity: {
            value,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min',
          },
        });
      }
    }

    if (note?.vitals_rr != null && note.vitals_rr !== '') {
      const value = toFiniteNumber(note.vitals_rr);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: sanitizeFhirId(`${noteKey}-rr`),
          code: buildObservationCode('9279-1', 'Respiratory rate'),
          category: VITAL_SIGNS_CATEGORY,
          valueQuantity: {
            value,
            unit: 'breaths/min',
            system: 'http://unitsofmeasure.org',
            code: '/min',
          },
        });
      }
    }

    if (note?.vitals_spo2 != null && note.vitals_spo2 !== '') {
      const value = toFiniteNumber(note.vitals_spo2);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: sanitizeFhirId(`${noteKey}-spo2`),
          code: buildObservationCode('59408-5', 'Oxygen saturation in Arterial blood by Pulse oximetry'),
          category: VITAL_SIGNS_CATEGORY,
          valueQuantity: {
            value,
            unit: '%',
            system: 'http://unitsofmeasure.org',
            code: '%',
          },
        });
      }
    }

    if (note?.pain_scale != null && note.pain_scale !== '') {
      const value = toFiniteNumber(note.pain_scale);
      if (value != null) {
        observations.push({
          ...base,
          resourceType: 'Observation',
          id: sanitizeFhirId(`${noteKey}-pain`),
          code: buildObservationCode('72514-3', 'Pain severity - 0-10 verbal numeric rating'),
          category: SURVEY_CATEGORY,
          valueQuantity: {
            value,
            unit: '{score}',
            system: 'http://unitsofmeasure.org',
            code: '{score}',
          },
        });
      }
    }
  });

  return observations;
}

export function buildBloodTypeObservation(medicalHistory, patientId) {
  const raw = nonEmptyString(medicalHistory?.blood_type)?.toUpperCase();
  if (!raw || !ALLOWED_BLOOD_TYPES.has(raw)) return null;
  const pid = sanitizeFhirId(patientId, 'patient');
  const effectiveDateTime = toValidIsoInstant(medicalHistory?.updated_at);
  return {
    resourceType: 'Observation',
    id: sanitizeFhirId(`bloodtype-${shortPatientKey(pid)}`),
    status: 'final',
    category: LABORATORY_CATEGORY,
    code: buildObservationCode('882-1', 'ABO and Rh group [Type] in Blood'),
    subject: { reference: `Patient/${pid}` },
    ...(effectiveDateTime ? { effectiveDateTime } : {}),
    valueCodeableConcept: {
      text: raw,
    },
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
  };
}

export function buildConditionResources(medicalHistory, patientId) {
  const items = splitListValues(medicalHistory?.chronic_conditions);
  if (items.length === 0) return [];
  const pid = sanitizeFhirId(patientId, 'patient');
  const pKey = shortPatientKey(pid);

  return items.map((condition, idx) => ({
    resourceType: 'Condition',
    id: sanitizeFhirId(`cond-${pKey}-${idx + 1}`),
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'unconfirmed',
          display: 'Unconfirmed',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'problem-list-item',
            display: 'Problem List Item',
          },
        ],
      },
    ],
    code: { text: condition },
    subject: { reference: `Patient/${pid}` },
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
  }));
}

export function buildAllergyResources(medicalHistory, patientId) {
  const items = splitListValues(medicalHistory?.allergies);
  if (items.length === 0) return [];
  const pid = sanitizeFhirId(patientId, 'patient');
  const pKey = shortPatientKey(pid);

  return items.map((allergy, idx) => ({
    resourceType: 'AllergyIntolerance',
    id: sanitizeFhirId(`allergy-${pKey}-${idx + 1}`),
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: 'unconfirmed',
          display: 'Unconfirmed',
        },
      ],
    },
    type: 'allergy',
    code: { text: allergy },
    patient: { reference: `Patient/${pid}` },
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
  }));
}

export function buildMedicationStatements(medicalHistory, patientId) {
  const items = splitListValues(medicalHistory?.medications, { preferLines: true });
  if (items.length === 0) return [];
  const pid = sanitizeFhirId(patientId, 'patient');
  const pKey = shortPatientKey(pid);

  return items.map((med, idx) => ({
    resourceType: 'MedicationStatement',
    id: sanitizeFhirId(`med-${pKey}-${idx + 1}`),
    status: 'active',
    medicationCodeableConcept: { text: med },
    subject: { reference: `Patient/${pid}` },
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
  }));
}

export function buildProcedureResources(medicalHistory, patientId) {
  const items = splitListValues(medicalHistory?.past_surgeries);
  if (items.length === 0) return [];
  const pid = sanitizeFhirId(patientId, 'patient');
  const pKey = shortPatientKey(pid);

  return items.map((surgery, idx) => ({
    resourceType: 'Procedure',
    id: sanitizeFhirId(`proc-${pKey}-${idx + 1}`),
    status: 'completed',
    code: { text: surgery },
    subject: { reference: `Patient/${pid}` },
    meta: {
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
  }));
}

export function buildVisitEncounterResources(visitNotes, patientId) {
  if (!visitNotes?.length) return [];
  const pid = sanitizeFhirId(patientId, 'patient');
  const resources = [];

  visitNotes.forEach((note, index) => {
    const services = nonEmptyString(note?.services_rendered);
    const clinicalText = nonEmptyString(note?.notes);
    if (!services && !clinicalText) return;

    const noteKey = sanitizeFhirId(note?.id, `visit-${index + 1}`).slice(0, 52);
    const encounterId = sanitizeFhirId(`enc-${noteKey}`);
    const visitDate = toValidIsoInstant(note?.created_at);

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'HH',
        display: 'home health',
      },
      subject: { reference: `Patient/${pid}` },
      meta: {
        tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
      },
    };

    if (services) {
      encounter.type = [{ text: services }];
    }
    if (visitDate) {
      encounter.period = { start: visitDate };
    }
    resources.push(encounter);

    if (clinicalText) {
      const encoded = toBase64Utf8(clinicalText);
      const attachment = {
        contentType: 'text/plain',
        title: services ? `Home Visit Note — ${services}` : 'Home Visit Clinical Note',
        ...(encoded ? { data: encoded } : {}),
        ...(visitDate ? { creation: visitDate } : {}),
      };

      resources.push({
        resourceType: 'DocumentReference',
        id: sanitizeFhirId(`note-doc-${noteKey}`),
        status: 'current',
        type: {
          coding: [{ system: 'http://loinc.org', code: '11506-3', display: 'Progress note' }],
          text: 'Home Visit Clinical Note',
        },
        category: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
                code: 'clinical-note',
                display: 'Clinical Note',
              },
            ],
            text: 'Clinical Note',
          },
        ],
        subject: { reference: `Patient/${pid}` },
        ...(visitDate ? { date: visitDate } : {}),
        description: clinicalText.slice(0, 500),
        content: [{ attachment }],
        context: {
          encounter: [{ reference: `Encounter/${encounterId}` }],
        },
        meta: {
          tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
        },
      });
    }
  });

  return resources;
}

/**
 * Metadata-only DocumentReference builder for uploaded patient documents.
 * Deliberately omits signed storage URLs to protect private medical documents under RA 10173.
 */
export function buildDocumentReferences(documents, patientId) {
  if (!documents?.length) return [];
  const pid = sanitizeFhirId(patientId, 'patient');
  const pKey = shortPatientKey(pid);

  return documents
    .map((doc, idx) => {
      const title = nonEmptyString(doc?.document_title) || `Medical Document ${idx + 1}`;
      const uploadedAt = toValidIsoInstant(doc?.uploaded_at);
      const docId = sanitizeFhirId(doc?.id, `doc-${pKey}-${idx + 1}`);
      const contentType = inferMimeType(title);

      return {
        resourceType: 'DocumentReference',
        id: docId,
        status: 'current',
        type: {
          coding: [{ system: 'http://loinc.org', code: '51852-2', display: 'Other document' }],
          text: 'Patient Uploaded Medical Document',
        },
        subject: { reference: `Patient/${pid}` },
        ...(uploadedAt ? { date: uploadedAt } : {}),
        description:
          'Metadata-only record. File binary is stored privately in MuntiCares (RA 10173 protected; direct storage URL omitted from portable export).',
        content: [
          {
            attachment: {
              contentType,
              title,
              ...(uploadedAt ? { creation: uploadedAt } : {}),
            },
          },
        ],
        meta: {
          tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
        },
      };
    })
    .filter(Boolean);
}

export function buildConsentResources(consents, patientId) {
  if (!consents?.length) return [];
  const pid = sanitizeFhirId(patientId, 'patient');
  const pKey = shortPatientKey(pid);

  return consents.map((grant, idx) => {
    const isEnabled = grant?.is_enabled === true;
    const expiresAt = toValidIsoInstant(grant?.expires_at);
    const updatedAt = toValidIsoInstant(grant?.updated_at || grant?.created_at);
    const perms = grant?.permissions || {};
    const grantedScopes = Object.entries(perms)
      .filter(([, allowed]) => allowed === true)
      .map(([key]) => key);

    const consentId = sanitizeFhirId(grant?.id, `consent-${pKey}-${idx + 1}`);

    const provision = {
      type: isEnabled ? 'permit' : 'deny',
      ...(expiresAt ? { period: { end: expiresAt } } : {}),
      ...(grantedScopes.length > 0
        ? {
            class: grantedScopes.map((scope) => ({
              system: `${SYSTEM_BASE}/consent-categories`,
              code: scope,
              display: scope.replace(/_/g, ' '),
            })),
          }
        : {}),
    };

    const resource = {
      resourceType: 'Consent',
      id: consentId,
      status: isEnabled ? 'active' : 'inactive',
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
            display: 'Privacy Consent',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://loinc.org',
              code: '59284-0',
              display: 'Patient Consent',
            },
          ],
          text: 'RA 10173 Data Privacy Act Consent',
        },
      ],
      patient: { reference: `Patient/${pid}` },
      ...(updatedAt ? { dateTime: updatedAt } : {}),
      policyRule: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'OPTIN',
            display: 'opt-in',
          },
        ],
        text: 'Republic Act No. 10173 — Deny-by-default expiring health record consent',
      },
      provision,
      meta: {
        tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
      },
    };

    return resource;
  });
}

function summarizeResourceForNarrative(res) {
  switch (res.resourceType) {
    case 'AllergyIntolerance':
    case 'Condition':
    case 'Procedure':
      return res.code?.text || res.code?.coding?.[0]?.display || res.resourceType;
    case 'MedicationStatement':
      return (
        res.medicationCodeableConcept?.text ||
        res.medicationCodeableConcept?.coding?.[0]?.display ||
        'Medication'
      );
    case 'Observation': {
      const label = res.code?.text || res.code?.coding?.[0]?.display || 'Observation';
      if (res.valueQuantity) {
        return `${label}: ${res.valueQuantity.value} ${res.valueQuantity.unit || ''}`.trim();
      }
      if (res.valueCodeableConcept?.text) {
        return `${label}: ${res.valueCodeableConcept.text}`;
      }
      if (Array.isArray(res.component) && res.component.length > 0) {
        const vals = res.component
          .map((c) => c.valueQuantity?.value)
          .filter((v) => v != null)
          .join('/');
        return `${label}: ${vals} mmHg`;
      }
      return label;
    }
    case 'Encounter':
      return res.type?.[0]?.text || 'Home Health Visit';
    case 'DocumentReference':
      return res.content?.[0]?.attachment?.title || res.type?.text || 'Medical Document';
    case 'Consent':
      return `${res.status === 'active' ? 'Active' : 'Paused'} RA 10173 Consent`;
    default:
      return res.id || res.resourceType;
  }
}

function buildSection({ title, code, display, resources, emptyMessage, required = false }) {
  if (!required && resources.length === 0) return null;

  const section = {
    title,
    code: {
      coding: [{ system: 'http://loinc.org', code, display }],
    },
    text: buildNarrative(resources.map(summarizeResourceForNarrative), emptyMessage),
  };

  if (resources.length > 0) {
    section.entry = resources.map((r) => ({ reference: `${r.resourceType}/${r.id}` }));
  } else {
    section.emptyReason = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason',
          code: 'nilknown',
          display: 'Nil Known',
        },
      ],
      text: emptyMessage,
    };
  }

  return section;
}

export function buildCompositionResource(resources, { now, patientResource, organizationResource }) {
  const patientId = patientResource?.id || 'patient';
  const patientName = patientResource?.name?.[0]?.text;
  const orgId = organizationResource?.id || ORGANIZATION_ID;

  const allergies = resources.filter((r) => r.resourceType === 'AllergyIntolerance');
  const medications = resources.filter((r) => r.resourceType === 'MedicationStatement');
  const conditions = resources.filter((r) => r.resourceType === 'Condition');
  const observations = resources.filter((r) => r.resourceType === 'Observation');
  const procedures = resources.filter((r) => r.resourceType === 'Procedure');
  const clinicalNotes = resources.filter(
    (r) =>
      r.resourceType === 'Encounter' ||
      (r.resourceType === 'DocumentReference' && r.type?.coding?.[0]?.code === '11506-3')
  );
  const documents = resources.filter(
    (r) => r.resourceType === 'DocumentReference' && r.type?.coding?.[0]?.code !== '11506-3'
  );
  const consents = resources.filter((r) => r.resourceType === 'Consent');

  const sections = [
    buildSection({
      title: 'Allergies and Intolerances',
      code: '48765-2',
      display: 'Allergies and adverse reactions Document',
      resources: allergies,
      emptyMessage: 'No known allergies recorded.',
      required: true,
    }),
    buildSection({
      title: 'Medication Summary',
      code: '10160-0',
      display: 'History of Medication use Narrative',
      resources: medications,
      emptyMessage: 'No current medications recorded.',
      required: true,
    }),
    buildSection({
      title: 'Problem List',
      code: '11450-4',
      display: 'Problem list - Reported',
      resources: conditions,
      emptyMessage: 'No active chronic conditions recorded.',
      required: true,
    }),
    buildSection({
      title: 'Vital Signs',
      code: '8716-3',
      display: 'Vital signs',
      resources: observations,
      emptyMessage: 'No vital signs recorded.',
    }),
    buildSection({
      title: 'History of Procedures',
      code: '47519-4',
      display: 'History of Procedures Document',
      resources: procedures,
      emptyMessage: 'No past surgeries or procedures recorded.',
    }),
    buildSection({
      title: 'Home Visit Encounters & Clinical Notes',
      code: '46240-8',
      display: 'History of hospitalizations+Outpatient visits Narrative',
      resources: clinicalNotes,
      emptyMessage: 'No clinical visit notes recorded.',
    }),
    buildSection({
      title: 'Medical Documents',
      code: '55107-7',
      display: 'Addendum Document',
      resources: documents,
      emptyMessage: 'No uploaded medical documents.',
    }),
    buildSection({
      title: 'Patient Privacy Consents (RA 10173)',
      code: '57016-8',
      display: 'Privacy policy acknowledgment Document',
      resources: consents,
      emptyMessage: 'No active provider consent grants.',
    }),
  ].filter(Boolean);

  const subject = { reference: `Patient/${patientId}` };
  if (patientName) subject.display = patientName;

  return {
    resourceType: 'Composition',
    id: sanitizeFhirId(`ips-comp-${shortPatientKey(patientId)}`),
    meta: {
      profile: [IPS_COMPOSITION_PROFILE],
      tag: [{ system: `${SYSTEM_BASE}/tags`, code: 'munticares' }],
    },
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '60591-5',
          display: 'Patient summary Document',
        },
      ],
      text: 'International Patient Summary',
    },
    subject,
    date: now,
    author: [
      {
        reference: `Organization/${orgId}`,
        display: organizationResource?.name || 'MuntiCares Home Care Coordination',
      },
    ],
    title: 'MuntiCares International Patient Summary (IPS)',
    confidentiality: 'N',
    custodian: {
      reference: `Organization/${orgId}`,
      display: organizationResource?.name || 'MuntiCares Home Care Coordination',
    },
    section: sections,
  };
}

/**
 * Wraps resources in a strict HL7 FHIR R4 IPS `document` Bundle.
 * Ensures Entry #0 is a valid `Composition` (`LOINC 60591-5`) and includes an `Organization` author.
 */
export function buildBundle(resources = [], options = {}) {
  const now = toValidIsoInstant(options.timestamp) || new Date().toISOString();
  const bundleId = sanitizeFhirId(options.id || `munticares-ips-${Date.now()}`);

  const clinicalResources = (resources || []).filter(
    (r) => r && r.resourceType && r.resourceType !== 'Composition'
  );
  const existingOrg = clinicalResources.find((r) => r.resourceType === 'Organization');
  const organizationResource = existingOrg || buildOrganizationResource();
  const patientResource = clinicalResources.find((r) => r.resourceType === 'Patient');

  const orderedEntries = [];
  if (patientResource) {
    const composition = buildCompositionResource(clinicalResources, {
      now,
      patientResource,
      organizationResource,
    });
    orderedEntries.push(composition);
  }

  orderedEntries.push(...clinicalResources);
  if (!existingOrg && patientResource) {
    orderedEntries.push(organizationResource);
  }

  // Deduplicate by resourceType/id
  const seen = new Set();
  const uniqueEntries = [];
  for (const r of orderedEntries) {
    const key = `${r.resourceType}/${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEntries.push(r);
  }

  const bundle = {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      profile: [IPS_BUNDLE_PROFILE],
      lastUpdated: now,
    },
    identifier: {
      system: `${SYSTEM_BASE}/bundles`,
      value: bundleId,
    },
    type: patientResource ? 'document' : 'collection',
    timestamp: now,
  };

  if (uniqueEntries.length > 0) {
    bundle.entry = uniqueEntries.map((r) => ({
      fullUrl: `${SYSTEM_BASE}/${r.resourceType}/${r.id}`,
      resource: r,
    }));
  }

  return bundle;
}

/**
 * High-level builder assembling a complete MuntiCares HL7 FHIR R4 IPS document Bundle
 * from raw database records.
 */
export function buildIpsBundle({
  userData,
  patientData = null,
  medicalHistory = null,
  visitNotes = [],
  documents = [],
  consents = [],
  timestamp = null,
}) {
  const patientId = userData?.id || patientData?.user_id || 'patient';
  const resources = [];

  resources.push(buildPatientResource(userData, patientData));

  if (medicalHistory) {
    resources.push(...buildAllergyResources(medicalHistory, patientId));
    resources.push(...buildMedicationStatements(medicalHistory, patientId));
    resources.push(...buildConditionResources(medicalHistory, patientId));
    resources.push(...buildProcedureResources(medicalHistory, patientId));
    const bloodTypeObs = buildBloodTypeObservation(medicalHistory, patientId);
    if (bloodTypeObs) resources.push(bloodTypeObs);
  }

  if (visitNotes?.length) {
    resources.push(...buildVitalSignObservations(visitNotes, patientId));
    resources.push(...buildVisitEncounterResources(visitNotes, patientId));
  }

  if (documents?.length) {
    resources.push(...buildDocumentReferences(documents, patientId));
  }

  if (consents?.length) {
    resources.push(...buildConsentResources(consents, patientId));
  }

  return buildBundle(resources, { timestamp });
}
