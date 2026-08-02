import { motion } from 'framer-motion';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
    },
  },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const AnimatedPage = ({ children, className = '' }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className={className}
  >
    {children}
  </motion.div>
);

const StaggerContainer = ({ children, className = '' }) => (
  <motion.div
    variants={staggerContainer}
    initial="initial"
    animate="animate"
    className={className}
  >
    {children}
  </motion.div>
);

const StaggerItem = ({ children, className = '' }) => (
  <motion.div
    variants={staggerItem}
    className={className}
  >
    {children}
  </motion.div>
);

export { AnimatedPage, StaggerContainer, StaggerItem, pageVariants, staggerContainer, staggerItem };
export default AnimatedPage;
