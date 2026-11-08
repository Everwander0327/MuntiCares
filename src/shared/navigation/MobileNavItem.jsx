import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MobileNavItem = ({ icon, label, to, active, badge, prominent }) => {
  if (prominent) {
    return (
      <Link to={to} className="flex-1 flex justify-center">
        <motion.div
          whileTap={{ scale: 0.94 }}
          className="flex flex-col items-center -mt-5 transition-all relative select-none"
        >
          <div className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 border-white dark:border-[#0D1622] ${
            active 
              ? 'neu-btn-primary shadow-lg shadow-blue-900/50 ring-2 ring-primary/40 scale-105' 
              : 'neu-btn-primary shadow-lg shadow-blue-900/40 hover:scale-105'
          }`}>
            {React.cloneElement(icon, {
              className: 'w-5 h-5 text-white'
            })}
            <AnimatePresence>
              {badge > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#BC3030] dark:bg-[#F4918B] text-white dark:text-[#3C1B1A] rounded-full border-2 border-white dark:border-[#0D1622] flex items-center justify-center text-[10px] font-black px-1 shadow-md"
                >
                  {badge > 9 ? '9+' : badge}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className={`text-[9px] uppercase tracking-tight mt-1 transition-colors font-black ${
            active ? 'text-link dark:text-[#8CBDF0]' : 'text-link dark:text-[#8CBDF0]'
          }`}>
            {label}
          </span>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={to} className="flex-1 flex justify-center">
      <motion.div
        whileTap={{ scale: 0.92 }}
        className="flex flex-col items-center gap-1 py-1 px-0.5 transition-all relative select-none w-full"
      >
        <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
          active
            ? 'neu-inset text-link dark:text-[#8CBDF0] font-bold shadow-inner ring-1 ring-primary/20 dark:ring-primary/30 translate-y-0.5'
            : 'text-txt-secondary dark:text-txt-darkSecondary hover:text-link dark:hover:text-[#8CBDF0]'
        }`}>
          {React.cloneElement(icon, {
            className: `w-4 h-4 transition-colors ${active ? 'text-link dark:text-[#8CBDF0]' : ''}`
          })}
          <AnimatePresence>
            {badge > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-[#BC3030] dark:bg-[#F4918B] text-white dark:text-[#3C1B1A] rounded-full border-2 border-white dark:border-[#16212E] flex items-center justify-center text-[10px] font-black px-0.5 shadow-sm"
              >
                {badge > 9 ? '9+' : badge}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className={`text-[10px] font-bold transition-colors text-center truncate max-w-full px-0.5 ${
          active ? 'text-link dark:text-[#8CBDF0] font-extrabold' : 'text-txt-secondary dark:text-txt-darkSecondary'
        }`}>
          {label}
        </span>
      </motion.div>
    </Link>
  );
};

export default MobileNavItem;
