import { supabase } from './supabase';

/**
 * Return a signed, time-limited URL for a storage object.
 * ttlSeconds defaults to 1 hour (3600).
 */
export async function getSignedUrl(filePath, ttlSeconds = 3600) {
  if (!filePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from('medical_documents')
      .createSignedUrl(filePath, ttlSeconds);

    if (error) {
      console.warn('createSignedUrl error', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (err) {
    console.warn('getSignedUrl exception', err);
    return null;
  }
}

export default { getSignedUrl };
