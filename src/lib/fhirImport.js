import { validateFhirBundle } from './fhirValidator';
import { formatEmergencyContact } from '@/features/patient/utils/patientProfile';

const ALLOWED_BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function decodeBase64Utf8(b64) {
  if (typeof b64 !== 'string' || !b64.trim()) return '';
  try {
    if (typeof atob === 'function' && typeof TextDecoder !== 'undefined') {
      const binary = atob(b64.trim());
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes).trim();
    }
    if (typeof globalThis.Buffer !== 'undefined') {
      return globalThis.Buffer.from(b64.trim(), 'base64').toString('utf8').trim();
    }
  } catch {
    return '';
  }
  return '';
}

function splitExistingList(raw, { lineMode = false } = {}) {
  const cleaned = cleanText(raw);
  if (!cleaned) return [];
  const sep = lineMode && /[\n;]/.test(cleaned) ? /[\n;]+/ : /[,\n;]+/;
  return cleaned
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deduplicates incoming items against current items (case-insensitive)
 * and returns the merged string plus only the genuinely new additions.
 */
export function mergeUniqueList(currentRaw, incomingItems, { joiner = ', ', lineMode = false } = {}) {
  const existing = splitExistingList(currentRaw, { lineMode });
  const seen = new Set(existing.map((item) => item.toLowerCase()));
  const newItems = [];

  for (const raw of incomingItems || []) {
    const item = cleanText(raw);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    newItems.push(item);
  }

  const combined = [...existing, ...newItems];
  return {
    existingItems: existing,
    incomingItems: Array.from(
      new Map(
        (incomingItems || [])
          .map((i) => cleanText(i))
          .filter(Boolean)
          .map((i) => [i.toLowerCase(), i])
      ).values()
    ),
    newItems,
    mergedValue: combined.join(joiner),
    hasChanges: newItems.length > 0,
  };
}

function extractPatientName(patient) {
  const name = patient?.name?.[0];
  if (!name) return '';
  if (cleanText(name.text)) return cleanText(name.text);
  const given = Array.isArray(name.given) ? name.given.join(' ').trim() : '';
  const family = cleanText(name.family);
  return [given, family].filter(Boolean).join(' ').trim();
}

function extractAddressText(patient) {
  const addr = patient?.address?.[0];
  if (!addr) return '';
  if (cleanText(addr.text)) return cleanText(addr.text);
  const parts = [
    ...(Array.isArray(addr.line) ? addr.line : []),
    addr.city,
    addr.state,
    addr.postalCode,
    addr.country,
  ]
    .map((p) => cleanText(p))
    .filter(Boolean);
  return parts.join(', ');
}

function extractEmergencyContact(patient) {
  const contacts = Array.isArray(patient?.contact) ? patient.contact : [];
  if (contacts.length === 0) return { name: '', phone: '' };
  const preferred =
    contacts.find((c) =>
      c.relationship?.some((r) =>
        r.coding?.some((cd) => cd.code === 'C') || /emergency/i.test(r.text || '')
      )
    ) || contacts[0];

  const name =
    cleanText(preferred?.name?.text) ||
    [
      ...(Array.isArray(preferred?.name?.given) ? preferred.name.given : []),
      preferred?.name?.family,
    ]
      .map((p) => cleanText(p))
      .filter(Boolean)
      .join(' ');

  const phone =
    cleanText(preferred?.telecom?.find((t) => t.system === 'phone')?.value) || '';

  return { name, phone };
}

function extractCodeLabel(codeable) {
  if (!codeable || typeof codeable !== 'object') return '';
  if (cleanText(codeable.text)) return cleanText(codeable.text);
  const coding = codeable.coding?.[0];
  return cleanText(coding?.display) || cleanText(coding?.code) || '';
}

function extractMedicationLabel(res) {
  const base = extractCodeLabel(res.medicationCodeableConcept);
  const dosage = cleanText(res.dosage?.[0]?.text || res.dosageInstruction?.[0]?.text);
  if (base && dosage && !base.toLowerCase().includes(dosage.toLowerCase())) {
    return `${base} — ${dosage}`;
  }
  return base || dosage;
}

function formatVitalObservation(obs) {
  const label = extractCodeLabel(obs.code) || 'Vital Sign';
  const datePart = obs.effectiveDateTime ? String(obs.effectiveDateTime).slice(0, 10) : '';

  if (Array.isArray(obs.component) && obs.component.length > 0) {
    const sys = obs.component.find((c) =>
      c.code?.coding?.some((cd) => cd.code === '8480-6')
    )?.valueQuantity?.value;
    const dia = obs.component.find((c) =>
      c.code?.coding?.some((cd) => cd.code === '8462-4')
    )?.valueQuantity?.value;
    const vals =
      sys != null && dia != null
        ? `${sys}/${dia} mmHg`
        : obs.component
            .map((c) => c.valueQuantity?.value)
            .filter((v) => v != null)
            .join('/');
    return {
      label: 'Blood Pressure',
      value: vals,
      date: datePart,
      line: `BP ${vals}${datePart ? ` (${datePart})` : ''}`,
    };
  }

  if (obs.valueQuantity && obs.valueQuantity.value != null) {
    const unit = cleanText(obs.valueQuantity.unit) || cleanText(obs.valueQuantity.code);
    const formatted = `${obs.valueQuantity.value}${unit && !unit.startsWith('{') ? ` ${unit}` : ''}`.trim();
    return {
      label,
      value: formatted,
      date: datePart,
      line: `${label}: ${formatted}${datePart ? ` (${datePart})` : ''}`,
    };
  }

  return null;
}

function isBloodTypeObservation(obs) {
  if (obs.code?.coding?.some((c) => c.code === '882-1')) return true;
  const label = extractCodeLabel(obs.code);
  return /blood\s*type|abo\s*and\s*rh/i.test(label);
}

/**
 * Parses any FHIR R4 Bundle (document, collection, or transaction) and produces a
 * category-by-category merge preview against the patient's current MuntiCares profile.
 */
export function parseFhirBundleForImport(bundle, currentProfile = {}) {
  const validation = validateFhirBundle(bundle);
  if (!validation.valid) {
    return {
      validation,
      patientDisplayName: '',
      sourceFacility: '',
      generatedAt: '',
      categories: [],
      hasMergeableChanges: false,
    };
  }

  const resources = (bundle.entry || []).map((e) => e?.resource).filter(Boolean);
  const composition = resources.find((r) => r.resourceType === 'Composition');
  const organization = resources.find((r) => r.resourceType === 'Organization');
  const patient = resources.find((r) => r.resourceType === 'Patient');

  const patientDisplayName = extractPatientName(patient) || cleanText(composition?.subject?.display);
  const sourceFacility =
    cleanText(organization?.name) || cleanText(composition?.author?.[0]?.display) || '';
  const generatedAt = cleanText(composition?.date || bundle.timestamp);

  // 1. Demographics & Emergency Contact
  const incomingPhone =
    cleanText(patient?.telecom?.find((t) => t.system === 'phone')?.value) || '';
  const incomingDob = cleanText(patient?.birthDate).slice(0, 10);
  const incomingAddress = extractAddressText(patient);
  const incomingEmergency = extractEmergencyContact(patient);

  const demoDiffs = [];
  if (incomingPhone && incomingPhone !== cleanText(currentProfile.phone)) {
    demoDiffs.push({
      field: 'phone',
      current: cleanText(currentProfile.phone),
      incoming: incomingPhone,
    });
  }
  if (incomingDob && /^\d{4}-\d{2}-\d{2}$/.test(incomingDob) && incomingDob !== cleanText(currentProfile.date_of_birth)) {
    demoDiffs.push({
      field: 'date_of_birth',
      current: cleanText(currentProfile.date_of_birth),
      incoming: incomingDob,
    });
  }
  if (incomingAddress && incomingAddress !== cleanText(currentProfile.address)) {
    demoDiffs.push({
      field: 'address',
      current: cleanText(currentProfile.address),
      incoming: incomingAddress,
    });
  }
  const incomingEmergencyStr = formatEmergencyContact(
    incomingEmergency.name,
    incomingEmergency.phone
  );
  const currentEmergencyStr = formatEmergencyContact(
    currentProfile.emergency_contact_name,
    currentProfile.emergency_contact_phone
  ) || cleanText(currentProfile.emergency_contact);
  if (incomingEmergencyStr && incomingEmergencyStr !== currentEmergencyStr) {
    demoDiffs.push({
      field: 'emergency_contact',
      current: currentEmergencyStr,
      incoming: incomingEmergencyStr,
      name: incomingEmergency.name,
      phone: incomingEmergency.phone,
    });
  }

  // 2. Allergies
  const incomingAllergies = resources
    .filter((r) => r.resourceType === 'AllergyIntolerance')
    .map((r) => extractCodeLabel(r.code))
    .filter(Boolean);
  const allergiesMerge = mergeUniqueList(currentProfile.allergies, incomingAllergies, {
    joiner: ', ',
  });

  // 3. Chronic Conditions
  const incomingConditions = resources
    .filter((r) => r.resourceType === 'Condition')
    .map((r) => extractCodeLabel(r.code))
    .filter(Boolean);
  const conditionsMerge = mergeUniqueList(currentProfile.chronic_conditions, incomingConditions, {
    joiner: ', ',
  });

  // 4. Current Medications (MedicationStatement or MedicationRequest)
  const incomingMedications = resources
    .filter(
      (r) =>
        r.resourceType === 'MedicationStatement' || r.resourceType === 'MedicationRequest'
    )
    .map(extractMedicationLabel)
    .filter(Boolean);
  const medicationsMerge = mergeUniqueList(currentProfile.medications, incomingMedications, {
    joiner: '\n',
    lineMode: true,
  });

  // 5. Past Surgeries / Procedures
  const incomingProcedures = resources
    .filter((r) => r.resourceType === 'Procedure')
    .map((r) => extractCodeLabel(r.code))
    .filter(Boolean);
  const proceduresMerge = mergeUniqueList(currentProfile.past_surgeries, incomingProcedures, {
    joiner: ', ',
  });

  // 6. Blood Type Observation
  const bloodTypeObs = resources.find(
    (r) => r.resourceType === 'Observation' && isBloodTypeObservation(r)
  );
  const rawBloodType = (
    extractCodeLabel(bloodTypeObs?.valueCodeableConcept) ||
    cleanText(bloodTypeObs?.valueString)
  ).toUpperCase();
  const incomingBloodType = ALLOWED_BLOOD_TYPES.has(rawBloodType) ? rawBloodType : '';
  const currentBloodType = cleanText(currentProfile.blood_type).toUpperCase();
  const bloodTypeChanged = Boolean(incomingBloodType && incomingBloodType !== currentBloodType);

  // 7. Discharge Vitals & Clinical Notes (read-only preview -> optional append to patients.medical_notes)
  const vitalsItems = resources
    .filter((r) => r.resourceType === 'Observation' && !isBloodTypeObservation(r))
    .map(formatVitalObservation)
    .filter(Boolean);

  const clinicalNoteLines = resources
    .filter(
      (r) =>
        r.resourceType === 'DocumentReference' &&
        (r.type?.coding?.[0]?.code === '11506-3' ||
          r.content?.[0]?.attachment?.contentType === 'text/plain')
    )
    .map((doc) => {
      const attachment = doc.content?.[0]?.attachment;
      const decoded = attachment?.data ? decodeBase64Utf8(attachment.data) : '';
      return decoded || cleanText(doc.description);
    })
    .filter(Boolean);

  const summaryParts = [];
  if (vitalsItems.length > 0) {
    summaryParts.push(`Vitals: ${vitalsItems.slice(0, 8).map((v) => v.line).join('; ')}`);
  }
  if (clinicalNoteLines.length > 0) {
    summaryParts.push(`Notes: ${clinicalNoteLines.slice(0, 2).join(' | ')}`);
  }

  const headerTag = sourceFacility
    ? `Imported FHIR summary (${sourceFacility}${generatedAt ? `, ${generatedAt.slice(0, 10)}` : ''}):`
    : `Imported FHIR summary${generatedAt ? ` (${generatedAt.slice(0, 10)})` : ''}:`;
  const formattedSummaryBlock =
    summaryParts.length > 0 ? `${headerTag}\n${summaryParts.join('\n')}` : '';

  const currentNotes = cleanText(currentProfile.medical_notes);
  const summaryAlreadyPresent =
    Boolean(formattedSummaryBlock) &&
    currentNotes.toLowerCase().includes(summaryParts[0].toLowerCase());

  const categories = [];

  if (demoDiffs.length > 0) {
    categories.push({
      key: 'demographics',
      defaultSelected: true,
      hasChanges: true,
      newCount: demoDiffs.length,
      diffs: demoDiffs,
      payload: {
        phone: incomingPhone,
        date_of_birth: incomingDob,
        address: incomingAddress,
        emergency_contact_name: incomingEmergency.name,
        emergency_contact_phone: incomingEmergency.phone,
      },
    });
  }

  if (allergiesMerge.incomingItems.length > 0) {
    categories.push({
      key: 'allergies',
      defaultSelected: allergiesMerge.hasChanges,
      hasChanges: allergiesMerge.hasChanges,
      newCount: allergiesMerge.newItems.length,
      currentDisplay: cleanText(currentProfile.allergies),
      incomingItems: allergiesMerge.incomingItems,
      newItems: allergiesMerge.newItems,
      mergedValue: allergiesMerge.mergedValue,
    });
  }

  if (conditionsMerge.incomingItems.length > 0) {
    categories.push({
      key: 'chronic_conditions',
      defaultSelected: conditionsMerge.hasChanges,
      hasChanges: conditionsMerge.hasChanges,
      newCount: conditionsMerge.newItems.length,
      currentDisplay: cleanText(currentProfile.chronic_conditions),
      incomingItems: conditionsMerge.incomingItems,
      newItems: conditionsMerge.newItems,
      mergedValue: conditionsMerge.mergedValue,
    });
  }

  if (medicationsMerge.incomingItems.length > 0) {
    categories.push({
      key: 'medications',
      defaultSelected: medicationsMerge.hasChanges,
      hasChanges: medicationsMerge.hasChanges,
      newCount: medicationsMerge.newItems.length,
      currentDisplay: cleanText(currentProfile.medications),
      incomingItems: medicationsMerge.incomingItems,
      newItems: medicationsMerge.newItems,
      mergedValue: medicationsMerge.mergedValue,
    });
  }

  if (proceduresMerge.incomingItems.length > 0) {
    categories.push({
      key: 'past_surgeries',
      defaultSelected: proceduresMerge.hasChanges,
      hasChanges: proceduresMerge.hasChanges,
      newCount: proceduresMerge.newItems.length,
      currentDisplay: cleanText(currentProfile.past_surgeries),
      incomingItems: proceduresMerge.incomingItems,
      newItems: proceduresMerge.newItems,
      mergedValue: proceduresMerge.mergedValue,
    });
  }

  if (incomingBloodType) {
    categories.push({
      key: 'blood_type',
      defaultSelected: bloodTypeChanged,
      hasChanges: bloodTypeChanged,
      newCount: bloodTypeChanged ? 1 : 0,
      currentDisplay: currentBloodType,
      incomingItems: [incomingBloodType],
      newItems: bloodTypeChanged ? [incomingBloodType] : [],
      mergedValue: incomingBloodType,
    });
  }

  if (formattedSummaryBlock) {
    categories.push({
      key: 'discharge_summary',
      defaultSelected: false, // opt-in append to medical_notes; respects provider-only visit_notes RLS
      hasChanges: !summaryAlreadyPresent,
      newCount: summaryAlreadyPresent ? 0 : vitalsItems.length + clinicalNoteLines.length,
      vitalsPreview: vitalsItems,
      notesPreview: clinicalNoteLines,
      formattedSummaryBlock,
    });
  }

  return {
    validation,
    patientDisplayName,
    sourceFacility,
    generatedAt,
    categories,
    hasMergeableChanges: categories.some((c) => c.hasChanges),
  };
}

/**
 * Produces the concrete database update patches (`patients` and `medical_histories`)
 * and updated React profile state for only the user-selected categories.
 */
export function buildMergedProfileUpdate(parsed, selectedKeys, currentProfile = {}) {
  const selected = new Set(selectedKeys || []);
  const byKey = new Map((parsed?.categories || []).map((c) => [c.key, c]));

  const nextProfile = { ...currentProfile };
  const patientPatch = {};
  const medicalHistoryPatch = {};

  if (selected.has('demographics') && byKey.has('demographics')) {
    const demo = byKey.get('demographics');
    for (const diff of demo.diffs) {
      if (diff.field === 'phone') {
        patientPatch.phone = diff.incoming;
        nextProfile.phone = diff.incoming;
      } else if (diff.field === 'date_of_birth') {
        patientPatch.date_of_birth = diff.incoming;
        nextProfile.date_of_birth = diff.incoming;
      } else if (diff.field === 'address') {
        patientPatch.address = diff.incoming;
        nextProfile.address = diff.incoming;
      } else if (diff.field === 'emergency_contact') {
        const name = diff.name || nextProfile.emergency_contact_name || '';
        const phone = diff.phone || nextProfile.emergency_contact_phone || '';
        const combined = formatEmergencyContact(name, phone) || diff.incoming;
        patientPatch.emergency_contact = combined;
        patientPatch.emergency_contact_name = name;
        patientPatch.emergency_contact_phone = phone;
        nextProfile.emergency_contact = combined;
        nextProfile.emergency_contact_name = name;
        nextProfile.emergency_contact_phone = phone;
      }
    }
  }

  if (selected.has('discharge_summary') && byKey.has('discharge_summary')) {
    const summaryCat = byKey.get('discharge_summary');
    if (summaryCat.hasChanges && summaryCat.formattedSummaryBlock) {
      const existingNotes = cleanText(nextProfile.medical_notes);
      const nextNotes = existingNotes
        ? `${existingNotes}\n\n${summaryCat.formattedSummaryBlock}`
        : summaryCat.formattedSummaryBlock;
      patientPatch.medical_notes = nextNotes;
      nextProfile.medical_notes = nextNotes;
    }
  }

  const historyFields = ['allergies', 'chronic_conditions', 'medications', 'past_surgeries', 'blood_type'];
  for (const field of historyFields) {
    if (selected.has(field) && byKey.has(field)) {
      const cat = byKey.get(field);
      if (cat.hasChanges) {
        medicalHistoryPatch[field] = cat.mergedValue;
        nextProfile[field] = cat.mergedValue;
      }
    }
  }

  if (Object.keys(patientPatch).length > 0) {
    const emergencyCombined =
      formatEmergencyContact(nextProfile.emergency_contact_name, nextProfile.emergency_contact_phone) ||
      cleanText(nextProfile.emergency_contact);
    const isComplete = Boolean(
      cleanText(nextProfile.phone) && cleanText(nextProfile.address) && emergencyCombined
    );
    patientPatch.is_profile_complete = isComplete;
    nextProfile.is_profile_complete = isComplete;
  }

  return {
    patientPatch,
    medicalHistoryPatch,
    nextProfile,
    hasPatientUpdate: Object.keys(patientPatch).length > 0,
    hasMedicalHistoryUpdate: Object.keys(medicalHistoryPatch).length > 0,
  };
}
