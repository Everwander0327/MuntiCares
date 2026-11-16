import { Link } from 'react-router-dom';
import { Star, ArrowRight, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { getInitials } from '../utils/dashboardMetrics';
import StatusBadge from './StatusBadge';

const PRESET_OPTIONS = [
  { key: '30D', labelKey: 'admin.sheet.preset30d' },
  { key: '6M', labelKey: 'admin.sheet.preset6m' },
  { key: 'ALL', labelKey: 'admin.sheet.presetAll' },
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
  const { t, translateService } = useLanguage();
  const isOpen = Boolean(sheet);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        className="px-5 pb-6 pt-0 sm:pt-2 sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:max-w-md sm:mx-auto sm:rounded-3xl bg-surface dark:bg-surface-dark border border-surface-border shadow-card"
      >
        <div
          className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-surface-border sm:hidden"
          aria-hidden="true"
        />

        {sheet?.type === 'filter' && (
          <>
            <SheetHeader className="px-1 pt-4 pb-3.5 text-left ring-0 border-b border-surface-border">
              <SheetTitle className="font-display text-lg font-extrabold text-ink dark:text-txt-darkPrimary">
                {t('admin.sheet.filterTitle')}
              </SheetTitle>
              <SheetDescription className="text-xs text-tertiary">
                {t('admin.sheet.filterDesc')}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-1 pt-4">
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
                      className={`min-h-[2.75rem] px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-95 ${
                        isActive
                          ? 'neu-btn-primary text-white dark:text-neu-fg'
                          : 'bg-surface-subtle border border-surface-border text-ink dark:text-txt-darkPrimary hover:text-link'
                      }`}
                    >
                      {t(preset.labelKey)}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2.5 pt-2 border-t border-surface-border/70">
                <p className="text-xs font-extrabold text-tertiary">
                  {t('admin.sheet.customRangeLabel')}
                </p>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  <label className="space-y-1 text-xs font-bold text-tertiary">
                    <span>{t('admin.sheet.fromLabel')}</span>
                    <input
                      type="date"
                      aria-label={t('admin.sheet.startDateAria')}
                      value={startDate || ''}
                      onChange={(e) => onChangeRange({ start: e.target.value, end: endDate || '' })}
                      className="w-full min-h-[2.75rem] px-3 rounded-xl border border-surface-border bg-surface-subtle/50 text-xs font-semibold text-ink dark:text-txt-darkPrimary outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-tertiary">
                    <span>{t('admin.sheet.toLabel')}</span>
                    <input
                      type="date"
                      aria-label={t('admin.sheet.endDateAria')}
                      value={endDate || ''}
                      onChange={(e) => onChangeRange({ start: startDate || '', end: e.target.value })}
                      className="w-full min-h-[2.75rem] px-3 rounded-xl border border-surface-border bg-surface-subtle/50 text-xs font-semibold text-ink dark:text-txt-darkPrimary outline-none"
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
                  className="w-full min-h-[2.75rem] neu-btn rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold text-danger dark:text-danger-dark cursor-pointer"
                >
                  <ArrowCounterClockwise className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('admin.sheet.clearDateFilter')}
                </button>
              )}
            </div>
          </>
        )}

        {sheet?.type === 'request' && sheet.item && (
          <>
            <SheetHeader className="px-1 pt-4 pb-3.5 text-left ring-0 border-b border-surface-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-primary-soft dark:bg-primary-800/70 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                    {getInitials(sheet.item.user)}
                  </span>
                  <div className="min-w-0">
                    <SheetTitle className="font-display text-base sm:text-lg font-extrabold text-ink dark:text-txt-darkPrimary truncate">
                      {sheet.item.user}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-tertiary truncate">
                      {t('admin.sheet.requestedOn', { date: sheet.item.date })}
                    </SheetDescription>
                  </div>
                </div>
                <StatusBadge status={sheet.item.status} className="shrink-0 pt-0.5" />
              </div>
            </SheetHeader>

            <div className="px-1 pt-2 space-y-4">
              <dl className="divide-y divide-surface-border/70 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-tertiary font-semibold">{t('admin.sheet.service')}</dt>
                  <dd className="font-bold text-ink dark:text-txt-darkPrimary text-right">
                    {sheet.item.service ? translateService(sheet.item.service) : t('admin.sheet.generalHealthcare')}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-tertiary font-semibold">{t('admin.sheet.scheduled')}</dt>
                  <dd className="font-bold text-ink dark:text-txt-darkPrimary tabular-nums text-right">
                    {sheet.item.scheduledLabel || sheet.item.date}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-tertiary font-semibold">{t('admin.sheet.assignedProvider')}</dt>
                  <dd className="font-bold text-ink dark:text-txt-darkPrimary text-right">
                    {sheet.item.providerName || t('admin.sheet.unassigned')}
                  </dd>
                </div>
                {sheet.item.notes && (
                  <div className="py-2.5 space-y-1">
                    <dt className="text-tertiary font-semibold">{t('admin.sheet.careNotes')}</dt>
                    <dd className="text-txt-secondary dark:text-txt-darkSecondary leading-relaxed">
                      {sheet.item.notes}
                    </dd>
                  </div>
                )}
              </dl>

              <Link
                to="/admin/requests"
                onClick={onClose}
                className="w-full min-h-[2.75rem] neu-btn-primary rounded-2xl flex items-center justify-center gap-2 text-xs font-extrabold text-white dark:text-neu-fg"
              >
                {t('admin.sheet.openRequestsManager')}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </>
        )}

        {sheet?.type === 'provider' && sheet.item && (
          <>
            <SheetHeader className="px-1 pt-4 pb-3.5 text-left ring-0 border-b border-surface-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-primary-soft dark:bg-primary-800/70 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                    {getInitials(sheet.item.name)}
                  </span>
                  <div className="min-w-0">
                    <SheetTitle className="font-display text-base sm:text-lg font-extrabold text-ink dark:text-txt-darkPrimary truncate">
                      {sheet.item.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-tertiary">
                      {t('admin.sheet.approvedProvider')}
                    </SheetDescription>
                  </div>
                </div>
                {Number(sheet.item.rating || 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 text-warning dark:text-warning-dark font-extrabold text-xs shrink-0 tabular-nums pt-0.5">
                    <Star weight="fill" className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    {Number(sheet.item.rating).toFixed(1)}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-tertiary shrink-0 pt-0.5">
                    {t('admin.sheet.noReviews')}
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="px-1 pt-2 space-y-4">
              <div className="divide-y divide-surface-border/70 text-xs">
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-tertiary">{t('admin.sheet.trustScore')}</span>
                    <strong className="tabular-nums text-ink dark:text-txt-darkPrimary">
                      {sheet.item.trust_score || 0}/100
                    </strong>
                  </div>
                  <div className="h-2 rounded-full bg-surface-border/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary dark:bg-primary-400"
                      style={{ width: `${Math.min(100, Math.max(0, Number(sheet.item.trust_score) || 0))}%` }}
                    />
                  </div>
                </div>

                <div className="py-3 space-y-1">
                  <span className="font-semibold text-tertiary block">{t('admin.sheet.specialties')}</span>
                  <p className="font-semibold text-ink dark:text-txt-darkPrimary leading-relaxed">
                    {(sheet.item.services?.length
                      ? sheet.item.services.map((s) => translateService(s))
                      : [t('admin.sheet.generalHealthcare')]
                    ).join(', ')}
                  </p>
                </div>
              </div>

              <Link
                to="/admin/providers"
                onClick={onClose}
                className="w-full min-h-[2.75rem] neu-btn-primary rounded-2xl flex items-center justify-center gap-2 text-xs font-extrabold text-white dark:text-neu-fg"
              >
                {t('admin.sheet.manageProviders')}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default DashboardDetailSheet;
