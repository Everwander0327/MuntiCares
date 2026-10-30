import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { IMAGES } from '@/lib/images';

const FLUID = [0.32, 0.72, 0, 1];

const services = [
  {
    title: 'Elderly Care',
    description: 'Compassionate, professional care for senior family members in the comfort of their homes.',
    image: IMAGES.landing.serviceElderly,
    span: 'md:col-span-6',
  },
  {
    title: 'Post-Surgery Care',
    description: 'Recovery assistance after medical procedures, including wound care and mobility support.',
    image: IMAGES.landing.serviceRecovery,
    span: 'md:col-span-6',
  },
  {
    title: 'Physical Therapy',
    description: 'In-home rehabilitation sessions tailored to your recovery goals and schedule.',
    image: IMAGES.landing.serviceTherapy,
    span: 'md:col-span-4',
  },
  {
    title: 'Companion Care',
    description: 'Social support and daily companionship to improve quality of life and mental well-being.',
    image: IMAGES.landing.serviceCompanion,
    span: 'md:col-span-4',
  },
  {
    title: 'Medication Management',
    description: 'Organized medication scheduling, reminders, and monitoring for peace of mind.',
    image: IMAGES.landing.serviceMedication,
    span: 'md:col-span-4',
  },
];

const Services = () => (
  <section
    id="services"
    className="py-16 md:py-24 bg-secondary/50 dark:bg-slate-900/50 relative overflow-hidden border-t border-black/5 dark:border-white/5"
    aria-labelledby="services-heading"
  >
    <div className="pointer-events-none absolute top-0 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
    <div className="container mx-auto px-4 md:px-6 max-w-6xl">
      <motion.div
        className="text-center space-y-4 mb-10 md:mb-14"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <h2 id="services-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Services we offer
        </h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
          From daily companionship to specialized medical care, find the right support for your needs.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.2 }}
      >
        {services.map((service) => (
          <motion.div
            key={service.title}
            variants={staggerItem}
            whileTap={{ scale: 0.98 }}
            className={`col-span-1 ${service.span}`}
          >
            <Link
              to={`/patient/providers?service=${encodeURIComponent(service.title)}`}
              className="group block h-full text-left transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl md:rounded-3xl"
              aria-label={`View providers offering ${service.title}`}
            >
              <div className="neu-flat rounded-2xl md:rounded-3xl p-3.5 h-full flex flex-col justify-between">
                <div>
                  {/* Inset Framed Photo with Subtle Dark Matte Filter */}
                  <div className="relative h-44 sm:h-48 w-full rounded-xl md:rounded-2xl overflow-hidden bg-slate-950 shrink-0">
                    <img
                      src={service.image}
                      alt={service.title}
                      loading="lazy"
                      decoding="async"
                      width="800"
                      height="500"
                      className="h-full w-full object-cover object-center brightness-[0.78] contrast-105 saturate-95 transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-90"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/25 to-black/15 transition-opacity duration-500 group-hover:opacity-75" />
                  </div>

                  {/* Clean Neumorphic Text Body */}
                  <div className="px-3 pt-5 pb-2">
                    <div className="h-1 w-10 group-hover:w-20 transition-all duration-300 rounded-full bg-primary dark:bg-primary-400 mb-4" />
                    <h3 className="font-display text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                      {service.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>

                <div className="px-3 pb-3 pt-3">
                  <span className="text-xs font-bold text-link group-hover:underline inline-flex items-center gap-1">
                    Find specialists &rarr;
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default Services;
