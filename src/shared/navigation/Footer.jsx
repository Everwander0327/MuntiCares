import { Link } from 'react-router-dom';

const Footer = () => (
  <footer id="footer" className="bg-slate-900 dark:bg-ink text-white pt-16 md:pt-20 pb-10 border-t border-white/5">
    <div className="container mx-auto px-4 md:px-6 max-w-6xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12">
        {/* Brand Column */}
        <div className="sm:col-span-2 lg:col-span-5 space-y-4">
          <div className="h-1 w-10 rounded-full bg-primary-400" />
          <Link to="/" className="inline-block font-display text-2xl font-bold tracking-tight text-white">
            MuntiCares
          </Link>
          <p className="text-slate-300 max-w-sm leading-relaxed text-sm">
            Empowering Muntinlupa City residents through safe, reliable, and compassionate home care connections.
          </p>
        </div>

        {/* Explore Column */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
            Explore
          </h3>
          <ul className="space-y-2.5 text-sm text-slate-300">
            <li>
              <a href="#features" className="hover:text-white transition-colors">
                Why MuntiCares
              </a>
            </li>
            <li>
              <a href="#services" className="hover:text-white transition-colors">
                Services
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="hover:text-white transition-colors">
                How It Works
              </a>
            </li>
            <li>
              <a href="#coverage" className="hover:text-white transition-colors">
                Coverage
              </a>
            </li>
          </ul>
        </div>

        {/* Portals Column */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
            Portals
          </h3>
          <ul className="space-y-2.5 text-sm text-slate-300">
            <li>
              <Link to="/patient/providers" className="hover:text-white transition-colors">
                Find a Provider
              </Link>
            </li>
            <li>
              <Link to="/register?role=provider" className="hover:text-white transition-colors">
                Become a Provider
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact Column */}
        <div className="lg:col-span-3 space-y-3">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
            Contact
          </h3>
          <ul className="space-y-2.5 text-sm text-slate-300">
            <li>Muntinlupa City, Metro Manila</li>
            <li>
              <a href="mailto:support@munticares.ph" className="hover:text-white transition-colors">
                support@munticares.ph
              </a>
            </li>
            <li>Mon&ndash;Sat, 8am&ndash;6pm</li>
          </ul>
        </div>
      </div>

      {/* Bottom Legal Bar */}
      <div className="pt-8 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p>&copy; {new Date().getFullYear()} MuntiCares. All rights reserved.</p>
        <p>Built for the people of Muntinlupa City &bull; DPA 2012 Compliant</p>
      </div>
    </div>
  </footer>
);

export default Footer;
