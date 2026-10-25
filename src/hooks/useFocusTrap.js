import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function useFocusTrap(active, containerRef, initialFocusRef, suspended = false) {
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;

  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const previous = document.activeElement;
    const timer = window.setTimeout(() => {
      if (!suspendedRef.current) {
        initialFocusRef?.current?.focus?.({ preventScroll: true });
      }
    }, 60);

    const onKeyDown = (event) => {
      if (suspendedRef.current || event.key !== 'Tab') return;
      const container = containerRef?.current;
      if (!container) return;
      const nodes = Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (node) => node.getClientRects().length > 0
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!container.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function') {
        previous.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef]);
}
