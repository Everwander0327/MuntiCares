import { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

const FLUID = [0.32, 0.72, 0, 1];

const faqs = [
  {
    q: 'How are providers verified?',
    a: 'Every provider on MuntiCares undergoes a rigorous background check, credential verification, and license validation before being approved. We verify PRC licenses, certifications, and conduct reference checks.',
  },
  {
    q: 'What areas of Muntinlupa do you serve?',
    a: 'We currently serve all barangays of Muntinlupa City: Alabang, Ayala Alabang, Bayanan, Buli, Cupang, Poblacion, Putatan, Sucat, and Tunasan.',
  },
  {
    q: 'How are service fees handled?',
    a: 'Service fees are clearly listed on each provider profile before you book. MuntiCares ensures total price transparency with zero hidden booking charges.',
  },
  {
    q: 'Is my health information secure?',
    a: 'Yes. MuntiCares strictly adheres to the Data Privacy Act of 2012 (RA 10173). All clinical notes, patient records, and consent documentation are encrypted and only accessible to authorized care parties.',
  },
];

const FAQ = () => {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50" aria-label="Frequently asked questions">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="text-2xs uppercase tracking-widest font-bold text-primary">Got Questions?</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base md:text-lg">
            Everything you need to know about booking and receiving home care through MuntiCares.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base md:text-lg font-bold text-slate-900 dark:text-white pr-4">
                    {faq.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: FLUID }}
                    className="text-slate-400 shrink-0"
                  >
                    <CaretDown size={18} weight="bold" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: FLUID }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed border-t border-black/5 dark:border-white/5 pt-4">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
