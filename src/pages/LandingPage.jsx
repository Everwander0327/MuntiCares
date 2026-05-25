import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';

import Hero from './landing/Hero';
import StatsBanner from './landing/StatsBanner';
import TrustBadges from './landing/TrustBadges';
import Features from './landing/Features';
import Services from './landing/Services';
import HowItWorks from './landing/HowItWorks';
import TestimonialTicker from './landing/TestimonialTicker';
import ProviderSpotlight from './landing/ProviderSpotlight';
import BackToTop from '../components/BackToTop';
import SectionNav from '../components/SectionNav';
import StickyCTA from '../components/StickyCTA';
import QuickSearch from '../components/QuickSearch';
import ActivityToast from '../components/ActivityToast';

const Coverage = lazy(() => import('./landing/Coverage'));
const Testimonials = lazy(() => import('./landing/Testimonials'));
const FAQ = lazy(() => import('./landing/FAQ'));
const CTASection = lazy(() => import('./landing/CTASection'));

const LandingPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        <Hero />
      </div>
      <StatsBanner />
      <TestimonialTicker />
      <TrustBadges />
      <Features />
      <Services />
      <ProviderSpotlight />
      <HowItWorks />
      <Suspense fallback={<div className="py-24" />}><Coverage /></Suspense>
      <Suspense fallback={<div className="py-24" />}><Testimonials /></Suspense>
      <Suspense fallback={<div className="py-24" />}><FAQ /></Suspense>
      <Suspense fallback={<div className="py-24" />}><CTASection /></Suspense>
      <BackToTop />
      <ActivityToast />
      <QuickSearch />
      <SectionNav />
      <StickyCTA />
    </motion.div>
  );
};

export default LandingPage;
