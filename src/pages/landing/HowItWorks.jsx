import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from './animations';

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

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-14 bg-secondary/50 dark:bg-slate-800/50" aria-labelledby="howitworks-heading">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center space-y-3 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 id="howitworks-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">How It Works</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm">Getting the care you need is simpler than you think.</p>
        </motion.div>
        <motion.div
          className="flex flex-col md:flex-row gap-8 relative"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-blue-100 dark:bg-blue-900/50 -z-10"></div>
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
              whileTap={{ scale: 0.98 }}
              className="flex-1 card p-6 relative transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2"
            >
              <div className="absolute -top-5 left-6 bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-200">
                {step.number}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 mt-3">{step.title}</h3>
              <p className="text-slate-600 dark:text-slate-300">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
