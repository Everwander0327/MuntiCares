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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full neu-btn flex items-center justify-between sm:justify-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer active:scale-95 transition-all ${
          hasFilter
            ? 'text-primary ring-2 ring-primary/20 bg-primary/5'
            : 'text-slate-600 dark:text-slate-300 hover:text-primary'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          {hasFilter ? (
            <span className="truncate max-w-[110px] xs:max-w-[140px] md:max-w-none">{startDate || '...'} — {endDate || '...'}</span>
          ) : (
            <span className="truncate">Date range</span>
          )}
        </div>
        {hasFilter && (
          <X
            className="w-3.5 h-3.5 ml-1 text-slate-400 hover:text-red-500 transition-colors shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ start: '', end: '' });
            }}
          />
        )}
      </button>

      {isOpen && (
        <div className="neu-flat fixed inset-x-4 top-auto mt-2 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-full z-50 bg-[#ebf1f8] dark:bg-[#172236] rounded-3xl border border-white/80 dark:border-white/10 shadow-2xl p-4 sm:p-5 sm:w-96 w-auto">
          <p className="text-3xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Quick select</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.days}
                onClick={() => handlePreset(preset.days)}
                className="neu-btn px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-all active:scale-95 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-3xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">Custom range</p>
          <div className="flex items-center gap-2 min-w-0">
            <div className="neu-inset flex-1 rounded-xl px-2.5 py-1.5 flex items-center">
              <input
                type="date"
                value={startDate || ''}
                onChange={(e) => onChange({ start: e.target.value, end: endDate || '' })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0"
                placeholder="Start"
              />
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold shrink-0">to</span>
            <div className="neu-inset flex-1 rounded-xl px-2.5 py-1.5 flex items-center">
              <input
                type="date"
                value={endDate || ''}
                onChange={(e) => onChange({ start: startDate || '', end: e.target.value })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0"
                placeholder="End"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
