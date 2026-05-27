 
import { cloneElement } from 'react';
import { Calendar, ShieldCheck, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';
import useTilt from '../../hooks/useTilt';

const features = [
  {
    icon: <Calendar className="w-8 h-8 text-primary" />,
    title: "Easy Booking",
    description: "Book a professional provider in minutes with our streamlined scheduling system."
  },
  {
    icon: <ShieldCheck className="w-8 h-8 text-primary" />,
    title: "Verified Providers",
    description: "All providers undergo rigorous background checks and credential verification."
  },
  {
    icon: <Lock className="w-8 h-8 text-primary" />,
    title: "Secure Health Data",
    description: "You have full control over your information. We prioritize your privacy and security."
  }
];

const FeatureCard = ({ feature }) => {
  const { ref, style, handleMouseMove, handleMouseLeave } = useTilt(6);

  return (
    <motion.div
      variants={staggerItem}
      className="card group relative overflow-hidden hover:-translate-y-1 transition-transform duration-200"
      whileTap={{ scale: 0.98 }}
    >
      <div
        ref={ref}
        style={style}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative"
      >
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none hidden lg:block"
             style={{
               background: 'linear-gradient(135deg, #1E6FBF, #60A5FA, #1E6FBF)',
               padding: '2px',
               mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
               maskComposite: 'exclude',
               WebkitMaskComposite: 'xor',
             }}
        />
          <div className="bg-blue-50 dark:bg-blue-900/30 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-100 dark:shadow-slate-900/50 group-hover:bg-primary group-hover:shadow-primary/30 transition-all duration-300">
          <div className="card-icon-animate">
            {cloneElement(feature.icon, { className: "w-5 h-5 text-primary group-hover:text-white transition-colors" })}
          </div>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{feature.title}</h3>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{feature.description}</p>
      </div>
    </motion.div>
  );
};

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const Features = () => {
  return (
    <section id="features" className="py-14 bg-white dark:bg-slate-800" aria-labelledby="features-heading">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center space-y-3 mb-10"
          {...(isMobile ? {} : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } })}
        >
          <h2 id="features-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Why MuntiCares?</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm">We&apos;re committed to providing the safest and most efficient home care connection in the city.</p>
        </motion.div>
        <motion.div
          className="grid md:grid-cols-3 gap-6"
          {...(isMobile ? {} : { variants: staggerContainer, initial: 'initial', whileInView: 'animate', viewport: { once: true, amount: 0.2 } })}
        >
          {features.map((feature, idx) => (
            <FeatureCard key={idx} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
