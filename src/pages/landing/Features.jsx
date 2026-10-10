import { CalendarBlank, ShieldCheck, LockKey } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { IMAGES } from '../../lib/images';

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
    image: IMAGES.landing.featureVerified,
  },
  {
    icon: <LockKey size={22} weight="light" className="text-primary" />,
    title: 'Secure Health Data',
    description: 'You have full control over your information. We prioritize your privacy and security with granular consent and encrypted records.',
    span: 'md:col-span-12',
    image: IMAGES.landing.featureSecure,
  },
];

const FeatureCard = ({ feature }) => (
  <motion.div
    variants={staggerItem}
    className="group h-full transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]"
    whileTap={{ scale: 0.98 }}
  >
    <div className="neu-flat h-full rounded-2xl md:rounded-[2.25rem] overflow-hidden flex flex-col justify-between">
      {feature.image && (
        <div className="relative h-52 md:h-60 overflow-hidden">
          <img
            src={feature.image}
            alt={feature.title}
            loading="lazy"
            className="h-full w-full object-cover object-center opacity-100 contrast-105 saturate-110 transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#ebf1f8] via-[#ebf1f8]/30 to-transparent dark:from-[#172236] dark:via-[#172236]/30 dark:to-transparent" />
        </div>
      )}
      <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
        <div>
          <div className="neu-flat-sm w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-primary group-hover:scale-105 transition-transform duration-300">
            <div className="card-icon-animate">
              {feature.icon}
            </div>
          </div>
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{feature.title}</h3>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">{feature.description}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

const Features = () => (
  <section id="features" className="py-20 md:py-32 bg-white dark:bg-slate-900 relative overflow-hidden" aria-labelledby="features-heading">
    <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
    <div className="container mx-auto px-4 md:px-6">
      <motion.div
        className="text-center space-y-4 mb-12 md:mb-16"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <span className="eyebrow">Why MuntiCares</span>
        <h2 id="features-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight max-w-4xl mx-auto">Care you can trust</h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">We&apos;re committed to providing the safest and most efficient home care connection in the city.</p>
      </motion.div>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-12 grid-flow-dense gap-6"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.2 }}
      >
        {features.map((feature, idx) => (
          <div key={idx} className={`col-span-1 ${feature.span}`}>
            <FeatureCard feature={feature} />
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default Features;
