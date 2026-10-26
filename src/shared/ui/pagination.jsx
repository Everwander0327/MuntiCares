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
    <div className="flex items-center justify-center select-none py-1">
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="neu-btn w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-link disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>
        {getVisiblePages().map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-tertiary dark:text-tertiary text-xs font-black">...</span>
          ) : (
            <motion.button
              key={page}
              whileTap={{ scale: 0.94 }}
              onClick={() => onPageChange(page)}
              className={`min-w-11 h-11 px-3 rounded-xl text-xs font-black transition-all ${
                currentPage === page
                  ? 'neu-inset text-link ring-2 ring-primary/30 bg-primary/10 shadow-inner'
                  : 'neu-btn text-slate-700 dark:text-slate-200 hover:text-link'
              }`}
            >
              {page}
            </motion.button>
          )
        )}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="neu-btn w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-link disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
};

export default Pagination;
