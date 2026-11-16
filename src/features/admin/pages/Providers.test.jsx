import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminProviders from './Providers';

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  return fn;
});

const exportMock = vi.hoisted(() => ({
  exportToCSV: vi.fn(),
  formatDataForExport: vi.fn((items) => items),
}));

const supabaseMock = vi.hoisted(() => {
  const daysAgoIso = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const state = {
    providers: [],
    providerUpdates: [],
    userUpdates: [],
    userDeletes: [],
    storageRemoves: [],
  };

  const reset = () => {
    state.providerUpdates = [];
    state.userUpdates = [];
    state.userDeletes = [];
    state.storageRemoves = [];
    state.providers = [
      {
        id: 'prov-1',
        user_id: 'user-1',
        services: ['Cardiology', 'Internal Medicine'],
        rating: 4.9,
        location: 'Alabang, Muntinlupa',
        phone: '09171112222',
        bio: 'Board-certified cardiologist',
        is_profile_complete: true,
        is_approved: true,
        professional_id_path: null,
        professional_id_paths: [],
        professional_id_status: 'verified',
        trust_score: 100,
        user: {
          id: 'user-1',
          full_name: 'Dr. Elena Santos',
          email: 'elena@munticares.ph',
          avatar_url: '',
          is_banned: false,
          created_at: daysAgoIso(2),
        },
      },
      {
        id: 'prov-2',
        user_id: 'user-2',
        services: ['Physical Therapy', 'Sports Rehabilitation'],
        rating: 4.4,
        location: 'Tunasan, Muntinlupa',
        phone: '09172223333',
        bio: 'Licensed physical therapist',
        is_profile_complete: true,
        is_approved: false,
        professional_id_path: 'user-2/prc-id.jpg',
        professional_id_paths: ['user-2/prc-id.jpg'],
        professional_id_status: 'pending',
        trust_score: 40,
        user: {
          id: 'user-2',
          full_name: 'Marco Reyes',
          email: 'marco@munticares.ph',
          avatar_url: '',
          is_banned: false,
          created_at: daysAgoIso(12),
        },
      },
      {
        id: 'prov-3',
        user_id: 'user-3',
        services: ['Home Nursing'],
        rating: 3.8,
        location: 'Poblacion, Muntinlupa',
        phone: '09173334444',
        bio: 'Registered nurse',
        is_profile_complete: true,
        is_approved: false,
        professional_id_path: null,
        professional_id_paths: [],
        professional_id_status: 'rejected',
        trust_score: 20,
        user: {
          id: 'user-3',
          full_name: 'Nora Cruz',
          email: 'nora@munticares.ph',
          avatar_url: '',
          is_banned: true,
          created_at: daysAgoIso(50),
        },
      },
    ];
  };

  reset();

  const from = vi.fn((table) => {
    if (table === 'providers') {
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: state.providers, error: null })),
        })),
        update: vi.fn((payload) => ({
          eq: vi.fn((col, val) => {
            state.providerUpdates.push({ payload, col, val });
            state.providers = state.providers.map((p) =>
              p[col] === val ? { ...p, ...payload } : p
            );
            return Promise.resolve({ error: null });
          }),
          in: vi.fn((col, vals) => {
            state.providerUpdates.push({ payload, col, vals });
            state.providers = state.providers.map((p) =>
              vals.includes(p[col]) ? { ...p, ...payload } : p
            );
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }

    if (table === 'users') {
      return {
        update: vi.fn((payload) => ({
          eq: vi.fn((_col, id) => {
            state.userUpdates.push({ payload, ids: [id] });
            state.providers = state.providers.map((p) =>
              p.user_id === id ? { ...p, user: { ...p.user, ...payload } } : p
            );
            return Promise.resolve({ error: null });
          }),
          in: vi.fn((_col, ids) => {
            state.userUpdates.push({ payload, ids });
            state.providers = state.providers.map((p) =>
              ids.includes(p.user_id) ? { ...p, user: { ...p.user, ...payload } } : p
            );
            return Promise.resolve({ error: null });
          }),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((_col, id) => {
            state.userDeletes.push([id]);
            state.providers = state.providers.filter((p) => p.user_id !== id);
            return Promise.resolve({ error: null });
          }),
          in: vi.fn((_col, ids) => {
            state.userDeletes.push(ids);
            state.providers = state.providers.filter((p) => !ids.includes(p.user_id));
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }

    return {};
  });

  const storage = {
    from: vi.fn(() => ({
      getPublicUrl: vi.fn((path) => ({ data: { publicUrl: `https://cdn.example/${path}` } })),
      remove: vi.fn((paths) => {
        state.storageRemoves.push(paths);
        return Promise.resolve({ error: null });
      }),
    })),
  };

  return { state, reset, client: { from, storage } };
});

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock.client,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  toast: toastMock,
}));

vi.mock('@/lib/exportUtils', () => exportMock);

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const MOTION_KEYS = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'whileTap',
    'drag',
    'dragControls',
    'dragListener',
    'dragConstraints',
    'dragElastic',
    'onDragEnd',
  ]);
  const stripMotionProps = (props) =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_KEYS.has(key)));

  const div = React.forwardRef((props, ref) =>
    React.createElement('div', { ...stripMotionProps(props), ref })
  );
  div.displayName = 'MockMotionDiv';

  return {
    MotionConfig: ({ children }) => <>{children}</>,
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: { div },
    useReducedMotion: () => false,
    useDragControls: () => ({ start: vi.fn() }),
  };
});

