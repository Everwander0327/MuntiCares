import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from '@phosphor-icons/react';
import { toLocalDateKey } from '@/lib/localDate';
import { useLanguage } from '@/contexts/LanguageContext';

const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  className = '',
  idleLabel,
  showSelectedRange = true,
  isActive,
  triggerClassName = '',
  showClearButton = true,
}) => {
  const { t } = useLanguage();
  const resolvedIdleLabel = idleLabel ?? t('common.dateRange.label');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presets = [
    { label: t('common.dateRange.last7'), days: 7 },
    { label: t('common.dateRange.last30'), days: 30 },
    { label: t('common.dateRange.last90'), days: 90 },
    { label: t('common.dateRange.thisYear'), days: 365 },
  ];

  const handlePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ start: toLocalDateKey(start), end: toLocalDateKey(end) });
    setIsOpen(false);
  };

  const hasFilter = Boolean(startDate || endDate);
  const activeState = typeof isActive === 'boolean' ? isActive : hasFilter;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className={
            triggerClassName ||
            `w-full neu-btn flex items-center justify-between sm:justify-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold min-h-[2.75rem] cursor-pointer active:scale-95 transition-all ${
              activeState
                ? 'text-link ring-2 ring-primary/20 bg-primary/5'
                : 'text-txt-secondary dark:text-txt-darkSecondary hover:text-link'
            }`
          }
        >
          <div className="flex items-center gap-2 truncate">
            <Calendar className="w-4 h-4 text-link shrink-0" aria-hidden="true" />
            {hasFilter && showSelectedRange ? (
              <span className="truncate max-w-[8.75rem] md:max-w-none tabular-nums">
                {startDate || '...'} — {endDate || '...'}
              </span>
            ) : (
              <span className="truncate">{resolvedIdleLabel}</span>
            )}
          </div>
        </button>

        {hasFilter && showClearButton && (
          <button
            type="button"
            aria-label={t('common.dateRange.clearAria')}
            onClick={() => onChange({ start: '', end: '' })}
            className="neu-btn min-h-[2.75rem] min-w-[2.75rem] rounded-2xl flex items-center justify-center text-tertiary hover:text-danger transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="neu-flat fixed inset-x-4 top-auto mt-2 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-full z-popover bg-surface-shell rounded-3xl border border-surface-border shadow-card p-4 sm:p-5 sm:w-96 w-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-extrabold text-tertiary">{t('common.dateRange.quickSelect')}</p>
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  onChange({ start: '', end: '' });
                  setIsOpen(false);
                }}
                className="text-xs font-bold text-danger dark:text-danger-dark hover:underline cursor-pointer"
              >
                {t('common.dateRange.reset')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.days}
                onClick={() => handlePreset(preset.days)}
                className="neu-btn min-h-[2.75rem] px-3 py-2 rounded-2xl text-xs font-bold text-ink dark:text-txt-darkPrimary hover:text-link transition-all active:scale-95 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-extrabold text-tertiary mb-2.5">{t('common.dateRange.customRange')}</p>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 rounded-2xl border border-surface-border bg-surface dark:bg-surface-dark px-2.5 min-h-[2.75rem] flex items-center">
              <input
                type="date"
                aria-label={t('common.dateRange.startDateAria')}
                value={startDate || ''}
                onChange={(e) => onChange({ start: e.target.value, end: endDate || '' })}
                className="w-full bg-transparent text-xs font-semibold text-ink dark:text-txt-darkPrimary outline-none focus:outline-none focus:ring-0"
                placeholder={t('common.dateRange.startPlaceholder')}
              />
            </div>
            <span className="text-tertiary text-xs font-bold shrink-0">{t('common.dateRange.to')}</span>
            <div className="flex-1 rounded-2xl border border-surface-border bg-surface dark:bg-surface-dark px-2.5 min-h-[2.75rem] flex items-center">
              <input
                type="date"
                aria-label={t('common.dateRange.endDateAria')}
                value={endDate || ''}
                onChange={(e) => onChange({ start: startDate || '', end: e.target.value })}
                className="w-full bg-transparent text-xs font-semibold text-ink dark:text-txt-darkPrimary outline-none focus:outline-none focus:ring-0"
                placeholder={t('common.dateRange.endPlaceholder')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
