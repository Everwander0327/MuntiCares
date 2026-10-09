import { useRef } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { heroStagger, heroItem } from './animations';
import { IMAGES } from '../../lib/images';

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
          loading="eager"
          className="h-full w-full object-cover opacity-65 contrast-105 saturate-110 dark:grayscale dark:mix-blend-luminosity dark:opacity-90 dark:contrast-125"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/60 via-white/55 to-white/80 dark:from-slate-950/80 dark:via-slate-950/70 dark:to-slate-900" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.08)_75%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.55)_75%)]" />

      <div className="container mx-auto px-4 md:px-6">
        {/* Cinematic Center: massive centered type, ultra-wide container */}
        <motion.div
          className="mx-auto w-full max-w-6xl text-center"
          variants={heroStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-100px' }}
        >
          <motion.div variants={heroItem} className="space-y-8">
            <h1 id="hero-heading" className="hero-title font-display font-semibold text-slate-900 dark:text-white w-full">
              Quality home care{' '}
              <br className="hidden sm:block" />
              right at your{' '}
              <span className="text-transparent bg-gradient-to-r from-primary-600 via-blue-500 to-primary-600 dark:from-blue-200 dark:via-white dark:to-blue-200 bg-clip-text">
                doorstep
              </span>
            </h1>

            <p
              className="text-lg md:text-xl font-medium text-slate-700 dark:text-slate-100 leading-relaxed max-w-2xl mx-auto dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
            >
              {subcopy}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center pt-2">
              <Link to="/patient/providers" className="btn-primary group w-full sm:w-auto justify-center">
                Find a Provider
                <span className="btn-island-icon !bg-white/20">
                  <ArrowUpRight size={16} weight="light" className="text-white" />
                </span>
              </Link>
              <Link to="/register" className="btn-secondary group w-full sm:w-auto justify-center">
                Register as Provider
                <span className="btn-island-icon !bg-white/10 dark:!bg-black/10">
                  <ArrowUpRight size={16} weight="light" className="text-white dark:text-slate-900" />
                </span>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
