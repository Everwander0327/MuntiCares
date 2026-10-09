import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MobileNavItem = ({ icon, label, to, active, badge, prominent }) => {
  if (prominent) {
    return (
      <Link to={to} className="flex-1 flex justify-center">
        <motion.div
          whileTap={{ scale: 0.94 }}
          className="flex flex-col items-center gap-0.5 -mt-6 transition-all relative select-none"
        >
          <div className="relative w-14 h-14 rounded-full neu-btn-primary flex items-center justify-center shadow-xl ring-[3px] ring-white dark:ring-slate-800">
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
                  className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-3xs font-black text-white px-0.5 shadow-md"
                >
                  {badge > 9 ? '9+' : badge}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="text-2xs font-extrabold uppercase tracking-wide text-primary mt-0.5">{label}</span>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={to} className="flex-1">
      <motion.div
        whileTap={{ scale: 0.92 }}
        className="flex flex-col items-center gap-1 py-1 px-1 transition-all relative select-none"
      >
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
          active
            ? 'neu-btn-primary text-white scale-105'
            : 'neu-flat-sm text-slate-500 dark:text-slate-400 hover:text-primary'
        }`}>
          {React.cloneElement(icon, {
            className: `w-4 h-4 transition-colors ${active ? 'text-white' : ''}`
          })}
          <AnimatePresence>
            {badge > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-3xs font-extrabold text-white px-0.5 shadow-sm"
              >
                {badge > 9 ? '9+' : badge}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className={`text-3xs font-bold transition-colors truncate max-w-[56px] text-center ${active ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>
          {label}
        </span>
      </motion.div>
    </Link>
  );
};

export default MobileNavItem;
