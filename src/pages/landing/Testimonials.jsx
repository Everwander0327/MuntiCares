 
import { useState, useEffect, useCallback, useRef } from 'react';
import { Quote, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useTilt from '../../hooks/useTilt';

const testimonials = [
  {
    quote: "MuntiCares helped me find a reliable caregiver for my mother in just one day!",
    name: "Maria L.",
    location: "Muntinlupa",
    rating: 5,
    initials: "ML",
  },
  {
    quote: "As a provider, the platform made it so easy to manage my patients.",
    name: "Jose R.",
    location: "Alabang",
    rating: 5,
    initials: "JR",
  },
  {
    quote: "I love how I can control who sees my health data. Very secure!",
    name: "Ana C.",
    location: "Tunasan",
    rating: 5,
    initials: "AC",
  },
];

const TestimonialCard = ({ t }) => {
  const { ref, style, handleMouseMove, handleMouseLeave } = useTilt(5);

  return (
    <motion.div
      key={t.initials}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        ref={ref}
        style={style}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="bg-white/70 dark:bg-slate-800/70 p-6 md:p-8 rounded-xl border border-white/20 dark:border-slate-700/50 shadow-sm md:backdrop-blur-xl"
      >
        <Quote className="w-6 h-6 text-primary/20 mb-3" />
        <p className="text-slate-700 dark:text-slate-200 leading-relaxed mb-4 text-base italic">
          &quot;{t.quote}&quot;
        </p>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {t.initials}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{t.name}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t.location}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {[...Array(t.rating)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 text-yellow-500 fill-current" />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const Testimonials = () => {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);
  const sectionRef = useRef(null);
  const isVisibleRef = useRef(false);

  const paginate = useCallback((newDirection) => {
    setIndex((prev) => (prev + newDirection + testimonials.length) % testimonials.length);
  }, []);

  const goTo = useCallback((idx) => {
    setIndex(idx);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) paginate(1);
    }, 5000);

    return () => clearInterval(intervalRef.current);
  }, [paginate]);

  const pause = () => clearInterval(intervalRef.current);
  const resume = useCallback(() => {
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) paginate(1);
    }, 5000);
  }, [paginate]);

  const t = testimonials[index];

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    sectionRef.current.dataset.touchStart = touch.clientX;
  };

  const handleTouchEnd = (e) => {
    const touchEnd = e.changedTouches[0];
    const touchStart = parseFloat(sectionRef.current.dataset.touchStart || 0);
    const diff = touchStart - touchEnd.clientX;
    if (Math.abs(diff) > 50) {
      paginate(diff > 0 ? 1 : -1);
    }
  };

  return (
    <section id="testimonials" className="py-14 bg-white dark:bg-slate-800" aria-labelledby="testimonials-heading">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center space-y-3 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 id="testimonials-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">What Our Users Say</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm">Real experiences from families and providers across Muntinlupa.</p>
        </motion.div>

        <div
          ref={sectionRef}
          className="relative max-w-lg mx-auto"
          role="group"
          aria-roledescription="carousel"
          aria-label="Testimonial carousel"
          tabIndex={0}
          onMouseEnter={pause}
          onMouseLeave={resume}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') paginate(-1);
            if (e.key === 'ArrowRight') paginate(1);
          }}
        >
          <div className="relative min-h-[280px]">
            <AnimatePresence mode="wait">
              <TestimonialCard key={index} t={t} />
            </AnimatePresence>
          </div>

          <button
            onClick={() => paginate(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 md:-translate-x-12 w-9 h-9 rounded-full bg-white dark:bg-slate-700 shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary transition-all"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 md:translate-x-12 w-9 h-9 rounded-full bg-white dark:bg-slate-700 shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary transition-all"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  idx === index
                    ? 'bg-primary w-8'
                    : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                }`}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
