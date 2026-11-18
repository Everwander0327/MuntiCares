import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const memoryStore = new Map();
const localStorageStub = {
  getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
  setItem: (key, value) => memoryStore.set(key, String(value)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};
for (const target of [globalThis, window]) {
  Object.defineProperty(target, 'localStorage', { configurable: true, value: localStorageStub });
}

function makeQueryBuilder(data) {
  const result = { data, error: null };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const requestRows = [
  {
    id: 'req-1',
    status: 'Cancelled',
    service: 'Wound Care',
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    provider: { full_name: 'Maria Santos' },
  },
];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => makeQueryBuilder(table === 'requests' ? requestRows : [])),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'patient-1', role: 'patient' } }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ uiScale: 1 }),
}));

vi.mock('@/contexts/LanguageContext', async () => {
  const { translate } = await import('@/i18n');
  return {
    useLanguage: () => ({
      language: 'en',
      t: (key, params) => translate('en', key, params),
    }),
  };
});

import NotificationBell from '@/shared/navigation/NotificationBell';

describe('NotificationBell', () => {
  afterEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('opens an accessible dialog with header, segmented tabs, card dismiss, and footer actions', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    const bell = await screen.findByRole('button', { name: /Notifications \(1 new\)/i });
    fireEvent.click(bell);

    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Updates' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /All \(1\)/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Unread \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bookings' })).toBeInTheDocument();

    expect(screen.getByText('Booking Cancelled')).toBeInTheDocument();
    expect(screen.getByText('You cancelled your request for Wound Care.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark read' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });
});
