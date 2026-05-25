import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const suggestions = [
  { label: 'Elderly Care', section: 'services' },
  { label: 'Physical Therapy', section: 'services' },
  { label: 'Companion Care', section: 'services' },
  { label: 'Post-Surgery Care', section: 'services' },
  { label: 'Coverage Areas', section: 'coverage' },
  { label: 'How It Works', section: 'how-it-works' },
  { label: 'Browse All Services', to: '/patient/providers' },
];

const QuickSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const handleScroll = useCallback(() => {
    setVisible(window.scrollY > 300);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = query
    ? suggestions.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase())
      )
    : suggestions;

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-20 right-6 z-50 hidden md:block"
        >
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-shadow"
              aria-label="Search services"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500 dark:text-slate-400">Search services...</span>
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                    />
                    {query && (
                      <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto py-2">
                    {filtered.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">No results found</p>
                    ) : (
                      filtered.map((s) =>
                        s.to ? (
                          <Link
                            key={s.label}
                            to={s.to}
                            onClick={() => { setOpen(false); setQuery(''); }}
                            className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            {s.label}
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          </Link>
                        ) : (
                          <button
                            key={s.label}
                            onClick={() => scrollToSection(s.section)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                          >
                            {s.label}
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        )
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickSearch;
