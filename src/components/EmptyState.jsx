import React from 'react';
import { motion } from 'framer-motion';

const illustrations = {
  search: (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <circle cx="52" cy="52" r="28" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
      <circle cx="52" cy="52" r="16" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" />
      <path d="M72 72l16 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-slate-300 dark:text-slate-600" />
      <path d="M40 40l6 6M58 40l6 6M40 58l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="20" y="30" width="80" height="55" rx="8" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
      <path d="M20 55l25 12a8 8 0 0030 0l25-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-slate-300 dark:text-slate-600" />
      <path d="M48 65h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="30" y="15" width="60" height="90" rx="6" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
      <rect x="40" y="35" width="40" height="4" rx="2" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" />
      <rect x="40" y="48" width="30" height="4" rx="2" stroke="currentColor" strokeWidth="2" className="text-slate-200 dark:text-slate-700" />
      <rect x="40" y="60" width="35" height="4" rx="2" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" />
      <circle cx="60" cy="82" r="8" stroke="currentColor" strokeWidth="2" className="text-slate-200 dark:text-slate-700" />
      <path d="M56 82h8M60 78v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <path d="M15 85l15-20 15 10 15-30 15 15 15-25 15 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-600" />
      <circle cx="30" cy="75" r="3" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
      <circle cx="60" cy="45" r="3" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
      <circle cx="90" cy="55" r="3" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
      <path d="M50 95l10-20 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <circle cx="42" cy="38" r="14" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
      <path d="M16 88c0-14 12-26 26-26s26 12 26 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-slate-300 dark:text-slate-600" />
      <circle cx="76" cy="44" r="11" stroke="currentColor" strokeWidth="2.5" className="text-slate-200 dark:text-slate-700" />
      <path d="M88 88c0-11-9-20-20-20s-20 9-20 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <path d="M60 20l9 28h29l-23 17 9 28-24-17-24 17 9-28-23-17h29z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className="text-slate-200 dark:text-slate-700" />
      <path d="M60 30l6 18h19l-15 11 6 18-16-11-16 11 6-18-15-11h19z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-slate-200 dark:text-slate-700" />
    </svg>
  ),
};

const EmptyState = ({ icon = 'search', title, message, action, variant = 'default' }) => {
  const isCompact = variant === 'compact';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center ${isCompact ? 'py-8' : 'py-16'}`}
    >
      <div className={`${isCompact ? 'w-24 h-24' : 'w-32 h-32'} mb-4 text-slate-300 dark:text-slate-600`}>
        {illustrations[icon] || illustrations.search}
      </div>
      <h3 className={`font-bold text-slate-600 dark:text-slate-300 ${isCompact ? 'text-sm' : 'text-lg'}`}>
        {title || 'Nothing here yet'}
      </h3>
      {message && (
        <p className={`text-slate-400 dark:text-slate-500 mt-1 max-w-xs ${isCompact ? 'text-xs' : 'text-sm'}`}>
          {message}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;