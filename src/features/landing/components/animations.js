export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 64 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.32, 0.72, 0, 1],
    },
  },
};

export const heroStagger = {
  animate: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export const heroItem = {
  initial: { opacity: 0, y: 64 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.32, 0.72, 0, 1],
    },
  },
};
