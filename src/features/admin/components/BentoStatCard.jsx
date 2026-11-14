import { motion } from 'framer-motion';
import useCountUp from '@/hooks/useCountUp';

const BentoStatCard = ({
  label,
  value,
  tag,
  tagClass = 'text-link',
  sparkPoints = '',
  sparkColor = 'var(--chart-1)',
  trailing = null,
  variants,
}) => {
  const { count, ref } = useCountUp(parseInt(value, 10) || 0, 1100, false);

  return (
    <motion.div
      variants={variants}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      className="neu-flat rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-tertiary truncate">{label}</span>
        {tag && (
          <span className={`text-[11px] font-extrabold whitespace-nowrap shrink-0 ${tagClass}`}>
            {tag}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 mt-2.5">
        <span
          ref={ref}
          className="tabular-nums font-display font-extrabold text-2xl sm:text-3xl tracking-tight leading-none text-slate-900 dark:text-white"
        >
          {count}
        </span>

        {trailing || (sparkPoints ? (
          <svg
            viewBox="0 0 64 22"
            className="w-12 sm:w-14 h-5 sm:h-6 shrink-0"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke={sparkColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparkPoints}
            />
          </svg>
        ) : null)}
      </div>
    </motion.div>
  );
};

export default BentoStatCard;
