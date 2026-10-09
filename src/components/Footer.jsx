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
          <ul className="space-y-4 text-slate-300 text-sm">
            <li><Link to="/" className="link-underline hover:text-white transition-all duration-700 ease-fluid">Home</Link></li>
            <li><a href="#services" className="link-underline hover:text-white transition-all duration-700 ease-fluid">Services</a></li>
            <li><Link to="/patient/providers" className="link-underline hover:text-white transition-all duration-700 ease-fluid">Find Providers</Link></li>
            <li><a href="#how-it-works" className="link-underline hover:text-white transition-all duration-700 ease-fluid">How it works</a></li>
          </ul>
        </div>
        <div className="col-span-1 md:col-span-3">
          <h4 className="font-display text-lg font-semibold mb-6 text-white">Trust and support</h4>
          <ul className="space-y-4 text-slate-300 text-sm">
            <li><a href="#faq" className="link-underline hover:text-white transition-all duration-700 ease-fluid">Help Center</a></li>
            <li><a href="#coverage" className="link-underline hover:text-white transition-all duration-700 ease-fluid">Service coverage</a></li>
            <li><a href="#faq" className="link-underline hover:text-white transition-all duration-700 ease-fluid">Privacy and terms</a></li>
          </ul>
        </div>
      </div>
      <hr className="border-white/10 mb-10" />
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
        <p>© 2026 MuntiCares Muntinlupa. All rights reserved.</p>
        <div className="flex gap-6">
          <span>Made with care for Muntinlupa</span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
