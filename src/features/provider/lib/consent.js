import { supabase } from '@/lib/supabase';

const isMissingColumnError = (err) =>
  err?.code === '42703' || /column .* does not exist/i.test(err?.message || '');

/**
 * Read one patient→provider consent grant. Returns null when there is no grant.
 * Deny-by-default: a missing row, is_enabled false, or an expiry in the past all
 * mean "no access". expires_at only exists once the consent-expiry migration is
 * applied, so a missing-column error retries without it instead of locking the
 * provider out.
 */
export async function fetchConsentGrant(patientId, providerId) {
  let query = supabase
    .from('consent_access')
    .select('is_enabled, permissions, expires_at')
    .eq('patient_id', patientId)
    .eq('provider_id', providerId)
    .maybeSingle();

  let { data, error } = await query;

  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('consent_access')
      .select('is_enabled, permissions')
      .eq('patient_id', patientId)
      .eq('provider_id', providerId)
      .maybeSingle());
  }

  if (error) throw error;
  if (!data || !data.is_enabled) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;

  return { is_enabled: true, permissions: data.permissions || {} };
}
