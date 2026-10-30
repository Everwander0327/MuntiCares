import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';

const FLUID = [0.32, 0.72, 0, 1];

const steps = [
  {
    title: 'Create your profile',
    description: 'Sign up and tell us about your care needs or professional skills. Your data stays strictly protected under the DPA 2012.',
  },
  {
    title: 'Find and request',
    description: 'Browse verified profiles, view real background-checked credentials, and send a booking request to your preferred provider.',
  },
  {
    title: 'Manage your care',
    description: 'Confirm appointment times, receive in-home care or updates, and manage your health records in one seamless portal.',
  },
];

const HowItWorks = () => (
  <section
    id="how-it-works"
    className="py-16 md:py-24 bg-white dark:bg-slate-900 overflow-hidden relative border-t border-black/5 dark:border-white/5"
    aria-labelledby="howitworks-heading"
  >
    <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
    <div className="container mx-auto px-4 md:px-6 max-w-6xl">
      <motion.div
        className="text-center space-y-4 mb-10 md:mb-14"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <h2 id="howitworks-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          How it works
        </h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
          Getting the care you need is straightforward and secure from day one.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.2 }}
      >
        {steps.map((step) => (
          <motion.div
            key={step.title}
            variants={staggerItem}
            whileTap={{ scale: 0.98 }}
            className="group transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="neu-flat rounded-2xl md:rounded-3xl p-6 md:p-8 h-full flex flex-col justify-start">
              <div className="h-1 w-10 group-hover:w-20 transition-all duration-300 rounded-full bg-primary dark:bg-primary-400 mb-5" />
              <h3 className="font-display text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 mb-2.5">
                {step.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default HowItWorks;
