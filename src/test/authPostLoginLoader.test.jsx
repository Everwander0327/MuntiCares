import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loginMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    login: loginMock,
    register: vi.fn(),
    setPassword: vi.fn(),
  }),
}));

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    context: (fn) => {
      fn();
      return { revert: vi.fn() };
    },
    fromTo: vi.fn(),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import AuthPage from '@/features/auth/pages/AuthPage';

describe('AuthPage post-login BrandLoader transition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loginMock.mockReset();
    loginMock.mockResolvedValue({ id: 'u1', role: 'patient' });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('shows BrandLoader for the full 3.6s animation cycle after successful login before navigating to the portal', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/patient/dashboard" element={<div>Patient Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'maria@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'secret123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
      await Promise.resolve();
    });

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('progressbar', { name: /Opening your MuntiCares portal/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Opening your portal/i })).toBeInTheDocument();
    expect(screen.queryByText('Patient Dashboard')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3599);
    });
    expect(screen.queryByText('Patient Dashboard')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Patient Dashboard')).toBeInTheDocument();
  });
});
