/** Splits the legacy "Name - Phone" emergency contact string into its parts. */
export const parseEmergencyContact = (raw = '') => {
  if (!raw) return { name: '', phone: '' };
  if (raw.includes(' - ')) {
    const [name, phone] = raw.split(' - ');
    return { name: name || '', phone: phone || '' };
  }
  return { name: raw, phone: '' };
};

/**
 * PostgREST reports unknown columns as PGRST204; raw Postgres uses 42703.
 * Lets callers retry a write without optional structured columns on databases
 * where the additive migration has not been applied yet.
 */
export const isMissingColumnError = (error) =>
  error?.code === 'PGRST204' ||
  error?.code === '42703' ||
  /column .* does not exist/i.test(error?.message || '');

/**
 * When the medical history could not be loaded, saving would clobber the
 * stored row with the blank form fields. Skip the write only in that case
 * and only when a row already exists to protect.
 */
export const shouldSkipMedicalHistoryWrite = (historyLoaded, hasExisting) =>
  !historyLoaded && hasExisting;
