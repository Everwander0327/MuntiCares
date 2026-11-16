import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPatients from './Patients';

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
    shouldFail: false,
    users: [],
    requestsByPatient: {},
    updateCalls: [],
    deleteCalls: [],
  };

  const reset = () => {
    state.shouldFail = false;
    state.updateCalls = [];
    state.deleteCalls = [];
    state.users = [
      {
        id: 'pat-1',
        full_name: 'John Rivera',
        email: 'john@munticares.ph',
        avatar_url: '',
        is_banned: false,
        created_at: daysAgoIso(2),
      },
      {
        id: 'pat-2',
        full_name: 'Kaylle Pabilar',
        email: 'kaylle@munticares.ph',
        avatar_url: '',
        is_banned: false,
        created_at: daysAgoIso(10),
      },
      {
        id: 'pat-3',
        full_name: 'Neko Forger',
        email: 'neko@munticares.ph',
        avatar_url: '',
        is_banned: true,
        created_at: daysAgoIso(45),
      },
    ];
    state.requestsByPatient = {
      'pat-1': [
        {
          id: 'req-1',
          service: 'Wound Care',
          status: 'Completed',
          date: '2026-11-10',
          created_at: daysAgoIso(3),
          provider: { full_name: 'Nurse Santos' },
        },
      ],
      'pat-2': [],
      'pat-3': [
        {
          id: 'req-2',
          service: 'Medication Aid',
          status: 'Pending',
          date: '2026-11-05',
          created_at: daysAgoIso(8),
          provider: { full_name: 'Dr. Cruz' },
        },
      ],
    };
  };

  reset();

  const from = vi.fn((table) => {
    if (table === 'users') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() =>
              Promise.resolve(
                state.shouldFail
                  ? { data: null, error: { message: 'Network error' } }
                  : { data: state.users, error: null }
              )
            ),
          })),
        })),
        update: vi.fn((payload) => ({
          eq: vi.fn((_col, id) => {
            state.updateCalls.push({ payload, ids: [id] });
            state.users = state.users.map((u) => (u.id === id ? { ...u, ...payload } : u));
            return Promise.resolve({ error: null });
          }),
          in: vi.fn((_col, ids) => {
            state.updateCalls.push({ payload, ids });
            state.users = state.users.map((u) => (ids.includes(u.id) ? { ...u, ...payload } : u));
            return Promise.resolve({ error: null });
          }),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((_col, id) => {
            state.deleteCalls.push([id]);
            state.users = state.users.filter((u) => u.id !== id);
            return Promise.resolve({ error: null });
          }),
          in: vi.fn((_col, ids) => {
            state.deleteCalls.push(ids);
            state.users = state.users.filter((u) => !ids.includes(u.id));
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }

    if (table === 'requests') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_col, patientId) => ({
            order: vi.fn(() => ({
              limit: vi.fn(() =>
                Promise.resolve({
                  data: state.requestsByPatient[patientId] || [],
                  error: null,
                })
              ),
            })),
          })),
        })),
      };
    }

    return {};
  });

  return { state, reset, client: { from } };
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
  const MOTION_KEYS = new Set(['initial', 'animate', 'exit', 'transition', 'variants']);
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
  };
});

function mockViewport({ desktop }) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(min-width: 1024px)' ? desktop : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderPatients() {
  return render(
    <MemoryRouter>
      <AdminPatients />
    </MemoryRouter>
  );
}

