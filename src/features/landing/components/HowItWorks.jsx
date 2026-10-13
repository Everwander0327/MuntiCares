import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';

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
    description: 'Browse licensed nurses, physical therapists, and caregivers in Muntinlupa. Choose dates and review credentials upfront.',
    span: 'md:col-span-4',
    offset: 'md:translate-y-4',
    detail: 'Direct in-app communication',
  },
  {
    number: '03',
    tag: 'Certified visit',
    title: 'Receive certified care',
    description: 'Your provider arrives on schedule with verified credentials. Track clinical sessions and rate your experience seamlessly.',
    span: 'md:col-span-4',
    offset: 'md:translate-y-8',
    detail: 'Complete visit documentation',
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50" aria-label="How it works">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
          <span className="text-2xs uppercase tracking-widest font-bold text-primary">Simple & Seamless</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            How MuntiCares Works
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base md:text-lg">
            Three simple steps to connecting with licensed healthcare practitioners in your neighborhood.
          </p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
        >
          {steps.map((step, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              transition={{ ease: FLUID }}
              className={`${step.span} ${step.offset} rounded-2xl md:rounded-3xl bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 p-6 md:p-8 shadow-sm`}
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-display text-3xl font-bold text-primary/30">{step.number}</span>
                <span className="text-2xs uppercase tracking-widest font-bold px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary">
                  {step.tag}
                </span>
              </div>
              <h3 className="font-display text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-3">
                {step.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed mb-6">
                {step.description}
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-4 border-t border-black/5 dark:border-white/10">
                <CheckCircle size={16} weight="fill" className="text-emerald-500" />
                {step.detail}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
