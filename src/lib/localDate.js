/*
 * Booking slots are stored as local wall-clock (`date` + `time`), so parsing them as
 * UTC moves every appointment one day earlier before 08:00. These helpers read and
 * write those values in the device's own calendar, which is the Asia/Manila clock the
 * product spec uses (no DST).
 */

export function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  if (!match) return new Date(text);
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

export function toLocalDateKey(date = new Date()) {
  const d = date instanceof Date ? date : parseLocalDate(date);
  if (!d || Number.isNaN(d.getTime())) return '';
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** "08:00" / "8:00" / "08:00:00" -> minutes past midnight, or null when unparseable. */
export function slotMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export const SLOT_DURATION_MINUTES = 60;

/** Two bookings collide when their [start, start+60) windows overlap on the same date. */
export function slotsOverlap(dateA, timeA, dateB, timeB) {
  if (toLocalDateKey(parseLocalDate(dateA)) !== toLocalDateKey(parseLocalDate(dateB))) return false;
  const a = slotMinutes(timeA);
  const b = slotMinutes(timeB);
  if (a === null || b === null) return false;
  return a < b + SLOT_DURATION_MINUTES && b < a + SLOT_DURATION_MINUTES;
}
