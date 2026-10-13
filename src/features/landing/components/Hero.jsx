import { useRef } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { heroStagger, heroItem } from './animations';
import { IMAGES } from '@/lib/images';

const Hero = () => {
  const sectionRef = useRef(null);

  const subcopy = 'Connecting Muntinlupa City residents with trusted, verified home care providers — fast, secure, and patient-first.';

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative overflow-hidden min-h-[100dvh] flex items-center pt-20 pb-20 md:pb-32"
      aria-label="Hero banner"
    >
      {/* Cinematic full-bleed backdrop with theme-aware wash */}
      <div className="absolute inset-0 -z-20">
        <img
          src={IMAGES.landing.heroWash}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-top opacity-35 dark:opacity-20 pointer-events-none"
        />
      </div>

      {/* Subtle organic gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-100/50 dark:bg-primary-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-20 w-80 h-80 bg-blue-100/40 dark:bg-slate-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 relative z-10 w-full">
        <motion.div
          variants={heroStagger}
          initial="initial"
          animate="animate"
          className="max-w-4xl mx-auto text-center space-y-8"
        >
          {/* Eyebrow badge */}
          <motion.div variants={heroItem} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-2xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-300">
              Trusted Healthcare in Muntinlupa
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={heroItem}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.08] text-balance"
          >
            Professional Home Care, Delivered to Your Doorstep.
          </motion.h1>

          {/* Subcopy */}
          <motion.p
            variants={heroItem}
            className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed"
          >
            {subcopy}
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={heroItem}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            <Link
              to="/patient/providers"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-primary text-white font-semibold text-sm shadow-md hover:bg-primary-700 active:scale-[0.98] transition-all"
            >
              Find a Provider
              <ArrowUpRight size={16} weight="bold" />
            </Link>
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-black/10 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-[0.98] transition-all"
            >
              Join as Provider
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
