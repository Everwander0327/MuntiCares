import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Menu, X } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);    
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'}`}>
      <div className="container mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="bg-primary p-2 rounded-lg group-hover:rotate-12 transition-transform">
            <Heart className="text-white w-6 h-6" fill="currentColor" />
          </div>
          <span className="text-xl font-bold text-primary tracking-tight">MuntiCares</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex gap-6">
            <Link to="/" className="text-slate-600 hover:text-primary font-medium transition-colors">Home</Link>
            <Link to="/patient/providers" className="text-slate-600 hover:text-primary font-medium transition-colors">Find Providers</Link>
            <a href="#footer" onClick={scrollToFooter} className="text-slate-600 hover:text-primary font-medium transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4 border-l pl-8 border-slate-200">
            <Link to="/login" className="text-primary font-semibold hover:text-opacity-80 transition-opacity">Login</Link>
            <Link to="/register" className="btn-primary">Get Started</Link>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden text-slate-700" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-xl py-6 px-6 flex flex-col gap-4 border-t border-slate-100">
          <Link to="/" className="text-slate-600 font-medium py-2" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
          <Link to="/patient/providers" className="text-slate-600 font-medium py-2" onClick={() => setIsMobileMenuOpen(false)}>Find Providers</Link>
          <a href="#footer" onClick={scrollToFooter} className="text-slate-600 font-medium py-2">About</a>
          <hr className="border-slate-100" />
          <Link to="/login" className="text-primary font-semibold py-2 text-left" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
          <Link to="/register" className="btn-primary w-full text-center" onClick={() => setIsMobileMenuOpen(false)}>Get Started</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
