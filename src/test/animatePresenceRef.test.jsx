import { useRef } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { AnimatePresence, motion } from 'framer-motion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CookieConsent from '../shared/feedback/CookieConsent';

// React 18.3 installs a dev-only getter on `element.props.ref`. framer-motion's
// PopChild used to read it for every AnimatePresence child, so any `ref` on a
// presence child surfaced as a console error (framer-motion #3745).
const REF_PROP_WARNING = /`ref` is not a prop/;

function BannerWithRef() {
  const bannerRef = useRef(null);
  return (
    <AnimatePresence>
      <motion.div ref={bannerRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        measured banner
      </motion.div>
    </AnimatePresence>
  );
}

describe('C14/C15 — a ref on an AnimatePresence child is not a React 18.3 warning', () => {
  let errors;

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const refWarnings = () => errors.filter((line) => REF_PROP_WARNING.test(line));

  it('renders a presence child that carries a ref without warning', () => {
    render(<BannerWithRef />);
    expect(screen.getByText('measured banner')).toBeInTheDocument();
    expect(refWarnings()).toEqual([]);
  });

  it('renders CookieConsent with its height-measuring ref without warning', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/This site uses cookies/i)).toBeInTheDocument();
    expect(refWarnings()).toEqual([]);
  });
});
