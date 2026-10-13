import { MapPin, ShieldCheck, Heart, House } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { MUNTINLUPA_BARANGAYS } from '@/config/constants';

const FLUID = [0.32, 0.72, 0, 1];

const partners = [
  { icon: <ShieldCheck size={20} weight="light" />, label: 'Verified Providers' },
  { icon: <Heart size={20} weight="light" />, label: 'Compassionate Care' },
  { icon: <House size={20} weight="light" />, label: 'Home-First Approach' },
  { icon: <MapPin size={20} weight="light" />, label: 'Muntinlupa Wide' },
];

const MarqueeRow = ({ items, reverse = false, label }) => (
  <div className="relative overflow-hidden" aria-label={label}>
    <motion.div
      className="flex gap-3 whitespace-nowrap will-change-transform"
      animate={{ x: reverse ? ['0%', '-50%'] : ['-50%', '0%'] }}
      transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
    >
      {[...items, ...items, ...items, ...items].map((item, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {item}
        </span>
      ))}
    </motion.div>
  </div>
);

const Coverage = () => {
  return (
    <section id="coverage" className="py-20 md:py-32 bg-white dark:bg-slate-900 overflow-hidden" aria-label="City coverage">
      <div className="container mx-auto px-4 md:px-6 mb-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-2xs uppercase tracking-widest font-bold text-primary">City-Wide Coverage</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            Serving All Barangays in Muntinlupa
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base md:text-lg">
            Wherever you are in the city, our network of accredited home care professionals is ready to serve you.
          </p>
        </div>
      </div>

      <div className="space-y-4 max-w-6xl mx-auto px-4">
        <MarqueeRow items={MUNTINLUPA_BARANGAYS} label="Barangays in Muntinlupa" />
      </div>

      <div className="container mx-auto px-4 md:px-6 mt-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {partners.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-black/5 dark:border-white/10"
            >
              <div className="text-primary">{p.icon}</div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Coverage;
