import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './Dashboard';

const mockState = vi.hoisted(() => ({
  pendingApprovals: 0,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('@/hooks/useCountUp', () => ({
  default: (end) => ({ count: end, ref: { current: null } }),
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
  });

  it('renders Review action link when pending provider approvals exist', async () => {
    mockState.pendingApprovals = 2;
    renderDashboard();

    expect(await screen.findByText('Action Req')).toBeInTheDocument();
    const reviewLink = screen.getByRole('link', { name: 'Review' });
    expect(reviewLink).toHaveAttribute('href', '/admin/providers');
  });

  it('switches User Growth window between 6M and 12M and toggles series pills', async () => {
    renderDashboard();

    expect(await screen.findByText('User Growth (6 Months)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to 12M' }));
    expect(screen.getByText('User Growth (12 Months)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to 6M' })).toBeInTheDocument();

    const prosPill = screen.getByRole('button', { name: 'Pros' });
    expect(prosPill).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(prosPill);
    expect(prosPill).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens request and provider swipe-down detail sheets without visible mobile X close button', async () => {
    renderDashboard();

    const johnCard = await screen.findByRole('button', { name: /John Lawrence/i });
    fireEvent.click(johnCard);

    expect(await screen.findByText('Bring sterile dressing kit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Requests Manager/i })).toHaveAttribute('href', '/admin/requests');

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn.className).toContain('hidden');
    expect(closeBtn.className).toContain('sm:flex');

    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText('Bring sterile dressing kit')).not.toBeInTheDocument();
    });

    const providerBtns = screen.getAllByRole('button', { name: /Bryan pabilar/i });
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
});
