import { Heart, Stethoscope, Heartbeat, UsersThree, Clock, ArrowUpRight } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import { IMAGES } from '@/lib/images';

const FLUID = [0.32, 0.72, 0, 1];

const services = [
  {
    icon: <Heart size={22} weight="light" className="text-primary" />,
    title: 'Elderly Care',
    description: 'Compassionate, professional care for senior family members in the comfort of their homes.',
    span: 'md:col-span-7',
    image: IMAGES.landing.serviceElderly,
  },
  {
    icon: <Stethoscope size={22} weight="light" className="text-primary" />,
    title: 'Post-Surgery Care',
    description: 'Recovery assistance after medical procedures, including wound care and mobility support.',
    span: 'md:col-span-5',
    image: IMAGES.landing.serviceRehab,
  },
  {
    icon: <Heartbeat size={22} weight="light" className="text-primary" />,
    title: 'Vital Monitoring',
    description: 'Regular check-ups, BP monitoring, glucose testing, and medication administration.',
    span: 'md:col-span-4',
    image: IMAGES.landing.serviceVitals,
  },
  {
    icon: <UsersThree size={22} weight="light" className="text-primary" />,
    title: 'Physical Therapy',
    description: 'Guided rehabilitation exercises to restore strength, movement, and independence.',
    span: 'md:col-span-4',
    image: IMAGES.landing.serviceNursing,
  },
  {
    icon: <Clock size={22} weight="light" className="text-primary" />,
    title: 'Respite Care',
    description: 'Short-term relief for primary caregivers, giving you peace of mind when you need it.',
    span: 'md:col-span-4',
    image: IMAGES.landing.serviceCaregiver,
  },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-32 bg-white dark:bg-slate-900" aria-label="Our services">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl space-y-4">
            <span className="text-2xs uppercase tracking-widest font-bold text-primary">Specialized Care</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
              Comprehensive In-Home Care Services
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-base md:text-lg">
              Tailored medical and companion services designed to support every stage of recovery and wellness.
            </p>
          </div>
          <Link
            to="/patient/providers"
            className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline"
          >
            Explore all services
            <ArrowUpRight size={16} weight="bold" />
          </Link>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          {services.map((service, i) => (
            <motion.div
              key={i}
              variants={staggerItem}
              transition={{ ease: FLUID }}
              className={`${service.span} group rounded-2xl md:rounded-3xl border border-black/5 dark:border-white/10 p-6 md:p-8 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-300`}
            >
              <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center mb-6">
                {service.icon}
              </div>
              <h3 className="font-display text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-3">
                {service.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
                {service.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Services;
