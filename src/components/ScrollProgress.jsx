import { motion, useScroll, useSpring } from 'framer-motion';

// GPU-safe scroll progress — uses framer-motion useScroll (no manual scroll listener)
const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-600 via-blue-400 to-primary-600 z-50 origin-left"
      style={{ scaleX }}
    />
  );
};

export default ScrollProgress;
