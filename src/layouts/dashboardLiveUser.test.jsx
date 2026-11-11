import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DashboardLayout from './DashboardLayout';
import { ThemeProvider } from '../contexts/ThemeContext';

// Node 24 exposes a localStorage global that throws without --localstorage-file, which
// shadows jsdom's. NotificationBell reads it during render.
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

const updateUser = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);

// Every field must keep a stable identity: DashboardShell has an effect keyed on
// `authUser`, and a fresh object per render would loop it forever.
const authUser = { id: 'user-1', full_name: 'Rizalina Bautista', role: 'patient', avatar_url: '' };
const authValue = { user: authUser, authInitialized: true, updateUser, logout };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));

// Every `users` fetch is held open until the test releases it, so a realtime UPDATE can
// land while one is still in flight. The profile effect runs more than once on mount
// (react-router hands `useNavigate` a fresh identity once), so resolvers[0] belongs to a
// superseded run and the last entry to the live one.
const usersFetch = { resolvers: [] };
const realtime = { handler: null };

vi.mock('../lib/supabase', () => {
  const chainHandler = {
    get(_, prop) {
      if (prop === 'then') {
        return (onFulfilled, onRejected) =>
          Promise.resolve({ data: null, error: null, count: 0 }).then(onFulfilled, onRejected);
      }
      return vi.fn().mockImplementation(() => new Proxy({}, chainHandler));
    },
  };
  const chain = new Proxy({}, chainHandler);

  const usersQuery = {
    select: () => usersQuery,
    eq: () => usersQuery,
    maybeSingle: () =>
      new Promise((resolve) => {
        usersFetch.resolvers.push(resolve);
      }),
  };

  return {
    supabase: {
      from: vi.fn((table) => (table === 'users' ? usersQuery : chain)),
      channel: vi.fn((name) => {
        const channel = {
          on: vi.fn((_event, _filter, handler) => {
            // Other components open channels too; only the profile one matters here.
            if (String(name).startsWith('live-user-')) realtime.handler = handler;
            return channel;
          }),
          subscribe: vi.fn(() => channel),
        };
        return channel;
      }),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
});

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...args) => toastError(...args), success: vi.fn() },
  toast: { error: (...args) => toastError(...args), success: vi.fn() },
}));

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const resolveFetch = async (index, result) => {
  act(() => {
    usersFetch.resolvers[index](result);
  });
  await flush();
};

const latestFetch = () => usersFetch.resolvers.length - 1;

const row = (full_name) => ({ data: { full_name, avatar_url: '', role: 'patient' }, error: null });

// The sidebar renders getInitials(full_name), so two-letter initials are the observable
// proxy for which row won.
const initialsOnScreen = () =>
  [...document.querySelectorAll('span')].map((s) => s.textContent).filter((t) => /^[A-Z]{2}$/.test(t));

function renderDashboard() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/patient/dashboard']}>
        <DashboardLayout role="patient">
          <div>page body</div>
        </DashboardLayout>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

async function mountWithLiveSubscription() {
  renderDashboard();
  await flush();
  expect(realtime.handler).not.toBeNull();
  expect(usersFetch.resolvers.length).toBeGreaterThan(0);

  act(() => {
    realtime.handler({ new: { full_name: 'Fresh Realtime', avatar_url: '', role: 'patient' } });
  });
  await flush();
  await waitFor(() => {
    expect(screen.getAllByText('FR').length).toBeGreaterThan(0);
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  usersFetch.resolvers = [];
  realtime.handler = null;
  document.body.className = '';
});

// C8: the profile fetch runs concurrently with the postgres_changes subscription and
// merges with `prev => ({ ...prev, ...data })`. Whichever writes last wins, so a realtime
// row that arrives first gets rewound by the staler fetch.
describe('C8 — a realtime profile update is not rewound by an in-flight fetch', () => {
  it('ignores its own run\'s fetch once a realtime update has landed', async () => {
    await mountWithLiveSubscription();

    await resolveFetch(latestFetch(), row('Stale Fetch'));

    expect(initialsOnScreen()).toContain('FR');
    expect(screen.queryByText('SF')).toBeNull();
  });

  it('ignores a fetch left in flight by a superseded subscription', async () => {
    await mountWithLiveSubscription();

    await resolveFetch(0, row('Stale Fetch'));

    expect(initialsOnScreen()).toContain('FR');
    expect(screen.queryByText('SF')).toBeNull();
  });

  it('still applies the fetch when no realtime update has arrived', async () => {
    renderDashboard();
    await flush();

    await resolveFetch(latestFetch(), row('Stale Fetch'));

    await waitFor(() => {
      expect(screen.getAllByText('SF').length).toBeGreaterThan(0);
    });
  });
});

// DESIGN.md section 5: "Never render a failure as 'no data'." The fetch destructured
// only `data`, so an RLS denial or a network error looked identical to an empty row.
describe('C8 — a failed profile fetch is surfaced, not swallowed', () => {
  it('reports the error instead of silently keeping the old profile', async () => {
    renderDashboard();
    await flush();

    await resolveFetch(latestFetch(), { data: null, error: { message: 'permission denied for table users' } });

    expect(toastError).toHaveBeenCalled();
  });
});
