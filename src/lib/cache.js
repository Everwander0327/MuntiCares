const CACHE_PREFIX = 'mc_cache_';
const DEFAULT_TTL = 5 * 60 * 1000;

const store = {
  get(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { data, expiry } = JSON.parse(raw);
      if (Date.now() > expiry) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch { return null; }
  },
  set(key, data, ttl = DEFAULT_TTL) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiry: Date.now() + ttl }));
    } catch { /* storage full */ }
  },
  remove(key) { localStorage.removeItem(CACHE_PREFIX + key); },
  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};

export const providersCache = {
  get(id) { return store.get(`provider_${id}`); },
  set(provider) { store.set(`provider_${provider.id}`, provider); },
  remove(id) { store.remove(`provider_${id}`); },
};

export default store;
