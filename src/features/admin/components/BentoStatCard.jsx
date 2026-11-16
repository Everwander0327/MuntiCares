import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CaretRight } from '@phosphor-icons/react';

const BentoStatCard = ({
  label,
  value,
  tag,
  tagClass = 'text-link',
  sparkPoints = '',
  sparkColor = 'var(--chart-1)',
  trailing = null,
  to = '',
  variants,
}) => {
  const numericValue = Number.isFinite(Number(value)) ? parseInt(value, 10) : 0;

  const cardBody = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-tertiary truncate group-hover:text-link transition-colors">
          <span className="truncate">{label}</span>
          {to && (
            <CaretRight
              className="w-3.5 h-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
              aria-hidden="true"
            />
          )}
        </span>
        {tag && (
          <span className={`text-xs font-extrabold whitespace-nowrap shrink-0 ${tagClass}`}>
            {tag}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 mt-2.5">
        <span className="tabular-nums font-display font-extrabold text-2xl sm:text-3xl tracking-tight leading-none text-ink dark:text-txt-darkPrimary">
          {numericValue}
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
    </>
  );

  if (to) {
    return (
      <motion.div variants={variants}>
        <Link
          to={to}
          className="group neu-flat rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between transition-transform duration-300 ease-fluid hover:-translate-y-0.5 h-full"
        >
          {cardBody}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={variants}
      className="neu-flat rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between transition-transform duration-300 ease-fluid hover:-translate-y-0.5"
    >
      {cardBody}
    </motion.div>
  );
};

export default BentoStatCard;
