import { supabase } from '@/lib/supabase';

/** Return the link only after its authorized issuance has been recorded. */
export async function getAuditedDocumentUrl(patientId, filePath) {
  if (!patientId || !filePath) throw new Error('Missing document details');
  const { data, error } = await supabase.storage
    .from('medical_documents').createSignedUrl(filePath, 3600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Document link unavailable');
  const { error: auditError } = await supabase.rpc('record_document_access', {
    p_patient_id: patientId,
    p_file_path: filePath,
  });
  if (auditError) throw auditError;
  return data.signedUrl;
}
