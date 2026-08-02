import { useState, useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';

const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  const scaleX = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const current = window.scrollY;
      setProgress(total > 0 ? current / total : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    scaleX.set(progress);
  }, [progress, scaleX]);

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-blue-400 to-primary z-[9999] origin-left"
      style={{ scaleX }}
    />
  );
};

export default ScrollProgress;
