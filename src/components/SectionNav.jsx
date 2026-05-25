import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'features', label: 'Features' },
  { id: 'services', label: 'Services' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'faq', label: 'FAQ' },
  { id: 'cta', label: 'CTA' },
];

const SectionNav = () => {
  const [active, setActive] = useState('hero');
  const [visible, setVisible] = useState(false);

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY + 150;
    let current = 'hero';

    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= scrollY) {
        current = id;
      }
    }

    setActive(current);
    setVisible(window.scrollY > 400);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-center gap-3"
          aria-label="Section navigation"
        >
          {sections.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="group relative flex items-center"
              aria-label={`Scroll to ${label}`}
            >
              <span className="absolute right-full mr-3 px-2 py-1 text-xs font-medium text-white bg-slate-800 dark:bg-slate-200 dark:text-slate-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {label}
              </span>
              <div
                className={`rounded-full transition-all duration-300 ${
                  id === active
                    ? 'w-3 h-3 bg-primary shadow-md shadow-primary/40'
                    : 'w-2 h-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                }`}
              />
            </button>
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
};

export default SectionNav;
