import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CalendarDots, Megaphone, Sparkle, ArrowUpRight } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { isExternalEventLink, formatEventDateLabel } from '@/features/admin/utils/recentEvents';
import { useLanguage } from '@/contexts/LanguageContext';

const getAudienceText = (targetAudience, t) => {
  const key = (targetAudience || 'all').toLowerCase();
  if (key === 'patients' || key === 'patient') return t('updates.audiencePatients');
  if (key === 'providers' || key === 'provider') return t('updates.audienceProviders');
  return t('updates.audienceAll');
};

const formatUpdateDate = (dateStr, formatDate) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return formatDate(date, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const WeeklyUpdatesModal = ({
  open,
  onOpenChange,
  events = [],
  announcements = [],
  loading = false,
  onDontShowAgain,
  onNavigate,
}) => {
  const { t, formatDate } = useLanguage();
  useBodyScrollLock(open);
  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose: () => onOpenChange(false),
    disabled: loading,
  });

  const hasContent = events.length > 0 || announcements.length > 0;
  const hasBoth = events.length > 0 && announcements.length > 0;

  const handleEventClick = (eventLink) => {
    if (!eventLink) return;
    if (isExternalEventLink(eventLink)) {
      window.open(eventLink, '_blank', 'noopener,noreferrer');
    } else {
      onOpenChange(false);
      onNavigate?.(eventLink);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-slate-950/75 md:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-modal="true"
            aria-label={t('updates.ariaModal')}
            asChild
          >
            <motion.div
              className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-6 lg:p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              onClick={() => onOpenChange(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                {...drawerMotionProps}
                className="neu-flat bg-surface-shell w-full sm:max-w-4xl lg:max-w-5xl rounded-t-[1.5rem] sm:rounded-[2rem] min-h-[72dvh] sm:min-h-0 max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border-t sm:border border-surface-border pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                {/* Header */}
                <div
                  className="px-4 sm:px-8 pt-3.5 sm:pt-6 pb-3.5 sm:pb-5 border-b border-surface-border/70 dark:border-white/10 shrink-0 cursor-grab sm:cursor-auto"
                  {...dragHandleProps}
                >
                  <div
                    className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden"
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <DialogPrimitive.Title asChild>
                        <h2 className="font-display font-black text-xl sm:text-2xl lg:text-[1.75rem] text-ink dark:text-white tracking-tight">
                          {t('updates.title')}
                        </h2>
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description className="text-xs sm:text-sm text-tertiary mt-1">
                        {t('updates.subtitle')}
                      </DialogPrimitive.Description>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 py-4 sm:py-6">
                  {loading ? (
                    <div className="py-16 text-center text-sm sm:text-base font-semibold text-tertiary" role="status">
                      {t('updates.loading')}
                    </div>
                  ) : !hasContent ? (
                    <div className="py-16 text-center space-y-3">
                      <div className="neu-flat-sm w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-link">
                        <Sparkle className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <h3 className="font-display font-extrabold text-lg sm:text-xl text-ink dark:text-white">
                        {t('updates.emptyTitle')}
                      </h3>
                      <p className="text-sm text-tertiary max-w-md mx-auto leading-relaxed">
                        {t('updates.emptySubtitle')}
                      </p>
                    </div>
                  ) : (
                    <div className={hasBoth ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' : 'space-y-6'}>
                      {/* Recent Events Section */}
                      {events.length > 0 && (
                        <section
                          aria-label={t('updates.recentEventsAria')}
                          className={`space-y-3.5 ${hasBoth ? 'lg:col-span-7' : ''}`}
                        >
                          <div className="flex items-center gap-2 text-ink dark:text-white">
                            <CalendarDots className="w-4 h-4 sm:w-5 sm:h-5 text-link" aria-hidden="true" />
                            <h3 className="font-display font-extrabold text-base sm:text-lg">
                              {t('updates.recentEventsTitle', { count: events.length })}
                            </h3>
                          </div>

                          <div className="space-y-4">
                            {events.map((ev) => {
                              const hasLink = Boolean(ev.eventLink);
                              return (
                                <article
                                  key={ev.id}
                                  onClick={hasLink ? () => handleEventClick(ev.eventLink) : undefined}
                                  onKeyDown={
                                    hasLink
                                      ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleEventClick(ev.eventLink);
                                          }
                                        }
                                      : undefined
                                  }
                                  role={hasLink ? 'link' : undefined}
                                  tabIndex={hasLink ? 0 : undefined}
                                  aria-label={hasLink ? t('updates.openEventLinkAria', { title: ev.title }) : undefined}
                                  className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden border border-surface-border shadow-lg min-h-[14rem] sm:min-h-[22.5rem] lg:min-h-[25.625rem] flex flex-col justify-end bg-slate-900 ${
                                    hasLink
                                      ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                                      : ''
                                  }`}
                                >
                                  <img
                                    src={ev.eventImage}
                                    alt={ev.title}
                                    className={`absolute inset-0 w-full h-full object-cover ${
                                      hasLink ? 'transition-transform duration-500 group-hover:scale-[1.03]' : ''
                                    }`}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/90 via-45% to-transparent" />
                                  <div className="relative z-10 p-5 sm:p-7 space-y-2 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 sm:gap-4 min-w-0">
                                      <h4 className="font-display font-black text-xl sm:text-2xl lg:text-[1.75rem] text-white leading-tight line-clamp-2 min-w-0 [overflow-wrap:anywhere]">
                                        {ev.title}
                                      </h4>
                                      {(ev.eventDate || ev.created_at) && (
                                        <span className="text-xs font-semibold text-slate-300 shrink-0 tabular-nums">
                                          {ev.eventDate
                                            ? formatEventDateLabel(ev.eventDate)
                                            : formatUpdateDate(ev.created_at, formatDate)}
                                        </span>
                                      )}
                                    </div>
                                    {ev.cleanMessage && (
                                      <p className="text-sm sm:text-base text-slate-200/95 leading-relaxed line-clamp-3 max-w-2xl [overflow-wrap:anywhere]">
                                        {ev.cleanMessage}
                                      </p>
                                    )}
                                    {hasLink && (
                                      <div className="pt-1 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary-400 group-hover:text-white transition-colors">
                                        <span>
                                          {isExternalEventLink(ev.eventLink) ? t('updates.openLink') : t('updates.viewPage')}
                                        </span>
                                        <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                                      </div>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* Recent Announcements Section */}
                      {announcements.length > 0 && (
                        <section
                          aria-label={t('updates.announcementsAria')}
                          className={`space-y-3.5 ${hasBoth ? 'lg:col-span-5' : ''}`}
                        >
                          <div className="flex items-center gap-2 text-ink dark:text-white">
                            <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-link" aria-hidden="true" />
                            <h3 className="font-display font-extrabold text-base sm:text-lg">
                              {t('updates.announcementsTitle', { count: announcements.length })}
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {announcements.map((item) => (
                              <article
                                key={item.id}
                                className="neu-flat-sm rounded-2xl p-4 sm:p-5 border border-surface-border/70 dark:border-white/5 space-y-2 min-w-0"
                              >
                                <div className="flex items-start justify-between gap-3 min-w-0">
                                  <h4 className="font-bold text-sm sm:text-base text-ink dark:text-white leading-snug min-w-0 [overflow-wrap:anywhere]">
                                    {item.title}
                                  </h4>
                                  <div className="text-right shrink-0">
                                    {item.created_at && (
                                      <p className="text-xs font-semibold text-tertiary tabular-nums">
                                        {formatUpdateDate(item.created_at, formatDate)}
                                      </p>
                                    )}
                                    <p className="text-[0.6875rem] font-bold text-link mt-0.5">
                                      {getAudienceText(item.target_audience, t)}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-xs sm:text-sm text-txt-secondary dark:text-txt-darkSecondary leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                                  {item.cleanMessage}
                                </p>
                              </article>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 sm:px-8 pt-3.5 sm:pt-4 pb-1 border-t border-surface-border/70 dark:border-white/10 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                  {hasContent ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onDontShowAgain?.();
                          onOpenChange(false);
                        }}
                        className="neu-btn min-h-[2.75rem] sm:min-h-[3rem] px-5 rounded-xl text-sm font-bold text-txt-secondary dark:text-txt-darkSecondary hover:text-ink dark:hover:text-white cursor-pointer"
                      >
                        {t('common.actions.dontShowAgain')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="neu-btn-primary min-h-[2.75rem] sm:min-h-[3rem] px-7 rounded-xl text-sm font-extrabold text-white cursor-pointer"
                      >
                        {t('common.actions.gotIt')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="neu-btn-primary min-h-[2.75rem] sm:min-h-[3rem] px-7 rounded-xl text-sm font-extrabold text-white cursor-pointer sm:ml-auto"
                    >
                      {t('common.actions.close')}
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
};

export default WeeklyUpdatesModal;
