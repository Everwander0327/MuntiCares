import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeeklyUpdatesModal from './WeeklyUpdatesModal';

describe('WeeklyUpdatesModal', () => {
  it('renders recent events and announcements, handles event link clicks, and triggers Dont show again', () => {
    const onOpenChange = vi.fn();
    const onDontShowAgain = vi.fn();
    const onNavigate = vi.fn();

    render(
      <WeeklyUpdatesModal
        open={true}
        onOpenChange={onOpenChange}
        onDontShowAgain={onDontShowAgain}
        onNavigate={onNavigate}
        events={[
          {
            id: 'e1',
            title: 'Wear Red Day Wellness',
            cleanMessage: 'Poblacion Health Center activity.',
            eventImage: '/images/carousel/caravan.jpg',
            eventLink: '/patient/providers',
            created_at: '2026-11-16T08:00:00Z',
          },
        ]}
        announcements={[
          {
            id: 'a1',
            title: 'Extended Clinic Schedule',
            cleanMessage: 'Open until 6 PM this week.',
            target_audience: 'patients',
            created_at: '2026-11-16T07:00:00Z',
          },
          {
            id: 'a2',
            title: 'System Maintenance',
            cleanMessage: 'Brief downtime Sunday.',
            target_audience: 'all',
            created_at: '2026-11-16T06:00:00Z',
          },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: /weekly updates/i })).toBeInTheDocument();
    expect(screen.getByText('Wear Red Day Wellness')).toBeInTheDocument();
    expect(screen.getByText('Extended Clinic Schedule')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /wear red day wellness/i }));
    expect(onNavigate).toHaveBeenCalledWith('/patient/providers');
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: /don't show again/i }));
    expect(onDontShowAgain).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows empty state when reopened with no recent events or news', () => {
    render(
      <WeeklyUpdatesModal
        open={true}
        onOpenChange={vi.fn()}
        events={[]}
        announcements={[]}
      />
    );

    expect(screen.getByText(/no recent events or news/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /don't show again/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close weekly updates/i })).not.toBeInTheDocument();
  });
});
