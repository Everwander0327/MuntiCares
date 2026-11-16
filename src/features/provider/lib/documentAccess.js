import { supabase } from '@/lib/supabase';

/** Return the link only after its authorized issuance has been recorded. */
export async function getAuditedDocumentUrl(patientId, filePath) {
  if (!patientId || !filePath) throw new Error('Missing document details');
  const { data, error } = await supabase.functions.invoke('medical-document-link', {
    body: { patientId, filePath },
  });
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Document link unavailable');
  return data.signedUrl;
}
