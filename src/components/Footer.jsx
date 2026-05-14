import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-white pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <Heart className="text-white w-6 h-6" fill="currentColor" />
              </div>
              <span className="text-2xl font-bold tracking-tight">MuntiCares</span>
            </div>
            <p className="text-slate-400 max-w-sm leading-relaxed">
              Empowering Muntinlupa City residents through safe, reliable, and compassionate home care connections.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-bold mb-6">Quick Links</h4>
            <ul className="space-y-4 text-slate-400">
              <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
              <li><Link to="/patient/providers" className="hover:text-primary transition-colors">Find Providers</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-bold mb-6">Support</h4>
            <ul className="space-y-4 text-slate-400">
              <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <hr className="border-slate-800 mb-10" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <p>© 2025 MuntiCares Muntinlupa. All rights reserved.</p>
          <div className="flex gap-6">
            <span>Made with ❤️ for Muntinlupa</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
