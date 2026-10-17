import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, House, MagnifyingGlass, Info, SignIn, ArrowUpRight } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/shared/feedback';
import { useAuth } from '@/contexts/AuthContext';

const mobileLinks = [
  { to: '/', label: 'Home', icon: <House size={18} weight="light" /> },
  { to: '/patient/providers', label: 'Find Providers', icon: <MagnifyingGlass size={18} weight="light" /> },
  { to: '#footer', label: 'About', icon: <Info size={18} weight="light" />, isAnchor: true },
];

const FLUID = [0.32, 0.72, 0, 1];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
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
          className="pointer-events-auto w-full max-w-4xl neu-flat rounded-full px-4 md:px-6 py-2.5 sm:py-3 flex justify-between items-center"
          aria-label="Primary navigation"
        >
          <Link to="/" className="flex items-center gap-2.5 group shrink-0" aria-label="MuntiCares home">
            <motion.div
              className="neu-flat-sm p-2 rounded-2xl"
              whileHover={{ rotate: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Heart size={20} weight="fill" className="text-primary fill-primary" />
            </motion.div>
            <span className="font-display text-lg md:text-xl font-black text-primary tracking-tight">MuntiCares</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex gap-6">
              <Link to="/" className={`font-bold text-sm transition-all ${isActive('/') ? 'text-primary underline underline-offset-4 decoration-2' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Home</Link>
              <Link to="/patient/providers" className={`font-bold text-sm transition-all ${isActive('/patient/providers') ? 'text-primary underline underline-offset-4 decoration-2' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Find Providers</Link>
              <button type="button" onClick={scrollToFooter} className="cursor-pointer text-slate-600 dark:text-slate-300 hover:text-primary font-bold text-sm transition-all">About</button>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle className="!w-10 !h-10 !rounded-2xl" />
              {user ? (
                <Link to={`/${user.role}/dashboard`} className="neu-btn-primary group inline-flex items-center gap-2 text-white pl-5 pr-2.5 py-2 rounded-2xl font-bold text-xs sm:text-sm shadow-md active:scale-[0.98]">
                  Dashboard
                  <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <ArrowUpRight size={14} weight="bold" className="text-white" />
                  </span>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="neu-btn font-bold text-xs sm:text-sm text-primary px-4 py-2 rounded-xl transition-all">Login</Link>
                  <Link to="/register" className="neu-btn-primary group inline-flex items-center gap-2 text-white pl-5 pr-2.5 py-2 rounded-2xl font-bold text-xs sm:text-sm shadow-md active:scale-[0.98]">
                    Get Started
                    <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                      <ArrowUpRight size={14} weight="bold" className="text-white" />
                    </span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile hamburger button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle className="!w-10 !h-10 !rounded-xl" />
            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="neu-btn relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-primary cursor-pointer active:scale-95 transition-all"
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
        </motion.nav>
      </div>

      {/* Fullscreen neumorphic overlay drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="fixed inset-0 z-30 md:hidden bg-[#ebf1f8] dark:bg-[#151f31] transform-gpu will-change-transform"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col gap-3 px-6 pt-24 pb-10 h-full overflow-y-auto" style={{ minHeight: '100dvh' }}>
              {mobileLinks.map((link) => (
                <div key={link.label}>
                  {link.isAnchor ? (
                    <button
                      type="button"
                      onClick={scrollToFooter}
                      className="neu-btn w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-display text-lg font-bold text-slate-800 dark:text-slate-100 transition-all text-left cursor-pointer"
                    >
                      <span className="text-primary">{link.icon}</span>
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      to={link.to}
                      onClick={() => setIsMenuOpen(false)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-display text-lg font-bold transition-all ${
                        isActive(link.to)
                          ? 'neu-pressed text-primary font-black'
                          : 'neu-btn text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <span className="text-primary">{link.icon}</span>
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}

              <div className="neu-flat rounded-3xl p-3.5 mt-3 flex flex-col gap-2.5">
                {user ? (
                  <Link
                    to={`/${user.role}/dashboard`}
                    onClick={() => setIsMenuOpen(false)}
                    className="neu-btn-primary flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-sm shadow-md cursor-pointer"
                  >
                    Dashboard
                    <ArrowUpRight size={16} weight="bold" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="neu-btn flex items-center justify-center gap-2.5 py-3 rounded-2xl font-bold text-sm text-primary transition-all cursor-pointer"
                    >
                      <SignIn size={18} weight="bold" />
                      Login to Account
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setIsMenuOpen(false)}
                      className="neu-btn-primary flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-sm shadow-md cursor-pointer"
                    >
                      Get Started
                      <ArrowUpRight size={16} weight="bold" />
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
