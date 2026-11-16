import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  User,
  Gear,
  SlidersHorizontal,
  FileText,
  ChatCircle,
  CalendarDots,
  Users,
  Megaphone,
  Briefcase,
  ShieldCheck,
  Lifebuoy,
  SignOut,
  CaretDown,
  Globe,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const ProfilePopover = ({ user, currentRole, onLogout }) => {
  const { language, setLanguage, t, translateRole } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const location = useLocation();

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleMouseEnter = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
      return;
    }
    clearTimers();
    openTimerRef.current = setTimeout(() => setOpen(true), 70);
  };

  const handleMouseLeave = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
      return;
    }
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), 180);
  };

  const roleShortcuts =
    currentRole === 'patient'
      ? [
          { icon: FileText, label: t('popover.myRequests'), to: '/patient/requests' },
          { icon: ChatCircle, label: t('popover.messages'), to: '/patient/messages' },
        ]
      : currentRole === 'provider'
      ? [
          { icon: CalendarDots, label: t('popover.mySchedule'), to: '/provider/schedule' },
          { icon: Users, label: t('popover.myPatients'), to: '/provider/patients' },
        ]
      : [
          { icon: Megaphone, label: t('popover.announcements'), to: '/admin/announcements' },
          { icon: Briefcase, label: t('popover.providers'), to: '/admin/providers' },
        ];

  const isSettingsRoute = location.pathname === `/${currentRole}/settings`;
  const activeTab = new URLSearchParams(location.search).get('tab') || 'appearance';
  const isPersonalizationActive = isSettingsRoute && activeTab === 'personalization';
  const isGeneralSettingsActive = isSettingsRoute && activeTab !== 'personalization';

  const rowClass = (active = false) =>
    `group flex items-center gap-3 w-full min-h-[2.75rem] px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
      active
        ? 'bg-primary/10 dark:bg-primary/15 text-link font-bold'
        : 'text-txt-primary dark:text-txt-darkPrimary hover:bg-primary/8 dark:hover:bg-white/5 hover:text-link dark:hover:text-link'
    }`;

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Profile Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('popover.triggerAria')}
        className="h-11 px-1 rounded-full flex items-center gap-1.5 text-link font-black shrink-0 hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 shrink-0">
          <div className="w-full h-full rounded-full bg-primary/10 dark:bg-white/10 flex items-center justify-center text-link font-black overflow-hidden ring-1 ring-slate-200/80 dark:ring-white/15">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover block" />
            ) : (
              <span className="text-xs font-black">{user.initials}</span>
            )}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-page dark:ring-surface-dark"
            aria-hidden="true"
          />
        </div>
        <CaretDown
          className={`hidden sm:block w-3.5 h-3.5 text-txt-secondary dark:text-txt-darkSecondary transition-transform duration-200 ${
            open ? 'rotate-180 text-link' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Hover Bridge + Elevated Popover Card */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full pt-2 w-[17.5rem] sm:w-[18.75rem] z-50"
          >
            <div
              role="menu"
              aria-label={t('popover.menuAria')}
              className="neu-flat bg-surface-shell dark:bg-surface-dark rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-2xl p-2 space-y-1.5"
            >
              {/* Identity Header */}
              <div className="flex items-center gap-3 px-2.5 py-2.5">
                <div className="relative w-10 h-10 shrink-0">
                  <div className="w-full h-full rounded-full neu-flat-sm flex items-center justify-center text-link font-black text-sm overflow-hidden ring-1 ring-white/60 dark:ring-white/10">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover block" />
                    ) : (
                      <span>{user.initials}</span>
                    )}
                  </div>
                  <span
                    className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface-shell dark:ring-surface-dark"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-extrabold text-sm text-txt-primary dark:text-txt-darkPrimary truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-txt-secondary dark:text-txt-darkSecondary truncate mt-0.5">
                    {user.email || translateRole(currentRole) || user.badge}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-lg text-[0.625rem] font-extrabold uppercase tracking-wider bg-primary/10 text-link shrink-0">
                  {translateRole(currentRole) || user.badge}
                </span>
              </div>

              <div className="border-t border-slate-200/70 dark:border-white/10 mx-1" />

              {/* Group 1: Profile, Settings, Personalization */}
              <div className="space-y-0.5">
                <Link
                  to={`/${currentRole}/profile`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={rowClass(location.pathname === `/${currentRole}/profile`)}
                >
                  <User className="w-4 h-4 shrink-0 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-link" />
                  <span className="flex-1 truncate">{t('popover.viewProfile')}</span>
                </Link>

                <Link
                  to={`/${currentRole}/settings`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={rowClass(isGeneralSettingsActive)}
                >
                  <Gear className="w-4 h-4 shrink-0 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-link" />
                  <span className="flex-1 truncate">{t('popover.settings')}</span>
                </Link>

                <Link
                  to={`/${currentRole}/settings?tab=personalization`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={rowClass(isPersonalizationActive)}
                >
                  <SlidersHorizontal className="w-4 h-4 shrink-0 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-link" />
                  <span className="flex-1 truncate">{t('popover.personalization')}</span>
                  {currentRole === 'patient' && (
                    <span className="text-[0.6875rem] font-bold text-link px-2 py-0.5 rounded-md bg-primary/10">
                      {t('popover.consentBadge')}
                    </span>
                  )}
                </Link>
              </div>

              <div className="border-t border-slate-200/70 dark:border-white/10 mx-1" />

              {/* Quick Language Switcher */}
              <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="flex items-center gap-2.5 text-xs font-bold text-txt-secondary dark:text-txt-darkSecondary">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>{t('popover.language')}</span>
                </span>
                <div className="neu-inset rounded-xl p-0.5 inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    aria-pressed={language === 'en'}
                    className={`px-2 py-1 rounded-lg text-[0.6875rem] font-extrabold transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-txt-secondary dark:text-txt-darkSecondary hover:text-ink dark:hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('tl')}
                    aria-pressed={language === 'tl'}
                    className={`px-2 py-1 rounded-lg text-[0.6875rem] font-extrabold transition-all cursor-pointer ${
                      language === 'tl'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-txt-secondary dark:text-txt-darkSecondary hover:text-ink dark:hover:text-white'
                    }`}
                  >
                    TL
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200/70 dark:border-white/10 mx-1" />

              {/* Group 2: Role Shortcuts */}
              <div className="space-y-0.5">
                {roleShortcuts.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={rowClass(active)}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-link" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="border-t border-slate-200/70 dark:border-white/10 mx-1" />

              {/* Group 3: Privacy & Help */}
              <div className="space-y-0.5">
                <Link
                  to="/privacy"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={rowClass(location.pathname === '/privacy')}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-link" />
                  <span className="flex-1 truncate">{t('popover.privacyTerms')}</span>
                </Link>
                <Link
                  to={`/${currentRole}/settings?tab=privacy`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={rowClass(isSettingsRoute && activeTab === 'privacy')}
                >
                  <Lifebuoy className="w-4 h-4 shrink-0 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-link" />
                  <span className="flex-1 truncate">{t('popover.helpData')}</span>
                </Link>
              </div>

              <div className="border-t border-slate-200/70 dark:border-white/10 mx-1" />

              {/* Group 4: Sign Out */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onLogout?.();
                }}
                className="group flex items-center gap-3 w-full min-h-[2.75rem] px-3 py-2 rounded-xl text-sm font-semibold text-txt-secondary dark:text-txt-darkSecondary hover:bg-rose-500/10 hover:text-[#BC3030] dark:hover:text-[#F4918B] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
              >
                <SignOut className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{t('popover.signOut')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePopover;
