import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from '@phosphor-icons/react';

const FLUID = [0.32, 0.72, 0, 1];

const CTASection = () => (
  <section id="cta" className="py-20 md:py-32 bg-white dark:bg-slate-900 relative overflow-hidden border-t border-black/5 dark:border-white/5" aria-labelledby="cta-heading">
    <div className="container mx-auto px-4 md:px-6">
      <motion.div
        className="neu-flat rounded-2xl md:rounded-[2.5rem] p-2 md:p-3"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: FLUID }}
      >
        <div className="relative overflow-hidden rounded-xl md:rounded-[2rem] bg-gradient-to-br from-primary via-primary-700 to-primary-800 p-8 md:p-14 text-center text-white shadow-lg">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 space-y-6">
            <span className="inline-flex items-center rounded-full px-3.5 py-1 text-[10px] uppercase tracking-[0.2em] font-black bg-white/20 text-white backdrop-blur-md shadow-sm">Get started today</span>
            <h2 id="cta-heading" className="font-display text-3xl md:text-5xl font-black tracking-tight">Ready to experience better care?</h2>
            <p className="text-blue-100 text-base max-w-2xl mx-auto font-medium">
              Join hundreds of families in Muntinlupa City who trust MuntiCares for their home healthcare needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="group inline-flex items-center justify-center gap-2 bg-white text-link pl-6 pr-2 py-2.5 rounded-full font-bold text-base transition-all duration-300 hover:bg-blue-50 active:scale-[0.98] shadow-md">
                Get Started Now
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105">
                  <ArrowUpRight size={16} weight="bold" />
                </span>
              </Link>
              <a href="#features" className="inline-flex items-center justify-center text-white px-6 py-3 rounded-full font-bold text-base transition-all duration-300 ring-1 ring-white/30 hover:ring-white hover:bg-white/10 active:scale-[0.98]">
                Learn More
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

export default CTASection;
