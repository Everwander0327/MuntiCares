import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { CheckCircle } from '@phosphor-icons/react';

const FLUID = [0.32, 0.72, 0, 1];

const steps = [
  {
    number: '01',
    tag: '2-min setup',
    title: 'Create your profile',
    description: 'Sign up and tell us about your care needs or professional skills. Your data stays strictly protected under the DPA 2012.',
    span: 'md:col-span-4',
    offset: '',
    detail: 'No upfront fees required',
  },
  {
    number: '02',
    tag: '100% verified',
    title: 'Find and request',
    description: 'Browse verified profiles, view real background-checked credentials, and send a booking request to your preferred provider.',
    span: 'md:col-span-4',
    offset: 'md:translate-y-3',
    detail: 'Transparent pricing upfront',
  },
  {
    number: '03',
    tag: 'Peace of mind',
    title: 'Manage your care',
    description: 'Confirm appointment times, receive in-home care or updates, and manage your health records in one seamless portal.',
    span: 'md:col-span-4',
    offset: 'md:translate-y-6',
    detail: 'Real-time visit coordination',
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="py-20 md:py-32 bg-white dark:bg-slate-900 overflow-hidden relative border-t border-black/5 dark:border-white/5" aria-labelledby="howitworks-heading">
    <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
    <div className="container mx-auto px-4 md:px-6">
      <motion.div
        className="text-center space-y-4 mb-14 md:mb-20"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <span className="eyebrow">Simple by design</span>
        <h2 id="howitworks-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">How it works</h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">Getting the care you need is straightforward and secure from day one.</p>
      </motion.div>

      {/* Connected step grid with progressive flow */}
      <div className="relative">
        {/* Desktop connection rail */}
        <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-[2px] bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30 -z-0" />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
        >
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              variants={staggerItem}
              whileTap={{ scale: 0.98 }}
              className={`col-span-1 ${step.span} ${step.offset} transition-transform duration-300 hover:-translate-y-1`}
            >
              <div className="neu-flat rounded-2xl md:rounded-[2.25rem] p-6 md:p-8 h-full relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="neu-btn-primary w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-lg shadow-md text-white">
                      {step.number}
                    </div>
                    <span className="neu-flat-sm text-[10px] uppercase font-black tracking-wider px-3 py-1 rounded-full text-link dark:text-primary-300">
                      {step.tag}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{step.title}</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">{step.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-200/50 dark:border-white/5 flex items-center gap-2 text-xs font-semibold text-tertiary dark:text-tertiary">
                  <CheckCircle size={16} weight="fill" className="text-success shrink-0" />
                  <span>{step.detail}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);

export default HowItWorks;
