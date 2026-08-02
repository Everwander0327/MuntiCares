import { useState, useCallback, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import heroImage from '../../assets/hero.png';
import { heroStagger, heroItem } from './animations';
import useTypewriter from '../../hooks/useTypewriter';

const typewriterPhrases = [
  'Trusted by 500+ Families',
  'Elderly Care Specialists',
  'Post-Surgery Recovery',
  '24/7 Compassionate Care',
];

const Hero = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef(null);
  const typewriterRef = useTypewriter(typewriterPhrases);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const particles = useRef(
    Array.from({ length: isMobile ? 4 : 12 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 12}s`,
      duration: `${12 + Math.random() * 8}s`,
      size: `${3 + Math.random() * 4}px`,
    }))
  ).current;

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
    setMousePos({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos({ x: 0, y: 0 });
  }, []);

  return (
    <section
      id="hero"
      className="pt-24 pb-16 md:pt-36 md:pb-24 overflow-hidden relative"
      aria-label="Hero banner"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 -z-10 animate-gradient bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950" />

      {/* Floating particles */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              bottom: '-10px',
              width: p.size,
              height: p.size,
              animation: `particle-float ${p.duration} ${p.delay} infinite`,
              background: 'var(--tw-colors-primary, #1E6FBF)',
            }}
          />
        ))}
      </div>

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231E6FBF' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <motion.div
            className="flex-1 text-center md:text-left max-w-2xl"
            variants={heroStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.div variants={heroItem} className="space-y-8">
              {/* Typewriter badge */}
              <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-primary px-4 py-2 rounded-full text-sm font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="relative">
                  <span ref={typewriterRef} />
                  <span className="ml-0.5 inline-block w-[2px] h-4 bg-primary animate-pulse" />
                </span>
              </div>

              <h1 id="hero-heading" className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Quality Home Care, <br className="hidden md:block" />
                <span className="text-transparent bg-gradient-to-r from-primary via-blue-400 to-primary animate-gradient-text bg-clip-text">
                  Right at Your Doorstep
                </span>
              </h1>
              <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto md:mx-0">
                Connecting Muntinlupa City residents with trusted, verified home care providers &mdash; fast, secure, and patient-first.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start pt-4">
                <Link to="/patient/providers" className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center group">
                  Find a Provider <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/register" className="btn-outline w-full sm:w-auto justify-center">
                  Register as Provider
                </Link>
              </div>
            </motion.div>
          </motion.div>
          <motion.div
            className="flex-1 relative w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              className="relative z-10 rounded-2xl overflow-hidden shadow-2xl animate-float border-8 border-white dark:border-slate-800"
              animate={{ x: mousePos.x, y: mousePos.y }}
              transition={{ type: 'spring', stiffness: 80, damping: 15 }}
            >
              <div
                className={`transition-all duration-700 ${imageLoaded ? 'blur-0' : 'blur-xl scale-105'}`}
                style={{ background: '#e2e8f0' }}
              >
                <img
                  ref={imgRef}
                  src={heroImage}
                  alt="Home Care Provider"
                  width="600"
                  height="400"
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                  className={`w-full h-auto object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
            </motion.div>
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-200 rounded-full blur-2xl opacity-30 -z-10 motion-safe:animate-[blob-float-1_6s_ease-in-out_infinite]" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-300 rounded-full blur-2xl opacity-30 -z-10 motion-safe:animate-[blob-float-2_7s_ease-in-out_infinite]" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
