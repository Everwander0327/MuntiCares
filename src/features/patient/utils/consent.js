// Least-privilege starting point: a booking shares the medical summary needed
// for safe care, while documents and notes stay off until the patient opts in.
export const DEFAULT_CONSENT_PERMS = {
  medical_history: true,
  documents: false,
  visit_notes: false,
};

export const normalizePermissions = (permissions) => ({
  medical_history: permissions?.medical_history === true,
  documents: permissions?.documents === true,
  visit_notes: permissions?.visit_notes === true,
});
