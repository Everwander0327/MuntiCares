import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

const DateRangePicker = ({ startDate, endDate, onChange, className = '' }) => {
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
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'This year', days: 365 },
  ];

  const handlePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
    setIsOpen(false);
  };

  const hasFilter = startDate || endDate;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium min-h-[44px] transition-all ${
          hasFilter
            ? 'bg-primary/5 border-primary/30 text-primary'
            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
        }`}
      >
        <Calendar className="w-4 h-4" />
        {hasFilter ? (
          <span className="truncate max-w-[100px] md:max-w-none">{startDate || '...'} — {endDate || '...'}</span>
        ) : (
          <span>Date range</span>
        )}
        {hasFilter && (
          <X
            className="w-4 h-4 ml-1.5 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ start: '', end: '' });
            }}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl p-4 sm:w-96 w-[calc(100vw-2rem)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 dark:text-slate-500">Quick select</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {presets.map((preset) => (
              <button
                key={preset.days}
                onClick={() => handlePreset(preset.days)}
                className="px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 dark:text-slate-500">Custom range</p>
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => onChange({ start: e.target.value, end: endDate || '' })}
              className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              placeholder="Start"
            />
            <span className="text-slate-400 text-xs shrink-0">to</span>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => onChange({ start: startDate || '', end: e.target.value })}
              className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              placeholder="End"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