describe('AdminPatients (Option 1 Clinical Split + Mobile Sheet)', () => {
  beforeEach(() => {
    supabaseMock.reset();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    exportMock.exportToCSV.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders desktop split view with sortable headers, sticky inspector, and search input', async () => {
    mockViewport({ desktop: true });
    renderPatients();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Manage Patients' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Search patients by name or email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Banned (1)' })).toBeInTheDocument();

    // Right inspector shows first patient and loads booking history
    const inspector = screen.getByLabelText('Patient inspector');
    expect(within(inspector).getByRole('heading', { level: 3, name: 'John Rivera' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(inspector).getByText('Wound Care')).toBeInTheDocument();
    });

    // Clicking Inspect on another row switches the inspector
    const nekoRow = screen.getByText('Neko Forger').closest('tr');
    fireEvent.click(within(nekoRow).getByRole('button', { name: 'Inspect' }));
    expect(within(inspector).getByRole('heading', { level: 3, name: 'Neko Forger' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(inspector).getByText('Medication Aid')).toBeInTheDocument();
    });

    // Sortable table updates aria-sort cleanly
    const residentSortBtn = screen.getByRole('button', { name: /^Resident/i });
    const residentTh = residentSortBtn.closest('th');
    fireEvent.click(residentSortBtn);
    expect(residentTh).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(residentSortBtn);
    expect(residentTh).toHaveAttribute('aria-sort', 'descending');
  });

  it('supports inline profile editing and in-app destructive confirmation without window.confirm', async () => {
    mockViewport({ desktop: true });
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderPatients();

    const inspector = await waitFor(() => screen.getByLabelText('Patient inspector'));
    fireEvent.click(within(inspector).getByRole('button', { name: 'Edit Info' }));

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'John Rivera Jr.' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'john.jr@munticares.ph' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(supabaseMock.state.updateCalls[0]).toEqual({
        payload: { full_name: 'John Rivera Jr.', email: 'john.jr@munticares.ph' },
        ids: ['pat-1'],
      });
      expect(toastMock.success).toHaveBeenCalledWith('Patient details updated successfully.');
    });

    // Ban confirmation dialog focuses Cancel safely and never uses window.confirm
    fireEvent.click(within(inspector).getByRole('button', { name: 'Ban Resident' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Ban John Rivera Jr.?');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ban Resident' }));
    await waitFor(() => {
      expect(supabaseMock.state.updateCalls[1]).toEqual({
        payload: { is_banned: true },
        ids: ['pat-1'],
      });
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('renders clean patient rows without selection checkboxes or bulk action dock', async () => {
    mockViewport({ desktop: true });
    renderPatients();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('Select John Rivera')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Select all filtered patients')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk patient actions' })).not.toBeInTheDocument();
  });

  it('opens mobile slide-up sheet, filters dates, and exports CSV cleanly', async () => {
    mockViewport({ desktop: false });
    renderPatients();

    await waitFor(() => {
      expect(screen.getByText('John Rivera')).toBeInTheDocument();
    });

    // Toggle date range drawer and filter Last 30 Days (filters out 45-day-old Neko Forger)
    fireEvent.click(screen.getByRole('button', { name: 'Date Range' }));
    expect(screen.getByLabelText('Joined From')).toBeInTheDocument();
    expect(screen.getByLabelText('Joined To')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }));
    expect(screen.getByText('John Rivera')).toBeInTheDocument();
    expect(screen.queryByText('Neko Forger')).not.toBeInTheDocument();

    // Open mobile slide-up Patient Record sheet
    const openButtons = screen.getAllByRole('button', { name: 'Open Record' });
    fireEvent.click(openButtons[0]);
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveTextContent('Patient Record');
    await waitFor(() => {
      expect(within(sheet).getByText('Wound Care')).toBeInTheDocument();
    });
    expect(within(sheet).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    // Export CSV exports filtered residents
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(exportMock.exportToCSV).toHaveBeenCalledWith(expect.any(Array), 'patients_export');
  });

  it('renders error alert and recovers cleanly on Retry', async () => {
    mockViewport({ desktop: true });
    supabaseMock.state.shouldFail = true;
    renderPatients();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load residents');

    supabaseMock.state.shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        within(screen.getByLabelText('Patient inspector')).getByRole('heading', {
          level: 3,
          name: 'John Rivera',
        })
      ).toBeInTheDocument();
    });
  });
});
