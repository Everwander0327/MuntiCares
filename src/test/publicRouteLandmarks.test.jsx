import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MainLayout from '../layouts/MainLayout';
import LandingPage from '../features/landing/LandingPage';
import { AuthPage, ResetPassword } from '../features/auth';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
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
        // Real GoTrue emits INITIAL_SESSION synchronously on subscribe; AuthContext
        // only flips authInitialized from inside this callback.
        onAuthStateChange: vi.fn((callback) => {
          callback?.('INITIAL_SESSION', null);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        updateUser: vi.fn(),
      },
      channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })), subscribe: vi.fn(), unsubscribe: vi.fn() })),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
    },
  };
});

async function renderRoute(path) {
  render(
    <AuthProvider>
      <ThemeProvider>
        <PresenceProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<LandingPage />} />
                <Route path="login" element={<AuthPage />} />
                <Route path="register" element={<AuthPage />} />
                <Route path="reset-password" element={<ResetPassword />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </PresenceProvider>
      </ThemeProvider>
    </AuthProvider>
  );
  // AuthContext resolves getSession asynchronously; ResetPassword renders a
  // placeholder shell until authInitialized flips.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => {
    expect(document.querySelectorAll('main').length).toBeGreaterThan(0);
  });
}

// A Tailwind `hidden` class with no unprefixed counterpart means the element is
// display:none at the narrowest viewport, so any heading inside it is invisible
// on mobile even though it counts in the DOM.
const insideBareHidden = (el) => {
  let node = el.parentElement;
  while (node) {
    if (/(^|\s)hidden(\s|$)/.test(String(node.getAttribute('class') || ''))) return true;
    node = node.parentElement;
  }
  return false;
};

afterEach(cleanup);

describe('C5 — one main landmark per public route', () => {
  it.each(['/', '/login', '/register', '/reset-password'])('%s renders exactly one <main>', async (path) => {
    await renderRoute(path);
    expect(document.querySelectorAll('main')).toHaveLength(1);
  });
});

describe('C3 — exactly one h1, visible at the narrowest viewport', () => {
  it.each(['/', '/login', '/register', '/reset-password'])('%s has a single h1 outside any bare `hidden` ancestor', async (path) => {
    await renderRoute(path);
    const headings = [...document.querySelectorAll('h1')];
    expect(headings).toHaveLength(1);
    expect(insideBareHidden(headings[0])).toBe(false);
  });

  it('/login names the form, not the decorative marketing line', async () => {
    await renderRoute('/login');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Welcome back/i);
  });

  it('/register names the form', async () => {
    await renderRoute('/register');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Create an Account/i);
  });

  it('/reset-password names the form', async () => {
    await renderRoute('/reset-password');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Reset Password/i);
  });
});
