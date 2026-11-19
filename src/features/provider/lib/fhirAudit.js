import { supabase } from '@/lib/supabase';

/**
 * Records a provider FHIR R4 IPS export in `document_access_events` via the
 * `record_fhir_export` RPC. Fails gracefully when the optional SQL migration
 * has not been manually applied on the connected Supabase project yet.
 */
export async function recordProviderFhirExport(patientId, categories = ['demographics']) {
  if (!patientId || typeof supabase?.rpc !== 'function') return { logged: false };
  try {
    const { data, error } = await supabase.rpc('record_fhir_export', {
      p_patient_id: patientId,
      p_categories: Array.isArray(categories) && categories.length > 0 ? categories : ['demographics'],
    });
    if (error) {
      // Missing function (42883 / PGRST202) means the manual migration hasn't been applied yet
      if (error.code === '42883' || error.code === 'PGRST202') {
        return { logged: false, skipped: true };
      }
      console.warn('FHIR export audit skipped:', error.message);
      return { logged: false, error };
    }
    return { logged: true, eventId: data };
  } catch (err) {
    console.warn('FHIR export audit failed:', err?.message || err);
    return { logged: false, error: err };
  }
}
