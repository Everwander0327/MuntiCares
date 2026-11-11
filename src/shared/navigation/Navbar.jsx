import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, ArrowUpRight } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/shared/feedback';
import { useAuth } from '@/contexts/AuthContext';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isActive = (path) => location.pathname === path;

  useBodyScrollLock(isMenuOpen);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const scrollToFooter = (e) => {
    if (e) e.preventDefault();
    setIsMenuOpen(false);
    requestAnimationFrame(() => {
      const footer = document.querySelector('footer');
      if (footer) footer.scrollIntoView({ behavior: 'smooth' });
      else navigate('/#footer');
    });
  };

  return (
    <>
      {/* Full-Width Edge-to-Edge Fixed Header (Always follows smoothly as you scroll) */}
      <header className="fixed top-0 left-0 right-0 z-chrome w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          
          {/* Brand Logo with Preserved Heart Icon */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0" aria-label="MuntiCares home">
            <motion.div
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 text-link"
              whileHover={{ scale: 1.05, rotate: 6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Heart size={20} weight="fill" className="text-link fill-primary" />
            </motion.div>
            <span className="font-display text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-link dark:group-hover:text-primary-400 transition-colors">
              MuntiCares
            </span>
          </Link>

          {/* Conditional Navigation & Actions */}
          {isAuthPage ? (
            /* Auth Pages State (/login, /register): Clean Minimal Header */
            <div className="flex items-center gap-3 sm:gap-4">
              <ThemeToggle className="!w-10 !h-10 !rounded-xl" />
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400 transition-colors px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <span>&larr;</span> Back to Home
              </Link>
            </div>
          ) : (
            /* Landing & Public Pages: Full Navigation Links & Actions */
            <>
              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
                <Link
                  to="/"
                  className={`transition-colors duration-150 ${
                    isActive('/')
                      ? 'text-link dark:text-primary-400 font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Home
                </Link>
                <Link
                  to="/patient/providers"
                  className={`transition-colors duration-150 ${
                    isActive('/patient/providers')
                      ? 'text-link dark:text-primary-400 font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Find Providers
                </Link>
                <button
                  type="button"
                  onClick={scrollToFooter}
                  className="cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors duration-150"
                >
                  About
                </button>
              </nav>

              {/* Desktop Actions */}
              <div className="hidden md:flex items-center gap-3">
                <ThemeToggle className="!w-10 !h-10 !rounded-xl" />
                {user ? (
                  <Link
                    to={`/${user.role}/dashboard`}
                    className="neu-btn-primary inline-flex items-center gap-2 text-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Dashboard
                    <ArrowUpRight size={14} weight="bold" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:text-link dark:hover:text-primary-400 px-3.5 py-2 rounded-xl transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="neu-btn-primary inline-flex items-center gap-1.5 text-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Hamburger Button */}
              <div className="md:hidden flex items-center gap-2">
                <ThemeToggle className="!w-10 !h-10 !rounded-xl" />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((v) => !v)}
                  className="relative w-10 h-10 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-link cursor-pointer active:scale-95 transition-all"
                  aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={isMenuOpen}
                >
                  <div className="w-5 h-5 flex flex-col justify-center items-center gap-1">
                    <span className={`block h-0.5 w-5 bg-current rounded-full transition-transform duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                    <span className={`block h-0.5 w-5 bg-current rounded-full transition-opacity duration-200 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                    <span className={`block h-0.5 w-5 bg-current rounded-full transition-transform duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
                  </div>
                </button>
              </div>
            </>
          )}

        </div>
      </header>

      {/* In-flow spacer so page content is never hidden under the fixed header */}
      <div className="h-16 sm:h-18 w-full shrink-0" aria-hidden="true" />

      {/* Fullscreen Mobile Drawer (Under Sticky Header) */}
      <AnimatePresence>
        {isMenuOpen && !isAuthPage && (
          <motion.div
            className="fixed inset-x-0 top-16 sm:top-18 bottom-0 z-30 md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 transform-gpu overflow-y-auto"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col gap-2 px-6 py-6">
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className={`w-full py-3 px-4 rounded-xl font-display text-base font-bold transition-all ${
                  isActive('/')
                    ? 'bg-primary/10 text-link font-black'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                Home
              </Link>
              <Link
                to="/patient/providers"
                onClick={() => setIsMenuOpen(false)}
                className={`w-full py-3 px-4 rounded-xl font-display text-base font-bold transition-all ${
                  isActive('/patient/providers')
                    ? 'bg-primary/10 text-link font-black'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                Find Providers
              </Link>
              <button
                type="button"
                onClick={scrollToFooter}
                className="w-full py-3 px-4 rounded-xl font-display text-base font-bold text-left text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer"
              >
                About
              </button>

              <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
                {user ? (
                  <Link
                    to={`/${user.role}/dashboard`}
                    onClick={() => setIsMenuOpen(false)}
                    className="neu-btn-primary flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm shadow-md cursor-pointer"
                  >
                    Dashboard
                    <ArrowUpRight size={16} weight="bold" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full py-3 rounded-xl font-bold text-sm text-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setIsMenuOpen(false)}
                      className="neu-btn-primary flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm shadow-md cursor-pointer"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
