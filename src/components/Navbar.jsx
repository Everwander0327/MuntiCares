import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);    
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToFooter = (e) => {
    e.preventDefault();
    const footer = document.querySelector('footer');
    if (footer) {
      footer.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg shadow-md py-3' : 'bg-transparent py-5'}`}>
      <div className="container mx-auto px-6 flex justify-between items-center">
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
        <div className="hidden md:flex items-center gap-8">
          <div className="flex gap-6">
            <Link to="/" className={`font-medium transition-colors ${isActive('/') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Home</Link>
            <Link to="/patient/providers" className={`font-medium transition-colors ${isActive('/patient/providers') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>Find Providers</Link>
            <a href="#footer" onClick={scrollToFooter} className="text-slate-600 dark:text-slate-300 hover:text-primary font-medium transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4 border-l pl-8 border-slate-200 dark:border-slate-600">
            <Link to="/login" className="text-primary font-semibold hover:text-opacity-80 transition-opacity">Login</Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Link to="/register" className="btn-primary">Get Started</Link>
            </motion.div>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <motion.button 
          className="md:hidden text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait">
            {isMobileMenuOpen ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <X />
              </motion.div>
            ) : (
              <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Menu />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-800 shadow-xl py-6 px-6 flex flex-col gap-4 border-t border-slate-100 dark:border-slate-700"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Link to="/" className={`font-medium py-2 transition-colors ${isActive('/') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`} onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
            <Link to="/patient/providers" className={`font-medium py-2 transition-colors ${isActive('/patient/providers') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`} onClick={() => setIsMobileMenuOpen(false)}>Find Providers</Link>
            <a href="#footer" onClick={scrollToFooter} className="text-slate-600 dark:text-slate-300 font-medium py-2 hover:text-primary transition-colors">About</a>
            <hr className="border-slate-100 dark:border-slate-700" />
            <Link to="/login" className="text-primary font-semibold py-2 text-left" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
            <Link to="/register" className="btn-primary w-full text-center" onClick={() => setIsMobileMenuOpen(false)}>Get Started</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
