/*
 * Per-account flags for "already rated" and "already uploaded pre-session data".
 * Keys are scoped by user id: on a shared handset an unscoped key told account B that
 * account A's visit was already handled, hiding actions they still owed.
 */

const readMap = (key, userId) => {
  if (!userId) return {};
  const storageKey = `${key}_${userId}`;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    localStorage.removeItem(storageKey);
    return {};
  }
};

const writeMap = (key, userId, map) => {
  if (!userId) return;
  try {
    localStorage.setItem(`${key}_${userId}`, JSON.stringify(map));
  } catch {
    // Private mode / quota: the flag is a nicety, the server row is the record.
  }
};

const RATED_KEY = 'mc_rated_requests';
const PRESESSION_KEY = 'mc_presession_submitted';

export const hasRatedRequest = (userId, requestId) => Boolean(readMap(RATED_KEY, userId)[requestId]);
export const ratedMapFor = (userId) => readMap(RATED_KEY, userId);
export const markRequestRated = (userId, requestId) => {
  const map = readMap(RATED_KEY, userId);
  map[requestId] = true;
  writeMap(RATED_KEY, userId, map);
};

export const presessionMapFor = (userId) => readMap(PRESESSION_KEY, userId);
export const hasPresessionForRequest = (userId, requestId) => Boolean(readMap(PRESESSION_KEY, userId)[requestId]);
export const markPresessionSubmitted = (userId, requestId) => {
  const map = readMap(PRESESSION_KEY, userId);
  map[requestId] = true;
  writeMap(PRESESSION_KEY, userId, map);
};
