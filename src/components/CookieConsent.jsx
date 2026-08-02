import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'mc_cookie_consent';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-2xl"
        >
          <div className="container mx-auto px-6 py-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center sm:text-left">
              This site uses cookies to improve your experience. By continuing to browse, you agree to our use of cookies.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={accept}
                className="btn-primary text-sm whitespace-nowrap"
              >
                Accept
              </button>
              <button
                onClick={() => setVisible(false)}
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
