import React from 'react';

const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-24" />
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-16" />
      </div>
    </div>
  </div>
);

const SkeletonTable = ({ rows = 3, cols = 4 }) => (
  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-40 animate-pulse" />
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-20 animate-pulse" />
    </div>
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="flex-1">
              <div className={`h-4 bg-slate-200 dark:bg-slate-700 rounded-lg ${j === 0 ? 'w-32' : j === cols - 1 ? 'w-16' : 'w-full'}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const SkeletonPage = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
    <SkeletonTable />
  </div>
);

export { SkeletonCard, SkeletonTable, SkeletonPage };
export default SkeletonPage;
