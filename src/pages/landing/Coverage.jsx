import { MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';

const barangays = [
  'Alabang', 'Ayala Alabang', 'Bayanan', 'Buli', 'Cupang',
  'Poblacion', 'Putatan', 'Sto. Niño', 'Sucat', 'Tunasan',
];

const Coverage = () => {
  return (
    <section id="coverage" className="py-14 bg-white dark:bg-slate-800" aria-labelledby="coverage-heading">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center space-y-3 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 id="coverage-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Serving All of Muntinlupa</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm">
            We cover all barangays across Muntinlupa City &mdash; bringing quality home care to every neighborhood.
          </p>
        </motion.div>
        <motion.div
          className="text-center space-y-6"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {barangays.map((barangay, idx) => (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-primary px-5 py-3 rounded-full border border-blue-100 dark:border-blue-900/40 font-medium text-sm hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 cursor-default"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <MapPin className="w-4 h-4" />
                {barangay}
              </motion.div>
            ))}
          </div>
          <motion.p
            className="text-slate-500 dark:text-slate-400 text-base"
            variants={staggerItem}
          >
            <span className="font-bold text-primary text-xl">10</span> barangays covered and expanding
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default Coverage;
