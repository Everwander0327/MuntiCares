import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ComingSoonModal from './ComingSoonModal';

const Footer = () => {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <footer className="bg-slate-900 text-white pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div className="space-y-6">
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
              <li><Link to="/" className="link-underline hover:text-primary transition-colors">Home</Link></li>
              <li><Link to="/patient/providers" className="link-underline hover:text-primary transition-colors">Find Providers</Link></li>
              <li><button onClick={() => setShowComingSoon(true)} className="link-underline hover:text-primary transition-colors bg-transparent p-0 border-none cursor-pointer text-inherit">Contact</button></li>
            </ul>
          </div>
        </div>
        <hr className="border-slate-800 mb-10" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <p>© 2025 MuntiCares Muntinlupa. All rights reserved.</p>
        </div>
      </div>

      <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} message="Contact page is under development." />
    </footer>
  );
};

export default Footer;
