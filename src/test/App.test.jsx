import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { ThemeProvider } from '../contexts/ThemeContext';

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
      channel: vi.fn(() => ({
        on: vi.fn(() => ({ subscribe: vi.fn() })),
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
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    expect(screen.getAllByText(/MuntiCares/i).length).toBeGreaterThan(0);
  });
});
