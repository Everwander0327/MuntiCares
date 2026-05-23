import React from 'react';
import { 
  Calendar, 
  ShieldCheck, 
  Lock, 
  ArrowRight,
  Users,
  Star,
  HeartHandshake,
  Headphones,
  ChevronRight,
  Quote
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import heroImage from '../assets/hero.png';
import useCountUp from '../hooks/useCountUp';

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const StatNumber = ({ end, suffix = '' }) => {
  const { count, ref } = useCountUp(end, 2000);
  return <span ref={ref}>{count}{suffix}</span>;
};

const Hero = () => {
  return (
    <section className="pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <motion.div 
            className="flex-1 text-center md:text-left space-y-8 max-w-2xl"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-primary px-4 py-2 rounded-full text-sm font-semibold animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Muntinlupa City's Trusted Network
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Quality Home Care, <br className="hidden md:block" />
              <span className="text-primary">Right at Your Doorstep</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto md:mx-0">
              Connecting Muntinlupa City residents with trusted, verified home care providers — fast, secure, and patient-first.
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
          <motion.div 
            className="flex-1 relative w-full max-w-xl mx-auto"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl animate-float border-8 border-white dark:border-slate-800">
              <img 
                src={heroImage} 
                alt="Home Care Provider" 
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-200 rounded-full blur-3xl opacity-30 -z-10"></div>
            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-300 rounded-full blur-3xl opacity-30 -z-10"></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const StatsBanner = () => {
  const stats = [
    { icon: <Users className="w-6 h-6" />, value: 500, suffix: '+', label: 'Patients Served' },
    { icon: <ShieldCheck className="w-6 h-6" />, value: 50, suffix: '+', label: 'Verified Providers' },
    { icon: <Star className="w-6 h-6" />, value: 4.9, suffix: '★', label: 'Average Rating', isDecimal: true },
    { icon: <Headphones className="w-6 h-6" />, value: 24, suffix: '/7', label: 'Support' },
  ];

  const DecimalStat = ({ end, suffix }) => {
    const { count, ref } = useCountUp(Math.floor(end * 10), 2000);
    return <span ref={ref}>{(count / 10).toFixed(1)}{suffix}</span>;
  };

  return (
    <section className="py-12 bg-white dark:bg-slate-800 border-y border-slate-100 dark:border-slate-700">
      <div className="container mx-auto px-6">
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
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
              <p className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100">
                {stat.isDecimal ? (
                  <DecimalStat end={stat.value} suffix={stat.suffix} />
                ) : (
                  <StatNumber end={stat.value} suffix={stat.suffix} />
                )}
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const Features = () => {
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

  return (
    <section className="py-24 bg-white dark:bg-slate-800">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center space-y-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">Why MuntiCares?</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">We're committed to providing the safest and most efficient home care connection in the city.</p>
        </motion.div>
        <motion.div 
          className="grid md:grid-cols-3 gap-8"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
        >
          {features.map((feature, idx) => (
            <motion.div 
              key={idx} 
              variants={staggerItem}
              className="card group relative overflow-hidden"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              {/* Gradient border on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" 
                   style={{ 
                     background: 'linear-gradient(135deg, #1E6FBF, #60A5FA, #1E6FBF)', 
                     padding: '2px',
                     mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                     maskComposite: 'exclude',
                     WebkitMaskComposite: 'xor',
                   }} 
              />
              <div className="bg-blue-50 dark:bg-blue-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-100 dark:shadow-slate-900/50 group-hover:bg-primary group-hover:shadow-primary/30 transition-all duration-300">
                {React.cloneElement(feature.icon, { className: "w-8 h-8 text-primary group-hover:text-white transition-colors" })}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      title: "Create your profile",
      description: "Sign up and tell us about your care needs or professional skills."
    },
    {
      number: "02",
      title: "Find and request",
      description: "Browse verified profiles and send a request to your preferred provider."
    },
    {
      number: "03",
      title: "Manage your care",
      description: "Schedule visits, track care progress, and manage payments securely."
    }
  ];

  return (
    <section className="py-24 bg-secondary/50 dark:bg-slate-800/50">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center space-y-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">How It Works</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">Getting the care you need is simpler than you think.</p>
        </motion.div>
        <motion.div 
          className="flex flex-col md:flex-row gap-12 relative"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Connecting line between steps */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-blue-100 dark:bg-blue-900/50 -z-10"></div>
          
          {/* Connecting arrows between steps */}
          <div className="hidden md:flex absolute top-1/2 left-[67%] -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="bg-white dark:bg-slate-800 rounded-full p-1 shadow-md border border-blue-100 dark:border-slate-700">
              <ChevronRight className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="hidden md:flex absolute top-1/2 left-[33%] -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="bg-white dark:bg-slate-800 rounded-full p-1 shadow-md border border-blue-100 dark:border-slate-700">
              <ChevronRight className="w-5 h-5 text-primary" />
            </div>
          </div>
          
          {steps.map((step, idx) => (
            <motion.div 
              key={idx} 
              variants={staggerItem}
              className="flex-1 bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl shadow-blue-900/5 dark:shadow-slate-900/50 border border-blue-50 dark:border-slate-700 relative transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2"
            >
              <div className="absolute -top-6 left-8 bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-200">
                {step.number}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 mt-4">{step.title}</h3>
              <p className="text-slate-600 dark:text-slate-300">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const Testimonials = () => {
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

  return (
    <section className="py-24 bg-white dark:bg-slate-800">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center space-y-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">What Our Users Say</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">Real experiences from families and providers across Muntinlupa.</p>
        </motion.div>
        <motion.div 
          className="grid md:grid-cols-3 gap-8"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
        >
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              variants={staggerItem}
              className="relative bg-gradient-to-br from-slate-50 dark:from-slate-800 to-blue-50/50 dark:to-slate-700/50 p-8 rounded-3xl border border-blue-100/50 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <Quote className="w-8 h-8 text-primary/20 mb-4" />
              <p className="text-slate-700 leading-relaxed mb-6 text-lg italic">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {t.initials}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{t.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t.location}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Hero />
      <StatsBanner />
      <Features />
      <HowItWorks />
      <Testimonials />
      
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div 
            className="bg-primary rounded-[3rem] p-12 md:p-20 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-200"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl md:text-5xl font-bold">Ready to experience better care?</h2>
              <p className="text-blue-100 text-lg max-w-2xl mx-auto">
                Join hundreds of families in Muntinlupa City who trust MuntiCares for their home healthcare needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register" className="bg-white text-primary px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.97] transition-all shadow-xl">
                  Get Started Now
                </Link>
                <button className="bg-transparent border-2 border-white/30 hover:border-white hover:scale-[1.02] active:scale-[0.97] text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all">
                  Learn More
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
};

export default LandingPage;
