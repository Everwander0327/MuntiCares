import { CalendarBlank, ShieldCheck, LockKey } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { IMAGES } from '@/lib/images';

const FLUID = [0.32, 0.72, 0, 1];

const features = [
  {
    icon: <CalendarBlank size={22} weight="light" className="text-primary" />,
    title: 'Easy Booking',
    description: 'Book a professional provider in minutes with our streamlined scheduling system.',
    span: 'md:col-span-7',
    image: IMAGES.landing.featureBooking,
  },
  {
    icon: <ShieldCheck size={22} weight="light" className="text-primary" />,
    title: 'Verified Providers',
    description: 'All providers undergo rigorous background checks and credential verification.',
    span: 'md:col-span-5',
    image: IMAGES.landing.featureTrust,
  },
  {
    icon: <LockKey size={22} weight="light" className="text-primary" />,
    title: 'Secure & Compliant',
    description: 'Fully compliant with Republic Act 10173 (Data Privacy Act of 2012) and DOH standards.',
    span: 'md:col-span-12',
    image: IMAGES.landing.featureSecurity,
  },
];

const Features = () => {
  return (
    <section id="features" className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50" aria-label="Key features">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="text-2xs uppercase tracking-widest font-bold text-primary">Why MuntiCares</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            Designed for Trust and Convenience
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base md:text-lg">
            Experience reliable healthcare right in the safety and comfort of your home.
          </p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              transition={{ ease: FLUID }}
              className={`${feature.span} group relative overflow-hidden rounded-2xl md:rounded-3xl bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 p-6 md:p-8 shadow-sm hover:shadow-md transition-all duration-300`}
            >
              <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="font-display text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
