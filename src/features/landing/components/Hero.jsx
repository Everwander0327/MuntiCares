import { useRef } from 'react';
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
      className="relative overflow-hidden min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-4.5rem)] flex items-center justify-center pt-8 sm:pt-12 pb-16 md:pb-24 text-center"
      aria-label="Hero banner"
    >
      {/* Cinematic full-bleed backdrop with theme-aware wash */}
      <div className="absolute inset-0 -z-20">
        <img
          src={IMAGES.landing.heroWash}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          width="1600"
          height="1000"
          className="h-full w-full object-cover opacity-60 contrast-105 saturate-110 dark:grayscale dark:mix-blend-luminosity dark:opacity-90 dark:contrast-125"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/70 via-white/60 to-white/85 dark:from-slate-950/85 dark:via-slate-950/75 dark:to-slate-900" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.06)_75%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.55)_75%)]" />

      <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-5xl">
        <motion.div
          className="mx-auto w-full text-center space-y-6 sm:space-y-8"
          variants={heroStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-100px' }}
        >
          <motion.div variants={heroItem} className="space-y-4">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-primary dark:text-[#8CBDF0]">
              MuntiCares
            </span>
            <h1 id="hero-heading" className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-slate-900 dark:text-white tracking-tight leading-[1.12] max-w-4xl mx-auto">
              Quality home care <br className="hidden sm:inline" />right at your{' '}
              <span className="text-primary dark:text-[#8CBDF0]">
                doorstep
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto">
              {subcopy}
            </p>
          </motion.div>

          {/* Current Preferred Button Design (Centered, Icon-Free, Clean Rounded-xl) */}
          <motion.div variants={heroItem} className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/patient/providers"
              className="neu-btn-primary w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white text-center shadow-md active:scale-95 transition-all"
            >
              Find a Provider
            </Link>
            <Link
              to="/register?role=provider"
              className="neu-btn w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-slate-800 dark:text-slate-100 text-center active:scale-95 transition-all"
            >
              Register as Provider
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
