import { Link } from 'react-router-dom';
import { Calendar, Clock, Stethoscope, Star, FileText, ArrowRight, RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/ui/sheet';
import { getInitials, getStatusBadgeClass } from '../utils/dashboardMetrics';

const PRESET_OPTIONS = [
  { key: '30D', label: 'Last 30 Days' },
  { key: '6M', label: 'Last 6 Months' },
  { key: 'ALL', label: 'All Time' },
];

const DashboardDetailSheet = ({
  sheet,
  onClose,
  startDate,
  endDate,
  activePreset,
  onApplyPreset,
  onChangeRange,
  onResetRange,
}) => {
  const isOpen = Boolean(sheet);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        className="px-4 pb-7 pt-0 sm:max-w-lg sm:mx-auto sm:mb-6 sm:rounded-3xl"
      >
        <div
          className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-slate-400/45 dark:bg-slate-500/45 sm:hidden"
          aria-hidden="true"
        />

        {sheet?.type === 'filter' && (
          <>
            <SheetHeader className="px-2 pt-3 pb-3 text-left ring-0 border-b border-black/5 dark:border-white/10">
              <SheetTitle className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                Filter Analytics Range
              </SheetTitle>
              <SheetDescription className="text-xs text-tertiary">
                Choose a preset timeframe or set custom start and end dates. Swipe down to close.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-2 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {PRESET_OPTIONS.map((preset) => {
                  const isActive = activePreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        onApplyPreset(preset.key);
                        onClose();
                      }}
                      className={`min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-95 ${
                        isActive
                          ? 'neu-btn-primary text-white dark:text-[#08182A]'
                          : 'neu-inset text-slate-800 dark:text-slate-100 hover:text-link'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="neu-inset rounded-2xl p-3.5 space-y-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-tertiary">
                  Custom Date Window
                </p>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  <label className="space-y-1 text-xs font-bold text-tertiary">
                    <span>From</span>
                    <input
                      type="date"
                      aria-label="Filter start date"
                      value={startDate || ''}
                      onChange={(e) => onChangeRange({ start: e.target.value, end: endDate || '' })}
                      className="w-full min-h-[42px] px-3 rounded-xl neu-flat-sm bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-tertiary">
                    <span>To</span>
                    <input
                      type="date"
                      aria-label="Filter end date"
                      value={endDate || ''}
                      onChange={(e) => onChangeRange({ start: startDate || '', end: e.target.value })}
                      className="w-full min-h-[42px] px-3 rounded-xl neu-flat-sm bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </label>
                </div>
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    onResetRange();
                    onClose();
                  }}
                  className="w-full min-h-[44px] neu-btn rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold text-danger dark:text-danger-dark cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Date Filter
                </button>
              )}
            </div>
          </>
        )}

        {sheet?.type === 'request' && sheet.item && (
          <>
            <SheetHeader className="px-2 pt-3 pb-3 text-left ring-0 border-b border-black/5 dark:border-white/10">
              <div className="flex items-start justify-between gap-3 sm:pr-10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-primary/15 dark:bg-primary-400/20 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                    {getInitials(sheet.item.user)}
                  </span>
                  <div className="min-w-0">
                    <SheetTitle className="font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                      {sheet.item.user}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-tertiary truncate">
                      {sheet.item.service || sheet.item.action} &bull; {sheet.item.date}
                    </SheetDescription>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${getStatusBadgeClass(sheet.item.status)}`}
                >
                  {sheet.item.status}
                </span>
              </div>
            </SheetHeader>

            <div className="space-y-3.5 px-2 pt-4">
              <div className="neu-inset rounded-2xl p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-tertiary font-semibold">
                    <Stethoscope className="w-3.5 h-3.5 text-link" />
                    Service
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    {sheet.item.service || 'General Healthcare'}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-tertiary font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-link" />
                    Scheduled
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    {sheet.item.scheduledLabel || sheet.item.date}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-tertiary font-semibold">
                    <Clock className="w-3.5 h-3.5 text-link" />
                    Assigned Provider
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    {sheet.item.providerName || 'Unassigned'}
                  </strong>
                </div>
                {sheet.item.notes && (
                  <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-1">
                    <span className="flex items-center gap-1.5 text-tertiary font-semibold">
                      <FileText className="w-3.5 h-3.5 text-link" />
                      Care Notes
                    </span>
                    <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                      {sheet.item.notes}
                    </p>
                  </div>
                )}
              </div>

              <Link
                to="/admin/requests"
                onClick={onClose}
                className="w-full min-h-[44px] neu-btn-primary rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold text-white dark:text-[#08182A]"
              >
                Open in Requests Manager
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}

        {sheet?.type === 'provider' && sheet.item && (
          <>
            <SheetHeader className="px-2 pt-3 pb-3 text-left ring-0 border-b border-black/5 dark:border-white/10">
              <div className="flex items-start justify-between gap-3 sm:pr-10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-2xl bg-sky-500/15 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                    {getInitials(sheet.item.name)}
                  </span>
                  <div className="min-w-0">
                    <SheetTitle className="font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                      {sheet.item.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-tertiary">
                      Approved Healthcare Provider
                    </SheetDescription>
                  </div>
                </div>
                <span className="neu-flat-sm px-2.5 py-1 rounded-xl inline-flex items-center gap-1 text-warning dark:text-warning-dark font-extrabold text-xs shrink-0">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {Number(sheet.item.rating || 0).toFixed(1)}
                </span>
              </div>
            </SheetHeader>

            <div className="space-y-3.5 px-2 pt-4">
              <div className="neu-inset rounded-2xl p-3.5 space-y-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-tertiary">Trust Score</span>
                    <strong className="tabular-nums text-slate-900 dark:text-white">
                      {sheet.item.trust_score || 0}%
                    </strong>
                  </div>
                  <div className="h-2 rounded-full neu-flat-sm overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-primary dark:bg-primary-400"
                      style={{ width: `${Math.min(100, Math.max(0, Number(sheet.item.trust_score) || 0))}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="font-semibold text-tertiary block">Specialties</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(sheet.item.services?.length ? sheet.item.services : ['General Healthcare']).map((srv) => (
                      <span
                        key={srv}
                        className="px-2.5 py-1 rounded-lg neu-flat-sm text-[11px] font-bold text-slate-800 dark:text-slate-100"
                      >
                        {srv}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <Link
                to="/admin/providers"
                onClick={onClose}
                className="w-full min-h-[44px] neu-btn-primary rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold text-white dark:text-[#08182A]"
              >
                Manage Providers
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default DashboardDetailSheet;
