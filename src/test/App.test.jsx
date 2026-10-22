import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { ThemeProvider } from '../contexts/ThemeContext';

import { AuthProvider } from '../contexts/AuthContext';
import { PresenceProvider } from '../contexts/PresenceContext';

vi.mock('../lib/supabase', () => {
  const chainHandler = {
    get(_, prop) {
      if (prop === 'then') return undefined;
      if (prop === 'catch') return undefined;
      return vi.fn().mockImplementation(() => new Proxy({}, chainHandler));
    },
  };
  const chain = new Proxy({}, chainHandler);

  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        updateUser: vi.fn(),
      },
      channel: vi.fn(() => ({
        on: vi.fn(() => ({ subscribe: vi.fn() })),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
    },
  };
});

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <AuthProvider>
        <ThemeProvider>
          <PresenceProvider>
            <App />
          </PresenceProvider>
        </ThemeProvider>
      </AuthProvider>
    );
    expect(screen.getAllByText(/MuntiCares/i).length).toBeGreaterThan(0);
  });
});
