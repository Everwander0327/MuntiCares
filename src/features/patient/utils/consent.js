// Least-privilege starting point: a booking shares the medical summary needed
// for safe care, while documents and notes stay off until the patient opts in.
export const DEFAULT_CONSENT_PERMS = {
  medical_history: true,
  documents: false,
  visit_notes: false,
};

export const normalizePermissions = (permissions) => ({
  ...DEFAULT_CONSENT_PERMS,
  ...(permissions && typeof permissions === 'object' ? permissions : {}),
});
