import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './Dashboard';

const mockState = vi.hoisted(() => ({
  pendingApprovals: 0,
  shouldFail: false,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal();
  const React = await import('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div data-testid="recharts-responsive">
        {React.isValidElement(children)
          ? React.cloneElement(children, { width: 420, height: 220 })
          : children}
      </div>
    ),
  };
});

const buildFixtures = () => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 12);
  const olderDate = new Date(now.getFullYear(), now.getMonth() - 3, 10);

  const curIso = now.toISOString();
  const prevIso = prevMonth.toISOString();
  const oldIso = olderDate.toISOString();

  const requests = [
    ...Array.from({ length: 10 }, (_, idx) => ({
      id: `req-cur-${idx}`,
      created_at: curIso,
      date: '2026-11-14',
      time: '09:00 AM',
      notes: idx === 0 ? 'Bring sterile dressing kit' : '',
      service: 'Wound Care',
      status: idx === 0 ? 'Completed' : 'Pending',
      patient: { full_name: idx === 0 ? 'John Lawrence' : `Resident ${idx + 1}` },
      provider: { full_name: idx === 0 ? 'Bryan pabilar' : null },
    })),
    {
      id: 'req-prev-1',
      created_at: prevIso,
      date: '2026-10-12',
      time: '02:00 PM',
      notes: 'Routine checkup',
      service: 'Elderly Care',
      status: 'Accepted',
      patient: { full_name: 'Maria Clara' },
      provider: { full_name: 'Mang Kepweng' },
    },
    {
      id: 'req-prev-2',
      created_at: prevIso,
      date: '2026-10-12',
      time: '04:00 PM',
      notes: '',
      service: 'Wound Care',
      status: 'Cancelled',
      patient: { full_name: 'Juan Dela Cruz' },
      provider: null,
    },
  ];

  const users = [
    ...Array.from({ length: 7 }, () => ({ role: 'patient', created_at: curIso })),
    ...Array.from({ length: 3 }, () => ({ role: 'patient', created_at: prevIso })),
    { role: 'provider', created_at: curIso },
    { role: 'provider', created_at: prevIso },
    { role: 'provider', created_at: oldIso },
  ];

  const providers = [
    {
      id: 'prov-1',
      rating: 4.9,
      trust_score: 92,
      services: ['Wound Care', 'Post-Surgery Recovery'],
      user: { full_name: 'Bryan pabilar' },
    },
    {
      id: 'prov-2',
      rating: 4.7,
      trust_score: 85,
      services: ['Elderly Care'],
      user: { full_name: 'Mang Kepweng' },
    },
  ];

  return { requests, users, providers };
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      const fixtures = buildFixtures();

      const chain = {
        _selectOpts: null,
        _eqs: {},
        select(_cols, opts) {
          this._selectOpts = opts || null;
          return this;
        },
        eq(col, val) {
          this._eqs[col] = val;
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        then(resolve, reject) {
          if (mockState.shouldFail) {
            return Promise.resolve({
              data: null,
              count: null,
              error: { message: 'Database unavailable' },
            }).then(resolve, reject);
          }
          let payload;
          if (table === 'users') {
            if (this._selectOpts?.head) {
              payload = { count: this._eqs.role === 'patient' ? 10 : 3, error: null };
            } else {
              payload = { data: fixtures.users, error: null };
            }
          } else if (table === 'requests') {
            if (this._selectOpts?.head) {
              payload = { count: fixtures.requests.length, error: null };
            } else {
              payload = { data: fixtures.requests, error: null };
            }
          } else if (table === 'providers') {
            if (this._selectOpts?.head) {
              payload = { count: mockState.pendingApprovals, error: null };
            } else {
              payload = { data: fixtures.providers, error: null };
            }
          } else {
            payload = { data: [], count: 0, error: null };
          }
          return Promise.resolve(payload).then(resolve, reject);
        },
      };

      return chain;
    }),
  },
}));

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );

