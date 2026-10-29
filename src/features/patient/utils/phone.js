const stripSeparators = (value = '') => String(value).replace(/[\s().-]/g, '');

/** Normalises a PH phone number to local format: 09XXXXXXXXX for mobiles, 0X… for landlines. */
export const normalizePhPhone = (value = '') => {
  const cleaned = stripSeparators(value);
  if (!cleaned) return '';
  if (/^\+?63\d{10}$/.test(cleaned)) return `0${cleaned.replace(/^\+?63/, '')}`;
  if (/^9\d{9}$/.test(cleaned)) return `0${cleaned}`;
  return cleaned;
};

export const isValidPhPhone = (value = '') => {
  const normalized = normalizePhPhone(value);
  return /^09\d{9}$/.test(normalized) || /^0[2-8]\d{7,9}$/.test(normalized);
};

export const PHONE_ERROR = 'Enter a valid PH number (mobile 09XXXXXXXXX, landline 0X XXXXXXX).';
