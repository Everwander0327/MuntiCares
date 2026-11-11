import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '../features/landing/LandingPage';

afterEach(cleanup);

// framer latches prefersReducedMotion on the first useReducedMotion() call, so the media
// query must already report `reduce` before anything motion-related renders.
function preferReducedMotion() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: /prefers-reduced-motion/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// The default observer in setup.js never fires, so whileInView reveals never start.
function revealOnObserve() {
  window.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.callback([{ target, isIntersecting: true, intersectionRatio: 1 }], this);
    }
    unobserve() {}
    disconnect() {}
  };
}

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160));
  });
};

// DESIGN.md section 7: "All motion must respect prefers-reduced-motion." MotionConfigContext
// defaults to reducedMotion: "never", so a landing that does not opt in animates a 64px slide
// for users who asked not to see one.
describe('C1 — landing reveals honor prefers-reduced-motion', () => {
  it('suppresses the y slide on a whileInView reveal when the user asks for reduced motion', async () => {
    preferReducedMotion();
    revealOnObserve();

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    await settle();

    const heading = document.getElementById('howitworks-heading');
    expect(heading).not.toBeNull();
    const reveal = heading.parentElement;

    // 160ms into an 800ms tween: an animated slide reads translateY(...), a suppressed one
    // reads none. The opacity cross-fade is allowed to keep running.
    expect(reveal.getAttribute('style')).toContain('transform: none');
  });
});
