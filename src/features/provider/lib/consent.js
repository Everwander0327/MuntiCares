import { supabase } from '@/lib/supabase';
import { normalizePermissions } from '@/features/patient/utils/consent';

/** Null expiry is the documented legacy no-expiry grant. Unreadable expiry fails closed. */
export async function fetchConsentGrant(patientId, providerId) {
  const { data, error } = await supabase
    .from('consent_access')
    .select('is_enabled, permissions, expires_at')
    .eq('patient_id', patientId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) throw error;
  if (data?.is_enabled !== true) return null;
  if (data.expires_at !== null) {
    const expiry = new Date(data.expires_at).getTime();
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
  }
  return { is_enabled: true, permissions: normalizePermissions(data.permissions) };
}
