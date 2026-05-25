import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';

const labels = {
  hero: { text: 'Find a Provider', link: '/patient/providers' },
  features: { text: 'See How It Works', link: '#how-it-works' },
  services: { text: 'Book a Service', link: '/patient/providers' },
  'how-it-works': { text: 'Get Started', link: '/register' },
  coverage: { text: 'Find Your Area', link: '#services' },
  testimonials: { text: 'Join Happy Families', link: '/register' },
  faq: { text: 'Still Have Questions?', link: '#cta' },
  cta: { text: 'Get Started Now', link: '/register' },
};
const defaultLabel = { text: 'Get Started', link: '/register' };

const StickyCTA = () => {
  const [active, setActive] = useState('hero');
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY + 150;
    let current = 'hero';

    const sectionIds = Object.keys(labels);
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= scrollY) {
        current = id;
      }
    }

    setActive(current);
    setVisible(window.scrollY > 700 && !dismissed);
  }, [dismissed]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const label = labels[active] || defaultLabel;
  const isHash = label.link.startsWith('#');

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700 shadow-2xl px-4 py-3 md:py-4"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium truncate">
              {active === 'hero' ? 'Find trusted home care providers in Muntinlupa' :
               active === 'features' ? 'See how MuntiCares makes home care easy' :
               active === 'services' ? 'Book the care your family deserves' :
               active === 'how-it-works' ? 'Start your journey to quality home care' :
               active === 'coverage' ? 'We cover all of Muntinlupa City' :
               active === 'testimonials' ? 'See why families trust MuntiCares' :
               active === 'faq' ? 'Have questions? We have answers' :
               'Ready to get started?'}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              {isHash ? (
                <a
                  href={label.link}
                  className="btn-primary text-sm !py-2 !px-5 flex items-center gap-2 whitespace-nowrap"
                >
                  {label.text} <ArrowRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <Link
                  to={label.link}
                  className="btn-primary text-sm !py-2 !px-5 flex items-center gap-2 whitespace-nowrap"
                >
                  {label.text} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyCTA;
