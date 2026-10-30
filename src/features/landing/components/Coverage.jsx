import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';

const FLUID = [0.32, 0.72, 0, 1];

const barangays = [
  'Alabang', 'Ayala Alabang', 'Bayanan', 'Buli', 'Cupang',
  'Poblacion', 'Putatan', 'Sucat', 'Tunasan',
];

const TypographicTicker = ({ items, reverse = false, label }) => (
  <div className="relative overflow-hidden py-5 border-y border-black/10 dark:border-white/10" aria-label={label}>
    <div
      className="marquee-track items-center"
      style={reverse ? { animationDirection: 'reverse', animationDuration: '40s' } : { animationDuration: '36s' }}
    >
      {[0, 1].map((copy) => (
        <div key={copy} className="flex items-center shrink-0" aria-hidden={copy === 1}>
          {items.map((item, idx) => (
            <div key={`${copy}-${idx}`} className="flex items-center shrink-0">
              <span className="font-display text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 px-6 sm:px-8 whitespace-nowrap">
                {item}
              </span>
              <span className="text-primary dark:text-primary-400 text-xl sm:text-2xl select-none" aria-hidden="true">
                &bull;
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-transparent dark:from-slate-900" />
    <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent dark:from-slate-900" />
  </div>
);

const Coverage = () => (
  <section id="coverage" className="py-16 md:py-24 bg-white dark:bg-slate-900 relative overflow-hidden border-t border-black/5 dark:border-white/5" aria-labelledby="coverage-heading">
    <div className="container mx-auto px-4 md:px-6 max-w-6xl">
      <motion.div
        className="text-center space-y-4 mb-10 md:mb-14"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <h2 id="coverage-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Serving all of Muntinlupa
        </h2>
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
          <TypographicTicker items={barangays} label="Covered barangays" />
        </motion.div>
        <motion.p
          className="text-center text-tertiary dark:text-tertiary text-base pt-4"
          variants={staggerItem}
        >
          <span className="font-display font-semibold text-link text-2xl">{barangays.length}</span> barangays covered and expanding
        </motion.p>
      </motion.div>
    </div>
  </section>
);

export default Coverage;
