import { Link } from 'react-router-dom';
import { Heart, Envelope, MapPin, Phone } from '@phosphor-icons/react';

const Footer = () => (
  <footer id="footer" className="bg-slate-900 dark:bg-ink text-white pt-20 md:pt-28 pb-10">
    <div className="container mx-auto px-4 md:px-6">
      <div className="grid gap-12 md:grid-cols-12 mb-16">
        <div className="col-span-1 md:col-span-6 space-y-6">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-full shadow-card">
              <Heart size={22} weight="fill" className="text-white" />
            </div>
            <span className="font-display text-2xl font-semibold tracking-tight">MuntiCares</span>
          </div>
          <p className="text-slate-300 max-w-sm leading-relaxed text-sm">
            Empowering Muntinlupa City residents through safe, reliable, and compassionate home care connections.
          </p>
          <div className="space-y-2 text-sm text-slate-300">
            <p className="flex items-center gap-2"><MapPin size={16} weight="light" className="text-primary-300" /> Muntinlupa City, Metro Manila</p>
            <p className="flex items-center gap-2"><Envelope size={16} weight="light" className="text-primary-300" /> support@munticares.ph</p>
            <p className="flex items-center gap-2"><Phone size={16} weight="light" className="text-primary-300" /> Mon-Sat, 8am-6pm</p>
          </div>
        </div>
        <div className="col-span-1 md:col-span-3">
          <h4 className="font-display text-lg font-semibold mb-6 text-white">Explore</h4>
          <ul className="space-y-4 text-sm text-slate-300">
            <li><Link to="/patient/providers" className="hover:text-white transition-colors">Find Providers</Link></li>
            <li><Link to="/register" className="hover:text-white transition-colors">Join Network</Link></li>
            <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
            <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
          </ul>
        </div>
        <div className="col-span-1 md:col-span-3">
          <h4 className="font-display text-lg font-semibold mb-6 text-white">Legal & Compliance</h4>
          <ul className="space-y-4 text-sm text-slate-300">
            <li><span className="text-slate-400">RA 10173 (Data Privacy Act)</span></li>
            <li><span className="text-slate-400">City Health Office Muntinlupa</span></li>
            <li><span className="text-slate-400">Verified PRC License Registry</span></li>
          </ul>
        </div>
      </div>
      <div className="pt-8 border-t border-slate-800 text-xs text-slate-400 flex flex-col md:flex-row justify-between items-center gap-4">
        <p>&copy; {new Date().getFullYear()} MuntiCares. All rights reserved.</p>
        <p>Built for the people of Muntinlupa City.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
