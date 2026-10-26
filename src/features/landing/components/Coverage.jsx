import { MapPin, ShieldCheck, Heart, House } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';

const FLUID = [0.32, 0.72, 0, 1];

const barangays = [
  'Alabang', 'Ayala Alabang', 'Bayanan', 'Buli', 'Cupang',
  'Poblacion', 'Putatan', 'Sucat', 'Tunasan',
];

const partners = [
  { icon: <ShieldCheck size={20} weight="light" />, label: 'Verified Providers' },
  { icon: <Heart size={20} weight="light" />, label: 'Compassionate Care' },
  { icon: <House size={20} weight="light" />, label: 'Home-First Approach' },
  { icon: <MapPin size={20} weight="light" />, label: 'Muntinlupa Wide' },
];

const MarqueeRow = ({ items, reverse = false, label }) => (
  <div className="relative overflow-hidden" aria-label={label}>
    <div
      className="marquee-track gap-3 pr-3"
      style={reverse ? { animationDirection: 'reverse', animationDuration: '40s' } : undefined}
    >
      {[0, 1].map((copy) => (
        <div key={copy} className="flex gap-3 pr-3" aria-hidden={copy === 1}>
          {items.map((item, idx) => (
            <div
              key={`${copy}-${idx}`}
              className="flex shrink-0 items-center gap-2 bg-primary/5 dark:bg-primary/10 text-primary-700 dark:text-primary-200 px-5 py-3 rounded-full ring-1 ring-primary/20 font-medium text-sm whitespace-nowrap"
            >
              {typeof item === 'string' ? (
                <>
                  <MapPin size={16} weight="light" />
                  {item}
                </>
              ) : (
                <>
                  <span className="text-link">{item.icon}</span>
                  {item.label}
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent dark:from-slate-900" />
    <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent dark:from-slate-900" />
  </div>
);

const Coverage = () => (
  <section id="coverage" className="py-20 md:py-32 bg-white dark:bg-slate-900 relative overflow-hidden border-t border-black/5 dark:border-white/5" aria-labelledby="coverage-heading">
    <div className="container mx-auto px-4 md:px-6">
      <motion.div
        className="text-center space-y-4 mb-12 md:mb-16"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <span className="eyebrow">Where we serve</span>
        <h2 id="coverage-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Serving all of Muntinlupa</h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
          We cover all barangays across Muntinlupa City &mdash; bringing quality home care to every neighborhood.
        </p>
      </motion.div>
      <motion.div
        className="space-y-4"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div variants={staggerItem}>
          <MarqueeRow items={barangays} label="Covered barangays" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <MarqueeRow items={partners} reverse label="Care promises" />
        </motion.div>
        <motion.p
          className="text-center text-tertiary dark:text-tertiary text-base pt-6"
          variants={staggerItem}
        >
          <span className="font-display font-semibold text-link text-2xl">{barangays.length}</span> barangays covered and expanding
        </motion.p>
      </motion.div>
    </div>
  </section>
);

export default Coverage;
