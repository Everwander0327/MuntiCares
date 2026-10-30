import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const FLUID = [0.32, 0.72, 0, 1];

const CTASection = () => (
  <section
    id="cta"
    className="py-16 md:py-24 bg-white dark:bg-slate-900 relative overflow-hidden border-t border-black/5 dark:border-white/5"
    aria-labelledby="cta-heading"
  >
    <div className="container mx-auto px-4 md:px-6 max-w-6xl">
      <motion.div
        className="group neu-flat rounded-2xl md:rounded-3xl p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: FLUID }}
      >
        <div className="space-y-2.5 max-w-xl">
          <div className="h-1 w-10 group-hover:w-20 transition-all duration-300 rounded-full bg-primary dark:bg-primary-400 mb-3" />
          <h2 id="cta-heading" className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Ready to experience better care?
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
            Join hundreds of families in Muntinlupa City who trust MuntiCares for their home healthcare needs.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
          <Link
            to="/register"
            className="neu-btn-primary px-6 py-3.5 rounded-2xl font-bold text-sm text-center inline-flex items-center justify-center active:scale-[0.98] transition-all shadow-md"
          >
            Get Started Now
          </Link>
          <a
            href="#features"
            className="neu-btn px-6 py-3.5 rounded-2xl font-bold text-sm text-slate-800 dark:text-slate-100 text-center inline-flex items-center justify-center active:scale-[0.98] transition-all"
          >
            Learn More
          </a>
        </div>
      </motion.div>
    </div>
  </section>
);

export default CTASection;
