 
import { Heart, Stethoscope, Activity, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import useTilt from '../../hooks/useTilt';

const services = [
  {
    icon: <Heart className="w-8 h-8 text-primary" />,
    title: 'Elderly Care',
    description: 'Compassionate, professional care for senior family members in the comfort of their homes.',
  },
  {
    icon: <Stethoscope className="w-8 h-8 text-primary" />,
    title: 'Post-Surgery Care',
    description: 'Recovery assistance after medical procedures, including wound care and mobility support.',
  },
  {
    icon: <Activity className="w-8 h-8 text-primary" />,
    title: 'Physical Therapy',
    description: 'In-home rehabilitation sessions tailored to your recovery goals and schedule.',
  },
  {
    icon: <Users className="w-8 h-8 text-primary" />,
    title: 'Companion Care',
    description: 'Social support and daily companionship to improve quality of life and mental well-being.',
  },
  {
    icon: <Clock className="w-8 h-8 text-primary" />,
    title: 'Medication Management',
    description: 'Organized medication scheduling, reminders, and monitoring for peace of mind.',
  },
];

const ServiceCard = ({ service }) => {
  const { ref, style, handleMouseMove, handleMouseLeave } = useTilt(6);

  return (
    <motion.div
      variants={staggerItem}
      className="card text-center group hover:-translate-y-1 transition-transform duration-200"
      whileTap={{ scale: 0.98 }}
    >
      <div
        ref={ref}
        style={style}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
          <div className="bg-blue-50 dark:bg-blue-900/30 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-100 dark:shadow-slate-900/50 group-hover:bg-primary group-hover:shadow-primary/30 transition-all duration-300">
          <div className="card-icon-animate text-primary group-hover:text-white transition-colors duration-300">
            {service.icon}
          </div>
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">{service.title}</h3>
          <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">{service.description}</p>
      </div>
    </motion.div>
  );
};

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const Services = () => {
  return (
    <section id="services" className="py-14 bg-secondary/50 dark:bg-slate-800/50" aria-labelledby="services-heading">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center space-y-3 mb-10"
          {...(isMobile ? {} : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } })}
        >
          <h2 id="services-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Services We Offer</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm">
            From daily companionship to specialized medical care, find the right support for your needs.
          </p>
        </motion.div>
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
          {...(isMobile ? {} : { variants: staggerContainer, initial: 'initial', whileInView: 'animate', viewport: { once: true, amount: 0.2 } })}
        >
          {services.map((service, idx) => (
            <ServiceCard key={idx} service={service} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Services;
