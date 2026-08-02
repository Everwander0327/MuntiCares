import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';

import Hero from './landing/Hero';
import Features from './landing/Features';
import Services from './landing/Services';
import HowItWorks from './landing/HowItWorks';

const Coverage = lazy(() => import('./landing/Coverage'));
const FAQ = lazy(() => import('./landing/FAQ'));
const CTASection = lazy(() => import('./landing/CTASection'));

const LandingPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Hero />
      <Features />
      <Services />
      <HowItWorks />
      <Suspense fallback={<div className="py-24" />}><Coverage /></Suspense>
      <Suspense fallback={<div className="py-24" />}><FAQ /></Suspense>
      <Suspense fallback={<div className="py-24" />}><CTASection /></Suspense>
    </motion.div>
  );
};

export default LandingPage;
