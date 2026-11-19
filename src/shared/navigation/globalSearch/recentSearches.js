const STORAGE_PREFIX = 'mc_global_search_recent';
const MAX_RECENT = 5;

const storageKey = (role, userId) => {
  if (!role || !userId) return null;
  return `${STORAGE_PREFIX}:${role}:${userId}`;
};

const sanitizeEntry = (item) => {
  if (!item || typeof item !== 'object') return null;
  const to = typeof item.to === 'string' ? item.to.trim() : '';
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  if (!to || !label) return null;
  const entry = {
    id: String(item.id || to),
    label,
    to,
    kind: typeof item.kind === 'string' ? item.kind : 'page',
  };
  if (typeof item.subtitle === 'string' && item.subtitle.trim()) {
    entry.subtitle = item.subtitle.trim();
  }
  return entry;
};

const getStorage = () => {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage;
    }
  } catch {
    // Ignore restricted storage access
  }
  return null;
};

export const getRecentSearches = (role, userId) => {
  const key = storageKey(role, userId);
  const storage = getStorage();
  if (!key || !storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeEntry).filter(Boolean).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
};

export const addRecentSearch = (role, userId, item) => {
  const key = storageKey(role, userId);
  const clean = sanitizeEntry(item);
  const storage = getStorage();
  if (!key || !clean || !storage) return [];
  const existing = getRecentSearches(role, userId).filter(
    (entry) => entry.to !== clean.to
  );
  const next = [clean, ...existing].slice(0, MAX_RECENT);
  try {
    storage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
  return next;
};

export const clearRecentSearches = (role, userId) => {
  const key = storageKey(role, userId);
  const storage = getStorage();
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
};
