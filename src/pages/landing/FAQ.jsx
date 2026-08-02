 
import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    q: 'How are providers verified?',
    a: 'Every provider on MuntiCares undergoes a rigorous background check, credential verification, and in-person interview before being approved. We also review licenses, certifications, and conduct定期 reference checks to ensure the highest standards of care.',
  },
  {
    q: 'What areas of Muntinlupa do you serve?',
    a: 'We currently serve all 10 barangays of Muntinlupa City: Alabang, Ayala Alabang, Bayanan, Buli, Cupang, Poblacion, Putatan, Sto. Niño, Sucat, and Tunasan. We are actively expanding to nearby cities.',
  },
  {
    q: 'How are service fees handled?',
    a: 'Service fees are agreed upon between you and your provider before the visit begins. MuntiCares keeps the process transparent, so you always know the cost of your care upfront.',
  },
  {
    q: 'Can I switch providers if I\'m not satisfied?',
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

const FAQItem = ({ faq, isOpen, onClick }) => {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden transition-all duration-300">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-slate-900 dark:text-slate-100">{faq.q}</span>
        <ChevronDown
          className={`w-5 h-5 text-primary shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800">
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-14 bg-secondary/50 dark:bg-slate-800/50" aria-labelledby="faq-heading">
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div
          className="text-center space-y-3 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-3">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Frequently Asked Questions</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm">
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
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
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
