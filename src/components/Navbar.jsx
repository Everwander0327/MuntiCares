import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, House, MagnifyingGlass, Info, SignIn, ArrowUpRight } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

const mobileLinks = [
  { to: '/', label: 'Home', icon: <House size={18} weight="light" /> },
  { to: '/patient/providers', label: 'Find Providers', icon: <MagnifyingGlass size={18} weight="light" /> },
  { to: '#footer', label: 'About', icon: <Info size={18} weight="light" />, isAnchor: true },
];

const FLUID = [0.32, 0.72, 0, 1];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

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
      {/* Floating glass pill detached from top */}
      <div className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-4 md:pt-6 pointer-events-none">
        <motion.nav
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: FLUID }}
          className="pointer-events-auto w-full max-w-4xl rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 shadow-soft px-4 md:px-6 py-3 flex justify-between items-center"
          aria-label="Primary navigation"
        >
          <Link to="/" className="flex items-center gap-2 group shrink-0" aria-label="MuntiCares home">
            <motion.div
              className="bg-primary p-2 rounded-full shadow-card"
              whileHover={{ rotate: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Heart size={20} weight="fill" className="text-white" />
            </motion.div>
            <span className="font-display text-lg md:text-xl font-semibold text-primary tracking-tight">MuntiCares</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex gap-6">
              <Link to="/" className={`link-underline font-medium transition-all duration-700 ease-fluid ${isActive('/') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Home</Link>
              <Link to="/patient/providers" className={`link-underline font-medium transition-all duration-700 ease-fluid ${isActive('/patient/providers') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Find Providers</Link>
              <button type="button" onClick={scrollToFooter} className="link-underline text-slate-600 dark:text-slate-300 hover:text-primary font-medium transition-all duration-700 ease-fluid">About</button>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link to="/login" className="font-semibold transition-all duration-700 ease-fluid text-sm text-primary dark:text-blue-300 hover:text-primary-700 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-primary/5 dark:hover:bg-white/5">Login</Link>
              <Link to="/register" className="group inline-flex items-center gap-2 bg-primary text-white pl-6 pr-2 py-2 rounded-full font-semibold text-sm transition-all duration-700 ease-fluid hover:bg-primary-700 hover:shadow-soft active:scale-[0.98]">
                Get Started
                <span className="btn-island-icon !bg-white/20">
                  <ArrowUpRight size={16} weight="light" className="text-white" />
                </span>
              </Link>
            </div>
          </div>

          {/* Mobile hamburger morph — 2 lines rotate to X */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="relative w-11 h-11 rounded-full ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all duration-700 ease-fluid hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:scale-[0.98]"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              <span className={`absolute w-5 h-[1.5px] bg-current transition-all duration-700 ease-fluid ${isMenuOpen ? 'rotate-45 translate-y-0' : '-translate-y-[4px]'}`} />
              <span className={`absolute w-5 h-[1.5px] bg-current transition-all duration-700 ease-fluid ${isMenuOpen ? '-rotate-45 translate-y-0' : 'translate-y-[4px]'}`} />
            </button>
          </div>
        </motion.nav>
      </div>

      {/* Fullscreen glass overlay menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="fixed inset-0 z-30 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: FLUID }}
          >
            <div className="flex flex-col gap-2 px-6 pt-28 pb-10 h-full overflow-y-auto" style={{ minHeight: '100dvh' }}>
              {mobileLinks.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ translateY: 48, opacity: 0 }}
                  animate={{ translateY: 0, opacity: 1 }}
                  exit={{ translateY: 24, opacity: 0 }}
                  transition={{ duration: 0.7, ease: FLUID, delay: 0.1 + i * 0.05 }}
                >
                  {link.isAnchor ? (
                    <button
                      type="button"
                      onClick={scrollToFooter}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-[1.5rem] font-display text-2xl font-semibold text-slate-800 dark:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-700 ease-fluid text-left"
                    >
                      <span className="text-primary">{link.icon}</span>
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      to={link.to}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-4 px-4 py-4 rounded-[1.5rem] font-display text-2xl font-semibold transition-all duration-700 ease-fluid ${
                        isActive(link.to)
                          ? 'text-primary bg-primary/5'
                          : 'text-slate-800 dark:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-primary">{link.icon}</span>
                      {link.label}
                    </Link>
                  )}
                </motion.div>
              ))}

              <motion.div
                initial={{ translateY: 48, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                exit={{ translateY: 24, opacity: 0 }}
                transition={{ duration: 0.7, ease: FLUID, delay: 0.25 }}
                className="mt-4 pt-6 ring-1 ring-black/5 dark:ring-white/10 rounded-[2rem] p-2 flex flex-col gap-2"
              >
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-4 rounded-full font-semibold text-primary hover:bg-primary/5 transition-all duration-700 ease-fluid"
                >
                  <SignIn size={18} weight="light" />
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="btn-primary w-full text-center group"
                >
                  Get Started
                  <span className="btn-island-icon !bg-white/20">
                    <ArrowUpRight size={16} weight="light" className="text-white" />
                  </span>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
