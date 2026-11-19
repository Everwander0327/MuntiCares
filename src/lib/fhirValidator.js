const VALID_BUNDLE_TYPES = new Set([
  'document',
  'message',
  'transaction',
  'transaction-response',
  'batch',
  'batch-response',
  'history',
  'searchset',
  'collection',
]);

const FHIR_ID_REGEX = /^[A-Za-z0-9-.]{1,64}$/;
const FHIR_DATE_REGEX = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const FHIR_DATETIME_REGEX =
  /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

const IPS_REQUIRED_SECTIONS = [
  { code: '48765-2', label: 'Allergies and Intolerances' },
  { code: '10160-0', label: 'Medication Summary' },
  { code: '11450-4', label: 'Problem List' },
];

function addIssue(list, code, path, message) {
  list.push({ code, path, message });
}

function isIsoDateTimeValid(value) {
  if (typeof value !== 'string' || !FHIR_DATETIME_REGEX.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isFhirDateValid(value) {
  if (typeof value !== 'string' || !FHIR_DATE_REGEX.test(value)) return false;
  if (value.length === 10) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime());
  }
  return true;
}

function checkEle1Recursive(node, path, errors) {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    if (node.trim() === '') {
      addIssue(errors, 'ele-1', path, 'FHIR string elements cannot be empty.');
    }
    return;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) {
      addIssue(errors, 'ele-1', path, 'FHIR arrays must not be empty; omit the property instead.');
      return;
    }
    node.forEach((item, idx) => checkEle1Recursive(item, `${path}[${idx}]`, errors));
    return;
  }
  if (typeof node === 'object') {
    const keys = Object.keys(node);
    if (keys.length === 0) {
      addIssue(errors, 'ele-1', path, 'FHIR objects must not be empty.');
      return;
    }
    for (const key of keys) {
      checkEle1Recursive(node[key], `${path}.${key}`, errors);
    }
  }
}

function collectInternalReferences(resource, path, out) {
  if (!resource || typeof resource !== 'object') return;
  if (Array.isArray(resource)) {
    resource.forEach((item, idx) => collectInternalReferences(item, `${path}[${idx}]`, out));
    return;
  }
  for (const [key, val] of Object.entries(resource)) {
    if (key === 'reference' && typeof val === 'string' && val.trim()) {
      out.push({ path: `${path}.reference`, ref: val.trim() });
    } else if (val && typeof val === 'object') {
      collectInternalReferences(val, `${path}.${key}`, out);
    }
  }
}

