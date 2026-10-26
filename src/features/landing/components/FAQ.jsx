import { useState } from 'react';
import { CaretDown, Question } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

const FLUID = [0.32, 0.72, 0, 1];

const faqs = [
  {
    q: 'How are providers verified?',
    a: 'Every provider on MuntiCares undergoes a rigorous background check, credential verification, and in-person interview before being approved. We also review licenses, certifications, and conduct regular reference checks to ensure the highest standards of care.',
  },
  {
    q: 'What areas of Muntinlupa do you serve?',
    a: 'We currently serve all 9 barangays of Muntinlupa City: Alabang, Ayala Alabang, Bayanan, Buli, Cupang, Poblacion, Putatan, Sucat, and Tunasan. We are actively expanding to nearby cities.',
  },
  {
    q: "Can I switch providers if I'm not satisfied?",
    a: 'Absolutely. You can request a different provider at any time. We encourage you to find the right match for your needs, and our support team is happy to help facilitate a smooth transition.',
  },
  {
    q: 'Is my health data private?',
    a: 'Yes. We take data privacy seriously. MuntiCares is fully compliant with the Data Privacy Act of 2012. You have full control over who can access your health records, and all data is encrypted end-to-end.',
  },
  {
    q: 'What if I need urgent care?',
    a: 'For life-threatening emergencies, please call 911 or your local emergency hotline immediately. For urgent but non-emergency care needs, you can book a provider on our platform with same-day availability in many cases.',
  },
];

const FAQItem = ({ faq, isOpen, onClick }) => (
  <div className={`rounded-[2rem] overflow-hidden transition-all duration-700 ease-fluid ring-1 ${isOpen ? 'ring-primary/30 shadow-card bg-white dark:bg-slate-800' : 'ring-black/5 dark:ring-white/10 bg-white/60 dark:bg-slate-800/60'}`}>
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-all duration-700 ease-fluid hover:bg-primary/5 min-h-[68px]"
      aria-expanded={isOpen}
    >
      <span className="font-semibold text-slate-900 dark:text-slate-100 text-base md:text-lg">{faq.q}</span>
      <span className={`w-11 h-11 rounded-full bg-black/[0.04] dark:bg-white/[0.06] ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center shrink-0 transition-transform duration-700 ease-fluid ${isOpen ? 'rotate-180 bg-primary text-white' : 'text-link'}`}>
        <CaretDown size={16} weight="light" />
      </span>
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: FLUID }}
          className="overflow-hidden"
        >
          <div className="px-6 pb-6 text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
            {faq.a}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-32 bg-secondary/50 dark:bg-slate-900/50 relative overflow-hidden border-t border-black/5 dark:border-white/5" aria-labelledby="faq-heading">
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">
        <motion.div
          className="text-center space-y-4 mb-12"
          initial={{ opacity: 0, y: 64 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: FLUID }}
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-link ring-1 ring-primary/20 mb-2">
            <Question size={22} weight="light" />
          </div>
          <h2 id="faq-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Frequently asked questions</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
            Everything you need to know about MuntiCares and how we help you get the care you deserve.
          </p>
        </motion.div>
        <motion.div
          className="space-y-4"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.1 }}
          variants={{
            initial: {},
            animate: {
              transition: {
                staggerChildren: 0.08,
              },
            },
          }}
        >
          {faqs.map((faq, idx) => (
            <motion.div
              key={idx}
              variants={{
                initial: { opacity: 0, y: 64 },
                animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: FLUID } },
              }}
            >
              <FAQItem
                faq={faq}
                isOpen={openIndex === idx}
                onClick={() => toggle(idx)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