describe('AdminDashboard (Direction 3 Bento)', () => {
  beforeEach(() => {
    mockState.pendingApprovals = 0;
    mockState.shouldFail = false;
  });

  it('renders compact header, 4 Bento KPI tiles with share/momentum, and Clear approvals state', async () => {
    const monthLabel = new Date().toLocaleDateString('en-US', { month: 'short' });
    renderDashboard();

    expect(await screen.findByText('Platform Analytics')).toBeInTheDocument();
    expect(screen.getByText('All Time Overview')).toBeInTheDocument();

    const kpiRegion = screen.getByRole('region', { name: 'Key metrics' });
    const kpis = within(kpiRegion);

    expect(kpis.getByText('Patients')).toBeInTheDocument();
    expect(kpis.getByText('76.9%')).toBeInTheDocument();
    expect(kpis.getByText('10')).toBeInTheDocument();

    expect(kpis.getByText('Providers')).toBeInTheDocument();
    expect(kpis.getByText('23.1%')).toBeInTheDocument();
    expect(kpis.getByText('3')).toBeInTheDocument();

    expect(kpis.getByText('Bookings')).toBeInTheDocument();
    expect(kpis.getByText('12')).toBeInTheDocument();
    expect(kpis.getByText(`5x ${monthLabel}`)).toBeInTheDocument();
    expect(screen.getByText(`Peak ${monthLabel} (10)`)).toBeInTheDocument();

    expect(kpis.getByText('Approvals')).toBeInTheDocument();
    expect(kpis.getByText('Verified')).toBeInTheDocument();
    expect(kpis.getByText('Clear')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Patients/i })).toHaveAttribute('href', '/admin/patients');
    expect(screen.getByRole('link', { name: /Providers/i })).toHaveAttribute('href', '/admin/providers');
    expect(screen.getByRole('link', { name: /Bookings/i })).toHaveAttribute('href', '/admin/requests');
    expect(screen.getByRole('link', { name: /Approvals/i })).toHaveAttribute('href', '/admin/providers');
    expect(screen.getAllByRole('link', { name: /View all/i })).toHaveLength(2);
  });

  it('renders Review action link when pending provider approvals exist', async () => {
    mockState.pendingApprovals = 2;
    renderDashboard();

    expect(await screen.findByText('Action Req')).toBeInTheDocument();
    const reviewLink = screen.getByRole('link', { name: /Review/i });
    expect(reviewLink).toHaveAttribute('href', '/admin/providers');
  });

  it('switches User Growth window between 6 Months and 12 Months and toggles series filters', async () => {
    renderDashboard();

    expect(await screen.findByText('User Growth (6 Months)')).toBeInTheDocument();

    const growthWindowGroup = within(screen.getByRole('group', { name: 'User growth window' }));
    const sixMonthsBtn = growthWindowGroup.getByRole('button', { name: '6 Months' });
    const twelveMonthsBtn = growthWindowGroup.getByRole('button', { name: '12 Months' });
    expect(sixMonthsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(twelveMonthsBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(twelveMonthsBtn);
    expect(screen.getByText('User Growth (12 Months)')).toBeInTheDocument();
    expect(sixMonthsBtn).toHaveAttribute('aria-pressed', 'false');
    expect(twelveMonthsBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(sixMonthsBtn);
    expect(screen.getByText('User Growth (6 Months)')).toBeInTheDocument();

    const providersToggle = screen.getByRole('button', { name: 'Providers' });
    expect(providersToggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(providersToggle);
    expect(providersToggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens request and provider swipe-down detail sheets without visible mobile X close button', async () => {
    renderDashboard();

    const johnCard = await screen.findByRole('button', { name: /John Lawrence/i });
    fireEvent.click(johnCard);

    expect(await screen.findByText('Bring sterile dressing kit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Requests Manager/i })).toHaveAttribute('href', '/admin/requests');

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Bring sterile dressing kit')).not.toBeInTheDocument();
    });

    const providerBtns = screen.getAllByRole('button', { name: /Bryan pabilar/i });
    expect(screen.getAllByText('92/100').length).toBeGreaterThan(0);
    fireEvent.click(providerBtns[0]);
    expect(await screen.findByText('Approved Healthcare Provider')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage Providers/i })).toHaveAttribute('href', '/admin/providers');
  });

  it('opens mobile filter sheet and applies 30D preset filtering bookings to recent 30 days', async () => {
    renderDashboard();

    const filterBtn = await screen.findByRole('button', { name: /Open date range filter/i });
    fireEvent.click(filterBtn);

    expect(await screen.findByText('Filter Analytics Range')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }));

    expect(await screen.findByText('Last 30 Days Overview')).toBeInTheDocument();
  });

  it('renders an explicit error state with retry action when analytics queries fail', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockState.shouldFail = true;
    renderDashboard();

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    mockState.shouldFail = false;

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('All Time Overview')).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });
});