function validateResource(res, path, errors, warnings) {
  if (!res || typeof res !== 'object' || Array.isArray(res)) {
    addIssue(errors, 'res-invalid', path, 'Bundle entry resource must be a JSON object.');
    return;
  }

  if (typeof res.resourceType !== 'string' || !res.resourceType.trim()) {
    addIssue(errors, 'res-type', `${path}.resourceType`, 'Missing required resourceType.');
    return;
  }

  if (res.id !== undefined && (typeof res.id !== 'string' || !FHIR_ID_REGEX.test(res.id))) {
    addIssue(
      errors,
      'res-id',
      `${path}.id`,
      `Invalid FHIR id "${res.id}". Must match [A-Za-z0-9-.]{1,64}.`
    );
  }

  switch (res.resourceType) {
    case 'Patient': {
      if (res.birthDate && !isFhirDateValid(res.birthDate)) {
        addIssue(errors, 'pat-dob', `${path}.birthDate`, 'Patient.birthDate must be YYYY, YYYY-MM, or YYYY-MM-DD.');
      }
      if (!res.name?.length) {
        addIssue(warnings, 'pat-name', `${path}.name`, 'Patient resource has no name element.');
      }
      break;
    }

    case 'Composition': {
      if (!res.status) addIssue(errors, 'comp-status', `${path}.status`, 'Composition.status is required.');
      if (!res.type?.coding?.length && !res.type?.text) {
        addIssue(errors, 'comp-type', `${path}.type`, 'Composition.type is required.');
      }
      if (!res.subject?.reference) {
        addIssue(errors, 'comp-subject', `${path}.subject`, 'Composition.subject.reference is required.');
      }
      if (!res.date || !isIsoDateTimeValid(res.date)) {
        addIssue(errors, 'comp-date', `${path}.date`, 'Composition.date must be a valid ISO dateTime.');
      }
      if (!Array.isArray(res.author) || res.author.length === 0) {
        addIssue(errors, 'comp-author', `${path}.author`, 'Composition.author must contain at least one author.');
      }
      if (!res.title) {
        addIssue(errors, 'comp-title', `${path}.title`, 'Composition.title is required.');
      }
      break;
    }

    case 'Observation': {
      if (!res.status) addIssue(errors, 'obs-status', `${path}.status`, 'Observation.status is required.');
      if (!res.code?.coding?.length && !res.code?.text) {
        addIssue(errors, 'obs-code', `${path}.code`, 'Observation.code is required.');
      }
      if (res.effectiveDateTime && !isIsoDateTimeValid(res.effectiveDateTime)) {
        addIssue(errors, 'obs-date', `${path}.effectiveDateTime`, 'Observation.effectiveDateTime must be valid ISO-8601.');
      }
      if (res.valueQuantity) {
        if (typeof res.valueQuantity.value !== 'number' || !Number.isFinite(res.valueQuantity.value)) {
          addIssue(errors, 'obs-val', `${path}.valueQuantity.value`, 'Observation valueQuantity.value must be a finite number.');
        }
        if (res.valueQuantity.system && res.valueQuantity.system !== 'http://unitsofmeasure.org') {
          addIssue(warnings, 'obs-ucum', `${path}.valueQuantity.system`, 'Vital signs should use UCUM units (http://unitsofmeasure.org).');
        }
      }
      if (Array.isArray(res.component)) {
        res.component.forEach((comp, idx) => {
          if (comp.valueQuantity && !Number.isFinite(comp.valueQuantity.value)) {
            addIssue(
              errors,
              'obs-comp-val',
              `${path}.component[${idx}].valueQuantity.value`,
              'Component valueQuantity.value must be a finite number.'
            );
          }
        });
      }
      break;
    }

    case 'Condition': {
      if (!res.subject?.reference) {
        addIssue(errors, 'cond-subject', `${path}.subject`, 'Condition.subject.reference is required.');
      }
      if (!res.code?.text && !res.code?.coding?.length) {
        addIssue(errors, 'cond-code', `${path}.code`, 'Condition.code is required.');
      }
      break;
    }

    case 'AllergyIntolerance': {
      if (!res.patient?.reference) {
        addIssue(errors, 'ait-patient', `${path}.patient`, 'AllergyIntolerance.patient.reference is required.');
      }
      if (!res.code?.text && !res.code?.coding?.length) {
        addIssue(errors, 'ait-code', `${path}.code`, 'AllergyIntolerance.code is required.');
      }
      break;
    }

    case 'MedicationStatement': {
      if (!res.status) {
        addIssue(errors, 'med-status', `${path}.status`, 'MedicationStatement.status is required.');
      }
      if (!res.subject?.reference) {
        addIssue(errors, 'med-subject', `${path}.subject`, 'MedicationStatement.subject.reference is required.');
      }
      if (!res.medicationCodeableConcept && !res.medicationReference) {
        addIssue(
          errors,
          'med-choice',
          `${path}.medication[x]`,
          'MedicationStatement requires medicationCodeableConcept or medicationReference.'
        );
      }
      break;
    }

    case 'Procedure': {
      if (!res.status) addIssue(errors, 'proc-status', `${path}.status`, 'Procedure.status is required.');
      if (!res.subject?.reference) {
        addIssue(errors, 'proc-subject', `${path}.subject`, 'Procedure.subject.reference is required.');
      }
      if (!res.code?.text && !res.code?.coding?.length) {
        addIssue(errors, 'proc-code', `${path}.code`, 'Procedure.code is required.');
      }
      break;
    }

    case 'DocumentReference': {
      if (!res.status) {
        addIssue(errors, 'doc-status', `${path}.status`, 'DocumentReference.status is required.');
      }
      if (!Array.isArray(res.content) || res.content.length === 0) {
        addIssue(errors, 'doc-content', `${path}.content`, 'DocumentReference.content must contain at least one attachment.');
      }
      const typeCode = res.type?.coding?.[0]?.code;
      if (typeof typeCode === 'string' && /^LP\d+/i.test(typeCode)) {
        addIssue(
          errors,
          'doc-loinc-part',
          `${path}.type.coding[0].code`,
          `LOINC Part "${typeCode}" is not a valid DocumentReference.type code.`
        );
      }
      const url = res.content?.[0]?.attachment?.url;
      if (typeof url === 'string' && /token=|sig=|signed/i.test(url)) {
        addIssue(
          warnings,
          'doc-signed-url',
          `${path}.content[0].attachment.url`,
          'Attachment URL appears to contain an expiring signed token; avoid embedding private storage tokens in portable exports.'
        );
      }
      break;
    }

    case 'Consent': {
      if (!res.status) addIssue(errors, 'con-status', `${path}.status`, 'Consent.status is required.');
      if (!res.scope) addIssue(errors, 'con-scope', `${path}.scope`, 'Consent.scope is required.');
      if (!Array.isArray(res.category) || res.category.length === 0) {
        addIssue(errors, 'con-cat', `${path}.category`, 'Consent.category is required.');
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Pure client-side HL7 FHIR R4 + IPS structural validator.
 * Checks root Bundle constraints, ele-1 non-empty invariants, IPS Composition sections,
 * internal reference resolution, and per-resource clinical field requirements.
 */
export function validateFhirBundle(bundle) {
  const errors = [];
  const warnings = [];
  const byType = {};

  const checksTotal = 8;
  let checksPassed = 0;

  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    addIssue(errors, 'root-object', 'Bundle', 'Payload must be a JSON object.');
    return {
      valid: false,
      profile: 'INVALID',
      checksPassed: 0,
      checksTotal,
      summary: {
        totalResources: 0,
        byType,
        bundleType: null,
        hasComposition: false,
        hasPatient: false,
      },
      errors,
      warnings,
    };
  }

  // Check 1: Root Bundle type
  const rootErrorsStart = errors.length;
  if (bundle.resourceType !== 'Bundle') {
    addIssue(errors, 'bdl-resource-type', 'Bundle.resourceType', 'Root resourceType must be "Bundle".');
  }
  if (!VALID_BUNDLE_TYPES.has(bundle.type)) {
    addIssue(
      errors,
      'bdl-type',
      'Bundle.type',
      `Bundle.type must be a valid FHIR R4 BundleType (got "${bundle.type ?? 'undefined'}").`
    );
  }
  if (bundle.timestamp && !isIsoDateTimeValid(bundle.timestamp)) {
    addIssue(errors, 'bdl-timestamp', 'Bundle.timestamp', 'Bundle.timestamp must be a valid ISO-8601 instant.');
  }
  if (errors.length === rootErrorsStart) checksPassed += 1;

  // Check 2: ele-1 empty string / empty array / empty object check
  const eleErrorsStart = errors.length;
  checkEle1Recursive(bundle, 'Bundle', errors);
  if (errors.length === eleErrorsStart) checksPassed += 1;

  // Check 3: Entries array presence and per-entry resource validity
  const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
  const entryErrorsStart = errors.length;
  if (entries.length === 0) {
    addIssue(errors, 'bdl-empty', 'Bundle.entry', 'Bundle must contain at least one resource entry.');
  }

  const fullUrlSet = new Set();
  const relativeRefSet = new Set();

  entries.forEach((item, idx) => {
    const entryPath = `Bundle.entry[${idx}]`;
    if (!item || typeof item !== 'object') {
      addIssue(errors, 'bdl-entry', entryPath, 'Entry must be an object.');
      return;
    }
    if (bundle.type === 'document' && item.request) {
      addIssue(
        errors,
        'bdl-3',
        `${entryPath}.request`,
        'Bundle.entry.request is only permitted in batch or transaction bundles, not document bundles.'
      );
    }
    const res = item.resource;
    validateResource(res, `${entryPath}.resource`, errors, warnings);
    if (res?.resourceType) {
      byType[res.resourceType] = (byType[res.resourceType] || 0) + 1;
      if (res.id) {
        relativeRefSet.add(`${res.resourceType}/${res.id}`);
      }
    }
    if (typeof item.fullUrl === 'string' && item.fullUrl.trim()) {
      fullUrlSet.add(item.fullUrl.trim());
    }
  });
  if (errors.length === entryErrorsStart) checksPassed += 1;

  // Check 4: Patient resource present
  const hasPatient = (byType.Patient || 0) > 0;
  if (hasPatient) {
    checksPassed += 1;
  } else {
    addIssue(errors, 'pat-required', 'Bundle.entry', 'Bundle must include at least one Patient resource.');
  }

  // Check 5: Internal references resolve inside bundle (for document/IPS bundles)
  const refErrorsStart = errors.length;
  const allRefs = [];
  entries.forEach((item, idx) => {
    if (item?.resource) {
      collectInternalReferences(item.resource, `Bundle.entry[${idx}].resource`, allRefs);
    }
  });

  for (const { path, ref } of allRefs) {
    if (ref.startsWith('#')) continue; // contained reference
    const resolved =
      fullUrlSet.has(ref) ||
      relativeRefSet.has(ref) ||
      (ref.startsWith('http') &&
        Array.from(relativeRefSet).some((rel) => ref.endsWith(`/${rel}`)));
    if (!resolved) {
      if (bundle.type === 'document') {
        addIssue(
          errors,
          'bdl-ref-unresolved',
          path,
          `Internal reference "${ref}" does not resolve to an entry in this document Bundle.`
        );
      } else {
        addIssue(
          warnings,
          'bdl-ref-external',
          path,
          `Reference "${ref}" points outside this Bundle.`
        );
      }
    }
  }
  if (errors.length === refErrorsStart) checksPassed += 1;

  // Check 6: Document Bundle & Composition Entry #0 check
  const firstRes = entries[0]?.resource;
  const hasComposition = firstRes?.resourceType === 'Composition';
  const compErrorsStart = errors.length;
  if (bundle.type === 'document') {
    if (!bundle.identifier?.value && !bundle.identifier?.system) {
      addIssue(errors, 'bdl-10', 'Bundle.identifier', 'Document Bundles require Bundle.identifier.');
    }
    if (!bundle.timestamp) {
      addIssue(errors, 'bdl-10-ts', 'Bundle.timestamp', 'Document Bundles require Bundle.timestamp.');
    }
    if (!hasComposition) {
      addIssue(
        errors,
        'bdl-1',
        'Bundle.entry[0]',
        'Document Bundles require Composition as the first entry (entry[0]).'
      );
    }
  }
  if (errors.length === compErrorsStart) checksPassed += 1;

  // Check 7: IPS LOINC 60591-5 and required sections (Allergies, Medications, Problems)
  let isIpsProfile = false;
  if (bundle.type === 'document' && hasComposition) {
    const typeCodings = firstRes.type?.coding || [];
    const hasIpsLoinc = typeCodings.some(
      (c) => c.system === 'http://loinc.org' && c.code === '60591-5'
    );
    const sectionCodes = new Set(
      (firstRes.section || [])
        .flatMap((s) => s.code?.coding || [])
        .map((c) => c.code)
        .filter(Boolean)
    );
    const missingSections = IPS_REQUIRED_SECTIONS.filter((sec) => !sectionCodes.has(sec.code));

    if (hasIpsLoinc && missingSections.length === 0) {
      isIpsProfile = true;
      checksPassed += 1;
    } else {
      if (!hasIpsLoinc) {
        addIssue(
          warnings,
          'ips-type',
          'Bundle.entry[0].resource.type',
          'Composition.type is not LOINC 60591-5 (International Patient Summary).'
        );
      }
      missingSections.forEach((sec) => {
        addIssue(
          warnings,
          'ips-section',
          'Bundle.entry[0].resource.section',
          `IPS recommended section missing: ${sec.label} (LOINC ${sec.code}).`
        );
      });
      checksPassed += 1;
    }
  } else if (errors.length === 0) {
    checksPassed += 1;
  }

  // Check 8: Terminology & privacy hygiene (no LOINC Part errors, no signed URL warnings)
  const hasPrivacyOrTermIssue =
    errors.some((e) => e.code === 'doc-loinc-part') ||
    warnings.some((w) => w.code === 'doc-signed-url');
  if (!hasPrivacyOrTermIssue) {
    checksPassed += 1;
  }

  const valid = errors.length === 0;
  const profile = !valid ? 'INVALID' : isIpsProfile ? 'IPS-R4' : 'FHIR-R4';

  return {
    valid,
    profile,
    checksPassed,
    checksTotal,
    summary: {
      totalResources: entries.length,
      byType,
      bundleType: bundle.type || null,
      hasComposition,
      hasPatient,
    },
    errors,
    warnings,
  };
}
