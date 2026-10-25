import { useEffect } from 'react';

let lockCount = 0;

export default function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    lockCount += 1;
    document.body.classList.add('modal-open');
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.classList.remove('modal-open');
    };
  }, [active]);
}
