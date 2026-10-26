import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'mc_cookie_consent';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef(null);

  useEffect(() => {
    try {
      const consent = typeof localStorage !== 'undefined' ? localStorage?.getItem(STORAGE_KEY) : null;
      if (!consent) {
        const timer = setTimeout(() => setVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  // Expose the banner height so fixed-overlay pages can reserve space for it.
  useEffect(() => {
    const root = document.documentElement;
    if (!visible || !bannerRef.current) {
      root.removeAttribute('data-cookie-banner');
      root.style.removeProperty('--cookie-banner-height');
      return;
    }

    const el = bannerRef.current;
    const applyHeight = () => {
      root.style.setProperty('--cookie-banner-height', `${el.offsetHeight}px`);
    };
    applyHeight();
    window.addEventListener('resize', applyHeight);
    root.setAttribute('data-cookie-banner', 'visible');

    return () => {
      window.removeEventListener('resize', applyHeight);
      root.removeAttribute('data-cookie-banner');
      root.style.removeProperty('--cookie-banner-height');
    };
  }, [visible]);

  const accept = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, 'accepted');
      }
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={bannerRef}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-2xl"
        >
          <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 justify-between">
            <p className="flex-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 text-left leading-snug">
              This site uses cookies to improve your experience. By continuing to browse, you agree to our use of cookies.
            </p>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={accept}
                className="btn-primary text-sm whitespace-nowrap"
              >
                Accept
              </button>
              <button
                onClick={accept}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
