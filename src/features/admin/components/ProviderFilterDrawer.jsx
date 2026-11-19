import { DownloadSimple, ArrowCounterClockwise, ArrowUp, ArrowDown } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/shared/ui';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { toLocalDateKey } from '@/lib/localDate';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_OPTIONS = ['All', 'Approved', 'Pending Approval', 'Incomplete', 'Banned'];

const SORT_OPTION_KEYS = [
  { value: '', labelKey: 'admin.providerDrawer.defaultSort' },
  { value: 'name', labelKey: 'admin.providerDrawer.sortName' },
  { value: 'services', labelKey: 'admin.providerDrawer.sortSpecialization' },
  { value: 'rating', labelKey: 'admin.providerDrawer.sortRating' },
  { value: 'joinTimestamp', labelKey: 'admin.providerDrawer.sortJoined' },
  { value: 'status', labelKey: 'admin.providerDrawer.sortStatus' },
];

const DATE_PRESETS = [
  { labelKey: 'admin.providerDrawer.preset7', days: 7 },
  { labelKey: 'admin.providerDrawer.preset30', days: 30 },
  { labelKey: 'admin.providerDrawer.preset90', days: 90 },
];

/**
 * Mobile (< md) filter, date range, sort, and CSV export bottom drawer.
 */
export default function ProviderFilterDrawer({
  open,
  onOpenChange,
  filter,
  onFilterChange,
  startDate,
  endDate,
  onDateChange,
  sortKey,
  sortDir,
  onSortChange,
  onSortDirChange,
  onResetAll,
  onExport,
}) {
  const { t, translateStatus } = useLanguage();
  useBodyScrollLock(open);

  const handlePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onDateChange({ start: toLocalDateKey(start), end: toLocalDateKey(end) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <div className="px-5 pt-3 pb-3.5 border-b border-surface-border text-left space-y-1">
          <div
            className="mx-auto mb-2.5 h-1.5 w-11 rounded-full bg-slate-300/90 dark:bg-slate-600/80 sm:hidden shrink-0"
            aria-hidden="true"
          />
          <SheetTitle className="font-display font-black text-ink dark:text-txt-darkPrimary">
            {t('admin.providerDrawer.title')}
          </SheetTitle>
          <SheetDescription>
            {t('admin.providerDrawer.description')}
          </SheetDescription>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Status Filter */}
          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-tertiary">{t('admin.providerDrawer.statusLabel')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.providerDrawer.statusAria')}>
              {STATUS_OPTIONS.map((statusOption) => {
                const isSelected = filter === statusOption;
                return (
                  <button
                    key={statusOption}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onFilterChange(statusOption)}
                    className={`min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'neu-btn-primary text-white dark:text-neu-fg'
                        : 'neu-btn text-ink dark:text-txt-darkPrimary'
                    }`}
                  >
                    {statusOption === 'All' ? t('admin.providerDrawer.statusAll') : translateStatus(statusOption)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-tertiary">
                {t('admin.providerDrawer.joinedRangeLabel')}
              </p>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => onDateChange({ start: '', end: '' })}
                  className="min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-danger dark:text-danger-dark hover:underline"
                >
                  {t('admin.providerDrawer.presetClear')}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => handlePreset(preset.days)}
                  className="neu-btn min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary"
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label
                  htmlFor="mobile-filter-start-date"
                  className="block text-xs font-bold text-tertiary"
                >
                  {t('admin.providerDrawer.fromDate')}
                </label>
                <input
                  id="mobile-filter-start-date"
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => onDateChange({ start: e.target.value, end: endDate || '' })}
                  className="w-full border border-surface-border bg-surface-subtle/50 min-h-[2.75rem] rounded-xl px-3 text-base sm:text-xs font-semibold text-ink dark:text-txt-darkPrimary outline-none"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="mobile-filter-end-date"
                  className="block text-xs font-bold text-tertiary"
                >
                  {t('admin.providerDrawer.toDate')}
                </label>
                <input
                  id="mobile-filter-end-date"
                  type="date"
                  value={endDate || ''}
                  onChange={(e) => onDateChange({ start: startDate || '', end: e.target.value })}
                  className="w-full border border-surface-border bg-surface-subtle/50 min-h-[2.75rem] rounded-xl px-3 text-base sm:text-xs font-semibold text-ink dark:text-txt-darkPrimary outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-2.5">
            <label
              htmlFor="mobile-sort-by"
              className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
            >
              {t('admin.providerDrawer.sortByLabel')}
            </label>
            <select
              id="mobile-sort-by"
              value={sortKey}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full border border-surface-border bg-surface-subtle/50 min-h-[2.75rem] rounded-xl px-3.5 text-base sm:text-sm font-bold text-ink dark:text-txt-darkPrimary outline-none"
            >
              {SORT_OPTION_KEYS.map((option) => (
                <option key={option.value || 'default'} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>

            {sortKey && (
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('admin.providerDrawer.sortDirectionAria')}>
                <button
                  type="button"
                  aria-pressed={sortDir === 'asc'}
                  onClick={() => onSortDirChange('asc')}
                  className={`min-h-[2.75rem] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                    sortDir === 'asc'
                      ? 'neu-btn-primary text-white dark:text-neu-fg'
                      : 'neu-btn text-ink dark:text-txt-darkPrimary'
                  }`}
                >
                  <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('admin.providerDrawer.ascBtn')}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={sortDir === 'desc'}
                  onClick={() => onSortDirChange('desc')}
                  className={`min-h-[2.75rem] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                    sortDir === 'desc'
                      ? 'neu-btn-primary text-white dark:text-neu-fg'
                      : 'neu-btn text-ink dark:text-txt-darkPrimary'
                  }`}
                >
                  <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('admin.providerDrawer.descBtn')}</span>
                </button>
              </div>
            )}
          </div>

        </div>

        <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-surface-border space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onResetAll}
              className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('admin.providerDrawer.resetBtn')}</span>
            </button>
            <button
              type="button"
              onClick={onExport}
              className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 hover:text-link"
            >
              <DownloadSimple className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('admin.providerDrawer.exportBtn')}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full neu-btn-primary min-h-[2.75rem] px-5 rounded-xl text-xs font-black flex items-center justify-center"
          >
            {t('admin.providerDrawer.done')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
