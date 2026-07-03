import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled || isAuthPage
        ? 'bg-white/90 backdrop-blur-lg shadow-md py-3'
        : 'bg-transparent py-5'
    }`}>
      <div className="container mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-primary p-2 rounded-lg group-hover:rotate-12 transition-transform">
            <Heart className="text-white w-6 h-6" fill="currentColor" />
          </div>
          <span className="text-xl font-bold text-primary tracking-tight">MuntiCares</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <div className="flex gap-6">
            <Link to="/" className="link-underline font-medium text-slate-600 hover:text-primary transition-colors">Home</Link>
            <Link to="/patient/providers" className="link-underline font-medium text-slate-600 hover:text-primary transition-colors">Find Providers</Link>
            <a href="#footer" className="link-underline font-medium text-slate-600 hover:text-primary transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4 border-l pl-4 border-slate-200">
            <Link to="/login" className="text-primary font-semibold hover:text-opacity-80 transition-opacity">Login</Link>
            <Link to="/register" className="btn-primary">Get Started</Link>
          </div>
        </div>

        <button
          className="md:hidden text-slate-700 p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-xl py-6 px-6 flex flex-col gap-4 border-t border-slate-100">
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-600 font-medium py-2">Home</Link>
          <Link to="/patient/providers" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-600 font-medium py-2">Find Providers</Link>
          <a href="#footer" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-600 font-medium py-2">About</a>
          <hr className="border-slate-100" />
          <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-primary font-semibold py-2">Login</Link>
          <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full text-center">Get Started</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
