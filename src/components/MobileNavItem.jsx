import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MobileNavItem = ({ icon, label, to, active, badge, prominent }) => {
  if (prominent) {
    return (
      <Link to={to} className="flex-1 flex justify-center">
        <motion.div
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center gap-0 -mt-4 transition-all relative select-none"
        >
          <div className="relative w-14 h-14 rounded-full bg-primary shadow-xl shadow-primary/30 dark:shadow-primary/40 ring-[3px] ring-white dark:ring-slate-800 flex items-center justify-center">
            {React.cloneElement(icon, {
              className: 'w-7 h-7 text-white'
            })}
            <AnimatePresence>
              {badge > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-3xs font-bold text-white px-0.5"
                >
                  {badge > 9 ? '9+' : badge}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="text-2xs font-medium text-primary mt-0.5">{label}</span>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={to} className="flex-1">
      <motion.div
        whileTap={{ scale: 0.9 }}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all relative select-none ${
          active
            ? 'text-primary bg-primary/10'
            : 'text-black/40 hover:text-black/70 dark:text-slate-400 dark:hover:text-slate-300'
        }`}
      >
        <div className="relative">
          {React.cloneElement(icon, {
            className: `w-5 h-5 transition-colors ${active ? 'text-primary' : ''}`
          })}
          <AnimatePresence>
            {badge > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                 className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-3xs font-bold text-white px-0.5"
              >
                {badge > 9 ? '9+' : badge}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className={`text-2xs font-medium transition-colors ${active ? 'text-primary' : ''}`}>
          {label}
        </span>
        {active && (
          <motion.div
            className="h-[3px] w-6 bg-primary rounded-full"
            layoutId="mobile-indicator"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
      </motion.div>
    </Link>
  );
};

export default MobileNavItem;
