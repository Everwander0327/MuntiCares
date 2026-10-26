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
