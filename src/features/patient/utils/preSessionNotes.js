export function buildPreSessionNotesSummary({ symptomNotes = '', vitals = {}, uploadedCount = 0 }) {
  return [
    symptomNotes.trim() ? `[Pre-session Symptoms] ${symptomNotes.trim()}` : '',
    vitals.bp ? `BP: ${vitals.bp}` : '',
    vitals.temp ? `Temp: ${vitals.temp}°C` : '',
    vitals.hr ? `HR: ${vitals.hr} bpm` : '',
    vitals.weight ? `Weight: ${vitals.weight} kg` : '',
    uploadedCount > 0 ? `[${uploadedCount} file(s) uploaded]` : '',
  ].filter(Boolean).join(' | ');
}

export function mergePreSessionNotes(existingNotes, summary) {
  return existingNotes ? `${existingNotes}\n${summary}` : summary;
}
