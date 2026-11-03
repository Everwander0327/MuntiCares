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

export const SLOT_DURATION_MINUTES = 30;

/**
 * Two bookings collide when their [start, start + duration) windows overlap on the same date.
 * Duration parameters are in minutes and default to 30 for backward compatibility.
 */
export function slotsOverlap(
  dateA,
  timeA,
  dateB,
  timeB,
  durationA = SLOT_DURATION_MINUTES,
  durationB = SLOT_DURATION_MINUTES
) {
  if (toLocalDateKey(parseLocalDate(dateA)) !== toLocalDateKey(parseLocalDate(dateB))) return false;
  const a = slotMinutes(timeA);
  const b = slotMinutes(timeB);
  if (a === null || b === null) return false;
  const durA = Number(durationA) || SLOT_DURATION_MINUTES;
  const durB = Number(durationB) || SLOT_DURATION_MINUTES;
  return a < b + durB && b < a + durA;
}

/**
 * Formats a start time and duration into a clean time range string.
 * Example: ("10:00", 60) -> "10:00 – 11:00 AM"
 * Example: ("09:30", 30) -> "9:30 AM"
 */
export function formatSlotLabel(timeStr, durationMinutes = 30) {
  const m = slotMinutes(timeStr);
  if (m === null) return timeStr;
  const startH = Math.floor(m / 60);
  const startMin = m % 60;
  const startPeriod = startH >= 12 ? 'PM' : 'AM';
  const displayStartH = startH % 12 === 0 ? 12 : startH % 12;
  const startFormatted = `${displayStartH}:${String(startMin).padStart(2, '0')}`;

  if (durationMinutes <= 30) {
    return `${startFormatted} ${startPeriod}`;
  }

  const endM = m + durationMinutes;
  const endH = Math.floor(endM / 60);
  const endMin = endM % 60;
  const endPeriod = endH >= 12 ? 'PM' : 'AM';
  const displayEndH = endH % 12 === 0 ? 12 : endH % 12;
  const endFormatted = `${displayEndH}:${String(endMin).padStart(2, '0')}`;

  // If periods match, format cleanly as "10:00 – 11:00 AM"
  if (startPeriod === endPeriod) {
    return `${startFormatted} – ${endFormatted} ${endPeriod}`;
  }
  return `${startFormatted} ${startPeriod} – ${endFormatted} ${endPeriod}`;
}
