// Preserve fields omitted from a partial form. A uniqueness conflict means another
// tab inserted this patient's first row after our lookup; update that row instead.
export async function saveMedicalHistory(client, patientId, values, hasExisting) {
  const table = client.from('medical_histories');
  const update = () => table.update(values).eq('patient_id', patientId);
  if (hasExisting) return update();
  const result = await table.insert({ patient_id: patientId, past_surgeries: '', ...values });
  return result.error?.code === '23505' ? update() : result;
}