function renderProviders() {
  return render(
    <MemoryRouter>
      <AdminProviders />
    </MemoryRouter>
  );
}

describe('AdminProviders redesign', () => {
  beforeEach(() => {
    supabaseMock.reset();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    exportMock.exportToCSV.mockClear();
    document.body.className = '';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('removes header count pill, prioritizes pending providers by default, and supports Show Pending banner toggle', async () => {
    renderProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Manage Providers' })).toBeInTheDocument();
    });

    // Header cleanup: "{N} Providers" pill removed
    expect(screen.queryByText(/^\d+\s+Providers?$/i)).not.toBeInTheDocument();

    // Needs Action First smart banner shown
    const banner = screen.getByRole('region', { name: 'Providers needing review' });
    expect(banner).toHaveTextContent('1 provider needs review');

    // Default pending-first sort puts Marco Reyes (Pending Approval / pending ID) first in table
    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows[0]).toHaveTextContent('Marco Reyes');
    expect(bodyRows[1]).toHaveTextContent('Dr. Elena Santos');

    // One-click Show Pending toggle filters down to pending providers only
    const toggleBtn = within(banner).getByRole('button', { name: 'Show Pending' });
    fireEvent.click(toggleBtn);
    expect(within(banner).getByRole('button', { name: 'Show All' })).toBeInTheDocument();
    const filteredRows = within(table).getAllByRole('row').slice(1);
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]).toHaveTextContent('Marco Reyes');
  });

  it('uses keyboard-accessible sortable headers with aria-sort and updates the sticky Provider inspector', async () => {
    renderProviders();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    // Misleading "SELECT" text is removed
    expect(within(table).queryByText('SELECT')).not.toBeInTheDocument();

    // Sortable button inside <th scope="col">
    const nameSortBtn = within(table).getByRole('button', { name: 'Healthcare Professional' });
    const nameTh = nameSortBtn.closest('th');
    expect(nameTh).toHaveAttribute('scope', 'col');
    expect(nameTh).not.toHaveAttribute('aria-sort');

    fireEvent.click(nameSortBtn);
    expect(nameTh).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(nameSortBtn);
    expect(nameTh).toHaveAttribute('aria-sort', 'descending');

    // Trust Score is visible in table cells
    expect(within(table).getByText('40% Trust Score')).toBeInTheDocument();

    // Sticky Provider Inspector panel updates when selecting a row
    const inspector = screen.getByLabelText('Provider inspector');
    const elenaRow = within(table).getByText('Dr. Elena Santos').closest('tr');
    fireEvent.click(within(elenaRow).getByRole('button', { name: 'Inspect' }));
    expect(within(inspector).getByRole('heading', { name: 'Dr. Elena Santos' })).toBeInTheDocument();
  });

  it('provides safe mobile cards without Ban button or Select clutter, and a mobile Filter & Sort drawer', async () => {
    renderProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Manage Providers' })).toBeInTheDocument();
    });

    // Safe mobile cards have no Ban Provider button or Select mode clutter on the scroll surface
    expect(screen.queryByRole('button', { name: 'Ban Provider' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();

    // Open Mobile Filter & Sort drawer
    fireEvent.click(screen.getByRole('button', { name: /Filters/i }));
    const drawer = await screen.findByRole('dialog');
    expect(drawer).toHaveTextContent('Filter & Sort Providers');

    // Change Status, Date Range + Clear Dates, Sort By, and Export CSV inside drawer
    fireEvent.click(within(drawer).getByRole('button', { name: 'Last 30 days' }));
    expect(within(drawer).getByRole('button', { name: 'Clear Dates' })).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Clear Dates' }));
    expect(within(drawer).queryByRole('button', { name: 'Clear Dates' })).not.toBeInTheDocument();

    fireEvent.change(within(drawer).getByLabelText('Sort By'), { target: { value: 'rating' } });
    expect(within(drawer).getByRole('button', { name: 'Descending' })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Export CSV' }));
    expect(exportMock.exportToCSV).toHaveBeenCalledWith(expect.any(Array), 'providers_export');

    fireEvent.click(within(drawer).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('opens centered 2-tab Verification Modal with in-app confirmations (Cancel focused first) and zero window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderProviders();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    const marcoRow = within(table).getByText('Marco Reyes').closest('tr');
    fireEvent.click(within(marcoRow).getByRole('button', { name: 'Inspecting' }));

    const inspector = screen.getByLabelText('Provider inspector');
    fireEvent.click(within(inspector).getByRole('button', { name: 'Review & Verify' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
    expect(document.body.classList.contains('modal-open')).toBe(true);

    // Tab 1: Profile & IDs
    const profileTab = within(dialog).getByRole('tab', { name: 'Profile & IDs' });
    const actionsTab = within(dialog).getByRole('tab', { name: 'Account Actions' });
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
    expect(actionsTab).toHaveAttribute('aria-selected', 'false');
    expect(within(dialog).getByText(/40% Trust Score/)).toBeInTheDocument();

    // Verify ID triggers in-modal confirmation with Cancel focused first
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verify ID' }));
    const alertDialog = within(dialog).getByRole('alertdialog');
    expect(alertDialog).toHaveTextContent('Verify professional ID for Marco Reyes?');
    expect(within(alertDialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    fireEvent.click(within(alertDialog).getByRole('button', { name: 'Confirm Verify ID' }));
    await waitFor(() => {
      expect(supabaseMock.state.storageRemoves[0]).toEqual(['user-2/prc-id.jpg']);
      expect(supabaseMock.state.providerUpdates[0]).toEqual({
        payload: {
          professional_id_status: 'verified',
          professional_id_paths: [],
          professional_id_path: null,
          trust_score: 70,
        },
        col: 'id',
        val: 'prov-2',
      });
    });

    // Inspect Elena Santos in sticky inspector and reopen modal to switch to Account Actions tab
    const elenaRow = within(table).getByText('Dr. Elena Santos').closest('tr');
    fireEvent.click(within(elenaRow).getByRole('button', { name: 'Inspect' }));
    fireEvent.click(within(inspector).getByRole('button', { name: 'Review & Verify' }));

    const dialog2 = await screen.findByRole('dialog');
    fireEvent.click(within(dialog2).getByRole('tab', { name: 'Account Actions' }));
    expect(within(dialog2).getByText('Danger Zone')).toBeInTheDocument();

    fireEvent.click(within(dialog2).getByRole('button', { name: 'Ban Provider' }));
    const banConfirm = within(dialog2).getByRole('alertdialog');
    expect(within(banConfirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(within(banConfirm).getByRole('button', { name: 'Ban Provider' }));

    await waitFor(() => {
      expect(supabaseMock.state.userUpdates[0]).toEqual({
        payload: { is_banned: true },
        ids: ['user-1'],
      });
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('renders plain non-selectable profile avatars without hover checkbox overlays or bulk selection dock', async () => {
    renderProviders();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    expect(within(table).queryByRole('button', { name: 'Select Marco Reyes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk provider actions' })).not.toBeInTheDocument();
  });
});
