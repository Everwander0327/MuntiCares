import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X, House, Search, Info, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

const mobileLinks = [
  { to: '/', label: 'Home', icon: <House className="w-4 h-4" /> },
  { to: '/patient/providers', label: 'Find Providers', icon: <Search className="w-4 h-4" /> },
  { to: '#footer', label: 'About', icon: <Info className="w-4 h-4" />, isAnchor: true },
];

const menuItem = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.07, duration: 0.25 },
  }),
  exit: { opacity: 0, x: -10, transition: { duration: 0.15 } },
};

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const scrollToFooter = (e) => {
    e.preventDefault();
    const footer = document.querySelector('footer');
    if (footer) footer.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled || isAuthPage
        ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg shadow-md py-3'
        : 'bg-transparent py-5'
    }`}>
      <div className="container mx-auto px-6 flex justify-between items-center relative z-10">
        <Link to="/" className="flex items-center gap-2 group cursor-pointer">
          <motion.div
            className="bg-primary p-2 rounded-lg"
            whileHover={{ rotate: 12 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Heart className="text-white w-6 h-6" fill="currentColor" />
          </motion.div>
          <span className="text-xl font-bold text-primary tracking-tight">MuntiCares</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex gap-6">
            <Link to="/" className={`link-underline font-medium transition-colors ${isActive('/') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Home</Link>
            <Link to="/patient/providers" className={`link-underline font-medium transition-colors ${isActive('/patient/providers') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Find Providers</Link>
            <a href="#footer" onClick={scrollToFooter} className="link-underline text-slate-600 dark:text-slate-300 hover:text-primary font-medium transition-colors">About</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="flex items-center gap-4 border-l pl-4 border-slate-200 dark:border-slate-600">
              <Link to="/login" className="text-primary font-semibold hover:text-opacity-80 transition-opacity">Login</Link>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Link to="/register" className="btn-primary">Get Started</Link>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Mobile Nav Controls */}
        <div className="md:hidden flex items-center gap-1">
          <ThemeToggle />
          <motion.button
            className={`relative p-2 rounded-lg transition-colors ${
              isMobileMenuOpen
                ? 'bg-primary text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            whileTap={{ scale: 0.9 }}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <AnimatePresence mode="wait">
              {isMobileMenuOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <X className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Menu className="w-5 h-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              className="md:hidden absolute top-full left-0 right-0 h-screen bg-black/10 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
            />
            <motion.div
              className="md:hidden absolute top-full left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl shadow-2xl border-t border-slate-100 dark:border-slate-700 overflow-y-auto max-h-[calc(100vh-5rem)] px-6 py-4"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="flex flex-col gap-1">
                {mobileLinks.map((link, i) => (
                  <motion.div
                    key={link.to}
                    custom={i}
                    variants={menuItem}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    {link.isAnchor ? (
                      <a
                        href={link.to}
                        onClick={(e) => { scrollToFooter(e); }}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-primary transition-all"
                      >
                        <span className="text-slate-400">{link.icon}</span>
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        onClick={closeMenu}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all ${
                          isActive(link.to)
                            ? 'text-primary bg-primary/5 border-l-[3px] border-primary pl-[9px]'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-primary'
                        }`}
                      >
                        <span className="text-slate-400">{link.icon}</span>
                        {link.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>

              <motion.div
                custom={mobileLinks.length}
                variants={menuItem}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-3 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2"
              >
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-primary hover:bg-primary/5 transition-all"
                >
                  <LogIn className="w-4 h-4 text-primary/70" />
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="btn-primary w-full text-center"
                >
                  Get Started
                </Link>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
