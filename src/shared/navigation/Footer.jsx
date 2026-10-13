import { Heart, Envelope, MapPin, Phone } from '@phosphor-icons/react';

const Footer = () => (
  <footer id="footer" className="bg-slate-900 dark:bg-ink text-white pt-20 md:pt-28 pb-10">
    <div className="container mx-auto px-4 md:px-6">
      <div className="mb-16">
        <div className="max-w-xl space-y-6">
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
      </div>
      <div className="pt-8 border-t border-slate-800 text-xs text-slate-300 flex flex-col md:flex-row justify-between items-center gap-4">
        <p>&copy; {new Date().getFullYear()} MuntiCares. All rights reserved.</p>
        <p>Built for the people of Muntinlupa City.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
