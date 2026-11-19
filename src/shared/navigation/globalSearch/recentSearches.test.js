import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
} from './recentSearches';

describe('recentSearches', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    });
  });

  it('scopes recent items by role and userId under mc_global_search_recent', () => {
    addRecentSearch('patient', 'u1', {
      id: 'prov-1',
      label: 'Dr. Maria Santos',
      subtitle: 'Home Nursing',
      to: '/patient/providers/p1/profile',
      kind: 'provider',
    });

    expect(getRecentSearches('patient', 'u1')).toHaveLength(1);
    expect(getRecentSearches('patient', 'u2')).toEqual([]);
    expect(getRecentSearches('provider', 'u1')).toEqual([]);
    expect(
      localStorage.getItem('mc_global_search_recent:patient:u1')
    ).toBeTruthy();
  });

  it('deduplicates by destination route, moves repeat entries to front, and caps at 5 items', () => {
    for (let i = 1; i <= 6; i += 1) {
      addRecentSearch('patient', 'u1', {
        id: `item-${i}`,
        label: `Item ${i}`,
        to: `/route/${i}`,
        kind: 'page',
      });
    }

    const list = getRecentSearches('patient', 'u1');
    expect(list).toHaveLength(5);
    expect(list.map((x) => x.to)).toEqual([
      '/route/6',
      '/route/5',
      '/route/4',
      '/route/3',
      '/route/2',
    ]);

    addRecentSearch('patient', 'u1', {
      id: 'item-3-again',
      label: 'Item 3 Updated',
      to: '/route/3',
      kind: 'page',
    });

    const deduped = getRecentSearches('patient', 'u1');
    expect(deduped).toHaveLength(5);
    expect(deduped[0]).toMatchObject({ label: 'Item 3 Updated', to: '/route/3' });
  });

  it('strips unexpected fields like email and notes before saving to localStorage', () => {
    addRecentSearch('admin', 'a1', {
      id: 'usr-1',
      label: 'Juan Dela Cruz',
      subtitle: 'Patient • Active',
      to: '/admin/patients?q=Juan',
      kind: 'patient',
      email: 'juan@example.com',
      notes: 'private medical note',
    });

    const raw = localStorage.getItem('mc_global_search_recent:admin:a1');
    expect(raw).not.toContain('juan@example.com');
    expect(raw).not.toContain('private medical note');
    expect(getRecentSearches('admin', 'a1')[0]).toEqual({
      id: 'usr-1',
      label: 'Juan Dela Cruz',
      subtitle: 'Patient • Active',
      to: '/admin/patients?q=Juan',
      kind: 'patient',
    });
  });

  it('recovers gracefully from corrupted JSON and clears cleanly', () => {
    localStorage.setItem(
      'mc_global_search_recent:patient:u1',
      '{not-valid-json'
    );
    expect(getRecentSearches('patient', 'u1')).toEqual([]);

    addRecentSearch('patient', 'u1', {
      id: 'p1',
      label: 'Find Providers',
      to: '/patient/providers',
      kind: 'page',
    });
    clearRecentSearches('patient', 'u1');
    expect(getRecentSearches('patient', 'u1')).toEqual([]);
  });
});
