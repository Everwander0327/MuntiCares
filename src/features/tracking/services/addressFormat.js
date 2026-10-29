/**
 * Compiles granular delivery/visit details into a formatted destination address
 * that is compatible with existing tracking RPCs and displays cleanly for providers.
 */
export function formatFullVisitAddress({
  unit = '',
  subdivision = '',
  baseAddress = '',
  instructions = '',
}) {
  const parts = [];
  if (unit && unit.trim()) parts.push(unit.trim());
  if (subdivision && subdivision.trim()) parts.push(subdivision.trim());
  if (baseAddress && baseAddress.trim()) parts.push(baseAddress.trim());

  let formatted = parts.join(', ');
  if (instructions && instructions.trim()) {
    formatted = formatted
      ? `${formatted} (Gate/Notes: ${instructions.trim()})`
      : `(Gate/Notes: ${instructions.trim()})`;
  }
  return formatted || null;
}

/**
 * Parses an existing full address string back into its constituent parts
 * if it contains structured annotations like (Gate/Notes: ...).
 */
export function parseFullVisitAddress(rawAddress) {
  if (!rawAddress || typeof rawAddress !== 'string') {
    return { unit: '', subdivision: '', baseAddress: '', instructions: '' };
  }

  let text = rawAddress.trim();
  let instructions = '';

  const notesMatch = text.match(/\(Gate\/Notes:\s*([^)]+)\)$/i);
  if (notesMatch) {
    instructions = notesMatch[1].trim();
    text = text.replace(/\(Gate\/Notes:\s*[^)]+\)$/i, '').trim();
    // remove trailing comma if present
    if (text.endsWith(',')) text = text.slice(0, -1).trim();
  }

  return {
    unit: '',
    subdivision: '',
    baseAddress: text,
    instructions,
  };
}

/** True when the value is only a "lat, lng" pair and not a usable address. */
export const isCoordinateAddress = (value = '') => /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(String(value).trim());

const stripPrefix = (text, prefix) => {
  if (!prefix) return null;
  const normalizedText = text.toLowerCase();
  const normalizedPrefix = prefix.trim().toLowerCase();
  if (!normalizedPrefix || !normalizedText.startsWith(`${normalizedPrefix}, `)) return null;
  return text.slice(prefix.trim().length + 2).trim();
};

/**
 * Splits a compiled visit address back into its parts. Structured columns are
 * trusted only when the compiled string actually starts with them, so an address
 * edited elsewhere after saving cannot resurrect stale unit/subdivision values.
 */
export function splitVisitAddress(rawAddress, { unit = '', subdivision = '' } = {}) {
  const parsed = parseFullVisitAddress(rawAddress);
  const withSubdivision = unit && subdivision
    ? stripPrefix(parsed.baseAddress, `${unit}, ${subdivision}`)
    : null;
  if (withSubdivision != null) {
    return { unit, subdivision, baseAddress: withSubdivision, instructions: parsed.instructions };
  }
  const withUnit = stripPrefix(parsed.baseAddress, unit);
  if (withUnit != null) {
    return { unit, subdivision: '', baseAddress: withUnit, instructions: parsed.instructions };
  }
  return { unit: '', subdivision: '', baseAddress: parsed.baseAddress, instructions: parsed.instructions };
}
