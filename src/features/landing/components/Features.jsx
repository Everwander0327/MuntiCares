import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { IMAGES } from '@/lib/images';

const FLUID = [0.32, 0.72, 0, 1];

const features = [
  {
    title: 'Easy Booking',
    description: 'Book a professional provider in minutes with our streamlined scheduling system.',
    image: IMAGES.landing.featureBooking,
  },
  {
    title: 'Verified Providers',
    description: 'All providers undergo rigorous background checks and credential verification.',
    image: IMAGES.landing.featureVerified,
  },
  {
    title: 'Secure Health Data',
    description: 'You have full control over your information. We prioritize your privacy and security with granular consent and encrypted records.',
    image: IMAGES.landing.featureSecure,
  },
];

const Features = () => (
  <section
    id="features"
    className="py-16 md:py-24 bg-white dark:bg-slate-900 relative overflow-hidden"
    aria-labelledby="features-heading"
  >
    <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
    <div className="container mx-auto px-4 md:px-6 max-w-6xl">
      <motion.div
        className="text-center space-y-4 mb-10 md:mb-14"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <h2 id="features-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight max-w-4xl mx-auto">
          Care you can trust
        </h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
          We&apos;re committed to providing the safest and most efficient home care connection in the city.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.2 }}
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            variants={staggerItem}
            whileTap={{ scale: 0.98 }}
            className="group transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="neu-flat rounded-2xl md:rounded-3xl p-3.5 h-full flex flex-col">
              {/* Inset Framed Photo with Subtle Dark Matte Filter */}
              <div className="relative h-44 sm:h-48 w-full rounded-xl md:rounded-2xl overflow-hidden bg-slate-950 shrink-0">
                <img
                  src={feature.image}
                  alt={feature.title}
                  loading="lazy"
                  decoding="async"
                  width="800"
                  height="500"
                  className="h-full w-full object-cover object-center brightness-[0.78] contrast-105 saturate-95 transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-90"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/25 to-black/15 transition-opacity duration-500 group-hover:opacity-75" />
              </div>

              {/* Clean Neumorphic Text Body */}
              <div className="px-3 pt-5 pb-3 flex-1 flex flex-col justify-start">
                <div className="h-1 w-10 group-hover:w-20 transition-all duration-300 rounded-full bg-primary dark:bg-primary-400 mb-4" />
                <h3 className="font-display text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default Features;
