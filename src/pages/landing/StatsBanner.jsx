/* eslint-disable react/prop-types */
import { Users, ShieldCheck, Star, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';
import useCountUp from '../../hooks/useCountUp';
import { staggerContainer, staggerItem } from './animations';

const StatNumber = ({ end, suffix = '' }) => {
  const { count, ref } = useCountUp(end, 2000);
  return <span ref={ref}>{count}{suffix}</span>;
};

const DecimalStat = ({ end, suffix }) => {
  const { count, ref } = useCountUp(Math.floor(end * 10), 2000);
  return <span ref={ref}>{(count / 10).toFixed(1)}{suffix}</span>;
};

const StatsBanner = () => {
  const stats = [
    { icon: <Users className="w-5 h-5" />, value: 500, suffix: '+', label: 'Patients Served' },
    { icon: <ShieldCheck className="w-5 h-5" />, value: 50, suffix: '+', label: 'Verified Providers' },
    { icon: <Star className="w-5 h-5" />, value: 4.9, suffix: '★', label: 'Average Rating', isDecimal: true },
    { icon: <Headphones className="w-5 h-5" />, value: 24, suffix: '/7', label: 'Support' },
  ];

  return (
    <section id="stats" className="py-8 bg-white dark:bg-slate-800 border-y border-slate-100 dark:border-slate-700" aria-label="Statistics">
      <div className="container mx-auto px-6">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
        >
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              variants={staggerItem}
              className="text-center space-y-2"
            >
              <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-900/30 text-primary rounded-2xl mb-2">
                {stat.icon}
              </div>
              <p className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {stat.isDecimal ? (
                  <DecimalStat end={stat.value} suffix={stat.suffix} />
                ) : (
                  <StatNumber end={stat.value} suffix={stat.suffix} />
                )}
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default StatsBanner;
