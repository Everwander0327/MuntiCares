import { Shield, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';

const badges = [
  { icon: <Shield className="w-5 h-5" />, label: 'Data Privacy Compliant' },
  { icon: <Lock className="w-5 h-5" />, label: 'Verified Providers' },
];

const TrustBadges = () => {
  return (
    <section id="trust" className="py-6 bg-blue-50/50 dark:bg-slate-800/50" aria-label="Trust badges">
      <div className="container mx-auto px-6">
        <motion.div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
        >
          {badges.map((badge, idx) => (
            <motion.div
              key={idx}
              variants={staggerItem}
              className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300"
            >
              <span className="text-primary">{badge.icon}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{badge.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TrustBadges;
