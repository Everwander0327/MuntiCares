import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { PageMeta } from '@/shared/components';

import Hero from './components/Hero';
import Features from './components/Features';
import Services from './components/Services';
import HowItWorks from './components/HowItWorks';

const Coverage = lazy(() => import('./components/Coverage'));
const CTASection = lazy(() => import('./components/CTASection'));

const LandingPage = () => {
  return (
    <main
      className="overflow-x-hidden w-full max-w-full"
    >
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <PageMeta
        title="MuntiCares — Home Care, Right at Your Doorstep"
        description="Book verified home care providers in Muntinlupa City: elderly care, post-surgery care, physical therapy, companion care, and medication management."
        path="/"
      />
      <Hero />
      <Features />
      <Services />
      <HowItWorks />
      <Suspense fallback={<div className="py-20 md:py-32" aria-hidden="true" />}><Coverage /></Suspense>
      <Suspense fallback={<div className="py-20 md:py-32" aria-hidden="true" />}><CTASection /></Suspense>
    </motion.div>
    </main>
  );
};

export default LandingPage;
