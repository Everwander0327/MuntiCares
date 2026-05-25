import { motion } from 'framer-motion';

const quotes = [
  '"Found the perfect caregiver for my dad in one day!"',
  '"The verification process gave us peace of mind."',
  '"Easy booking and great support team."',
  '"My mom loves her companion care provider."',
  '"Secure, fast, and professional service."',
];

const TestimonialTicker = () => {
  return (
    <section id="ticker" className="py-4 bg-primary/5 dark:bg-primary/10 border-y border-primary/10 dark:border-primary/20 overflow-hidden">
      <div className="flex whitespace-nowrap">
        <motion.div
          className="flex gap-16 items-center"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          {[...quotes, ...quotes].map((q, i) => (
            <span
              key={i}
              className="text-sm text-slate-600 dark:text-slate-300 font-medium italic"
            >
              {q}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialTicker;
