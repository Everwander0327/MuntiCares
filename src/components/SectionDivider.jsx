/* eslint-disable react/prop-types */
const SectionDivider = ({ variant = 'wave' }) => {
  if (variant === 'wave') {
    return (
      <div className="relative h-16 md:h-24 -mt-1 overflow-hidden bg-white dark:bg-slate-800">
        <svg
          className="absolute bottom-0 w-full h-full"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          fill="#F0F7FF"
        >
          <path d="M0,40 C360,100 1080,0 1440,40 L1440,100 L0,100 Z" />
        </svg>
      </div>
    );
  }

  if (variant === 'curve') {
    return (
      <div className="relative h-16 md:h-24 -mt-1 overflow-hidden bg-secondary/50 dark:bg-slate-800/50">
        <svg
          className="absolute bottom-0 w-full h-full dark:fill-slate-800"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          fill="white"
        >
          <path d="M0,60 C360,0 1080,100 1440,60 L1440,100 L0,100 Z" />
        </svg>
      </div>
    );
  }

  return null;
};

export default SectionDivider;
