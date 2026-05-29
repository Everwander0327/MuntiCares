import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors dark:hover:bg-slate-700 dark:text-slate-400"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>
        {getVisiblePages().map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400 dark:text-slate-500 text-sm">...</span>
          ) : (
            <motion.button
              key={page}
              whileTap={{ scale: 0.96 }}
              onClick={() => onPageChange(page)}
              className={`min-w-[36px] h-9 rounded-xl text-sm font-bold transition-all ${
                currentPage === page
                  ? 'bg-primary text-white shadow-sm shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {page}
            </motion.button>
          )
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors dark:hover:bg-slate-700 dark:text-slate-400"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
};

export default Pagination;
