import { Heart, Stethoscope, Heartbeat, UsersThree, Clock, ArrowUpRight } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { IMAGES } from '@/lib/images';

const FLUID = [0.32, 0.72, 0, 1];

const services = [
  {
    icon: <Heart size={22} weight="light" className="text-link" />,
    title: 'Elderly Care',
    description: 'Compassionate, professional care for senior family members in the comfort of their homes.',
    span: 'md:col-span-7',
    image: IMAGES.landing.serviceElderly,
  },
  {
    icon: <Stethoscope size={22} weight="light" className="text-link" />,
    title: 'Post-Surgery Care',
    description: 'Recovery assistance after medical procedures, including wound care and mobility support.',
    span: 'md:col-span-5',
    image: IMAGES.landing.serviceRecovery,
  },
  {
    icon: <Heartbeat size={22} weight="light" className="text-link" />,
    title: 'Physical Therapy',
    description: 'In-home rehabilitation sessions tailored to your recovery goals and schedule.',
    span: 'md:col-span-4',
    image: IMAGES.landing.serviceTherapy,
  },
  {
    icon: <UsersThree size={22} weight="light" className="text-link" />,
    title: 'Companion Care',
    description: 'Social support and daily companionship to improve quality of life and mental well-being.',
    span: 'md:col-span-4',
    image: IMAGES.landing.serviceCompanion,
  },
  {
    icon: <Clock size={22} weight="light" className="text-link" />,
    title: 'Medication Management',
    description: 'Organized medication scheduling, reminders, and monitoring for peace of mind.',
    span: 'md:col-span-4',
    image: IMAGES.landing.serviceMedication,
  },
];

const ServiceCard = ({ service }) => (
  <motion.div
    variants={staggerItem}
    className="h-full"
    whileTap={{ scale: 0.98 }}
  >
    <Link
      to={`/patient/providers?service=${encodeURIComponent(service.title)}`}
      className="group block h-full text-left transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl md:rounded-[2.25rem]"
      aria-label={`View providers offering ${service.title}`}
    >
      <div className="neu-flat h-full rounded-2xl md:rounded-[2.25rem] overflow-hidden flex flex-col justify-between">
        <div>
          {service.image && (
            <div className="relative h-44 md:h-52 overflow-hidden">
              <img
                src={service.image}
                alt={service.title}
                loading="lazy"
                decoding="async"
                width="800"
                height="500"
                className="h-full w-full object-cover object-center opacity-100 contrast-105 saturate-110 transition-transform duration-500 ease-out group-hover:scale-105"
              />
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#ebf1f8] via-[#ebf1f8]/30 to-transparent dark:from-[#172236] dark:via-[#172236]/30 dark:to-transparent" />
            </div>
          )}
          <div className="p-6 md:p-8">
            <div className="neu-flat-sm w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-link group-hover:scale-105 transition-transform duration-300">
              <div className="card-icon-animate">
                {service.icon}
              </div>
            </div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
              <span>{service.title}</span>
              <ArrowUpRight size={16} weight="bold" className="text-link opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{service.description}</p>
          </div>
        </div>
        <div className="px-6 pb-6 md:px-8 md:pb-8 pt-0">
          <span className="text-xs font-bold text-link group-hover:underline inline-flex items-center gap-1">
            Find specialists
            <ArrowUpRight size={14} weight="bold" />
          </span>
        </div>
      </div>
    </Link>
  </motion.div>
);

const Services = () => (
  <section id="services" className="py-20 md:py-32 bg-secondary/50 dark:bg-slate-900/50 relative overflow-hidden border-t border-black/5 dark:border-white/5" aria-labelledby="services-heading">
    <div className="pointer-events-none absolute top-0 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
    <div className="container mx-auto px-4 md:px-6">
      <motion.div
        className="text-center space-y-4 mb-12 md:mb-16"
        initial={{ opacity: 0, y: 64 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: FLUID }}
      >
        <span className="eyebrow">What we do</span>
        <h2 id="services-heading" className="font-display text-3xl md:text-5xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Services we offer</h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
          From daily companionship to specialized medical care, find the right support for your needs.
        </p>
      </motion.div>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-12 grid-flow-dense gap-6"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.2 }}
      >
        {services.map((service, idx) => (
          <div key={idx} className={`col-span-1 ${service.span}`}>
            <ServiceCard service={service} />
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default Services;
