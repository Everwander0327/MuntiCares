import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlass,
  Sun,
  Moon,
  SlidersHorizontal,
  Bell,
  ShieldCheck,
  SpeakerHigh,
  SpeakerSlash,
  FileCode,
  ArrowSquareOut,
  Check,
  Sparkle,
  CalendarDots,
  UserCheck,
  Warning,
  Globe,
  X,
  TextAa,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { isSoundEnabled, setSoundEnabled, playToastSound } from '@/lib/audio';
import PatientConsent from '@/features/patient/pages/Consent';

const COOKIE_STORAGE_KEY = 'mc_cookie_consent';

const SECTION_DEFS = [
  {
    id: 'appearance',
    labelKey: 'settings.sections.appearance.label',
    shortKey: 'settings.sections.appearance.short',
    icon: Sun,
    keywordsKey: 'settings.sections.appearance.keywords',
  },
  {
    id: 'personalization',
    labelKey: 'settings.sections.personalization.label',
    shortKey: 'settings.sections.personalization.short',
    icon: SlidersHorizontal,
    keywordsKey: 'settings.sections.personalization.keywords',
  },
  {
    id: 'notifications',
    labelKey: 'settings.sections.notifications.label',
    shortKey: 'settings.sections.notifications.short',
    icon: Bell,
    keywordsKey: 'settings.sections.notifications.keywords',
  },
  {
    id: 'privacy',
    labelKey: 'settings.sections.privacy.label',
    shortKey: 'settings.sections.privacy.short',
    icon: ShieldCheck,
    keywordsKey: 'settings.sections.privacy.keywords',
  },
];

const DISPLAY_PRESET_KEY_MAP = {
  'extra-compact': 'settings.appearance.preset.extraCompact',
  compact: 'settings.appearance.preset.compact',
  standard: 'settings.appearance.preset.standard',
  large: 'settings.appearance.preset.large',
};

const SettingsSwitch = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={onChange}
    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
      checked
        ? 'bg-primary text-white'
        : 'neu-inset bg-slate-200/70 dark:bg-surface-darkAlt'
    }`}
  >
    <span
      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
        checked ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

const SettingRow = ({ title, description, children, isLast = false }) => (
  <div
    className={`py-5 sm:py-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start ${
      isLast ? '' : 'border-b border-slate-200/70 dark:border-white/10'
    }`}
  >
    <div className="md:col-span-5 space-y-1">
      <h3 className="font-bold text-sm sm:text-base text-ink dark:text-white">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-tertiary leading-relaxed">{description}</p>
      )}
    </div>
    <div className="md:col-span-7 flex flex-col items-stretch sm:items-start gap-3">
      {children}
    </div>
  </div>
);

const SettingsPage = () => {
  const { user } = useAuth();
  const currentRole = user?.role || 'patient';
  const { language, setLanguage, t } = useLanguage();
  const {
    dark,
    setThemeMode,
    colorTheme,
    setColorTheme,
    colorThemes,
    reducedMotion,
    setReducedMotion,
    uiScalePreset,
    resolvedUiScalePreset,
    isMobileViewport,
    setUiScale,
    uiScalePresets,
  } = useTheme();
  const activeColorMeta = useMemo(
    () => colorThemes.find((palette) => palette.id === colorTheme) || colorThemes[0],
    [colorThemes, colorTheme]
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  const sections = useMemo(
    () =>
      SECTION_DEFS.map((sec) => ({
        ...sec,
        label: t(sec.labelKey),
        shortLabel: t(sec.shortKey),
        keywords: t(sec.keywordsKey),
      })),
    [t]
  );

  const tabParam = searchParams.get('tab');
  const activeSection = useMemo(() => {
    const valid = sections.some((s) => s.id === tabParam);
    return valid ? tabParam : 'appearance';
  }, [tabParam, sections]);

  const setActiveSection = (sectionId) => {
    if (sectionId === 'appearance') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: sectionId }, { replace: true });
    }
  };

  // Audio preference
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  // Cookie preference
  const [cookieAccepted, setCookieAccepted] = useState(() => {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(COOKIE_STORAGE_KEY) === 'accepted'
        : false;
    } catch {
      return false;
    }
  });

  // Browser notification permission
  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'unsupported';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(window.Notification.permission);
    }
  }, [activeSection]);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.keywords.toLowerCase().includes(q)
    );
  }, [searchQuery, sections]);

  // If search filters out the active section, auto-select the first match
  useEffect(() => {
    if (
      searchQuery.trim() &&
      filteredSections.length > 0 &&
      !filteredSections.some((s) => s.id === activeSection)
    ) {
      setActiveSection(filteredSections[0].id);
    }
  }, [searchQuery, filteredSections, activeSection]);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      playToastSound('success');
      toast.success(t('settings.notifications.soundOnToast'));
    } else {
      toast.success(t('settings.notifications.soundOffToast'));
    }
  };

  const handleToggleCookieConsent = () => {
    const next = !cookieAccepted;
    setCookieAccepted(next);
    try {
      if (typeof localStorage !== 'undefined') {
        if (next) {
          localStorage.setItem(COOKIE_STORAGE_KEY, 'accepted');
        } else {
          localStorage.removeItem(COOKIE_STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
    toast.success(
      next
        ? t('settings.personalization.storageSavedToast')
        : t('settings.personalization.storageResetToast')
    );
  };

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error(t('settings.notifications.unsupportedToast'));
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        toast.success(t('settings.notifications.enabledToast'));
      } else if (result === 'denied') {
        toast.error(t('settings.notifications.blockedToast'));
      }
    } catch {
      toast.error(t('settings.notifications.errorToast'));
    }
  };

  const currentSectionMeta = sections.find((s) => s.id === activeSection) || sections[0];
  const notifPermLabel = t(`settings.notifications.perm.${notifPermission}`, notifPermission);

  return (
    <DashboardLayout role={currentRole}>
      <div className="w-full max-w-full pb-12">
        {/* Split-Pane Settings Container */}
        <div className="neu-flat rounded-[2rem] overflow-hidden border border-slate-200/70 dark:border-white/10 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100dvh-8.5rem)]">
          {/* Left Rail: Title, Search, and Section Nav */}
          <aside className="lg:col-span-3 xl:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-200/70 dark:border-white/10 p-4 sm:p-6 flex flex-col gap-5 bg-surface-shell/60 dark:bg-surface-darkAlt/50">
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display font-extrabold tracking-tight text-xl sm:text-2xl text-ink dark:text-white">
                {t('settings.title')}
              </h1>
              <Link
                to={`/${currentRole}/profile`}
                className="lg:hidden neu-btn px-3 py-2 min-h-[2.5rem] rounded-xl text-xs font-bold text-link inline-flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                {t('settings.profileMobile')}
              </Link>
            </div>

            {/* Search Setting Input */}
            <div className="neu-inset rounded-xl px-3 h-11 flex items-center gap-2.5">
              <MagnifyingGlass className="w-4 h-4 text-tertiary shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('settings.searchPlaceholder')}
                aria-label={t('settings.searchAria')}
                className="w-full bg-transparent text-sm text-ink dark:text-white placeholder:text-tertiary focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('settings.searchClearAria')}
                  className="text-tertiary hover:text-ink dark:hover:text-white cursor-pointer p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Section List (Horizontal scroll on mobile, vertical rail on desktop) */}
            <nav
              aria-label={t('settings.navAria')}
              className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible no-scrollbar pb-1 lg:pb-0"
            >
              {filteredSections.length === 0 ? (
                <p className="text-xs text-tertiary px-2 py-3">
                  {t('settings.noMatches')}
                </p>
              ) : (
                filteredSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[2.75rem] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap lg:whitespace-normal text-left transition-all cursor-pointer shrink-0 lg:w-full ${
                        isActive
                          ? 'neu-btn-primary font-bold shadow-sm'
                          : 'text-txt-secondary dark:text-txt-darkSecondary hover:bg-primary/8 dark:hover:bg-white/5 hover:text-ink dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{section.label}</span>
                    </button>
                  );
                })
              )}
            </nav>

            {/* Desktop Footer Profile Shortcut */}
            <div className="hidden lg:block mt-auto pt-4 border-t border-slate-200/70 dark:border-white/10">
              <Link
                to={`/${currentRole}/profile`}
                className="neu-btn w-full px-3.5 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-link inline-flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                {t('settings.editAccountProfile')}
              </Link>
            </div>
          </aside>

          {/* Right Pane: Active Section Content */}
          <div className="lg:col-span-9 xl:col-span-9 p-5 sm:p-8 lg:p-10 min-w-0">
            <div className="pb-5 border-b border-slate-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-extrabold text-xl sm:text-2xl text-ink dark:text-white">
                  {currentSectionMeta.label}
                </h2>
                <p className="text-xs sm:text-sm text-tertiary mt-0.5">
                  {t('settings.subtitle')}
                </p>
              </div>
            </div>

            {/* Section 1: General & Appearance */}
            {activeSection === 'appearance' && (
              <div role="region" aria-label={t('settings.appearance.ariaRegion')}>
                <SettingRow
                  title={t('settings.appearance.themeTitle')}
                  description={t('settings.appearance.themeDesc')}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                    <button
                      type="button"
                      onClick={() => setThemeMode('light')}
                      aria-pressed={!dark}
                      className={`text-left p-4 rounded-2xl transition-all cursor-pointer min-h-[2.75rem] flex flex-col gap-3 ${
                        !dark
                          ? 'neu-flat ring-2 ring-primary'
                          : 'neu-inset opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div
                        className="w-full h-16 rounded-xl border p-2.5 flex flex-col justify-between"
                        style={{
                          backgroundColor: activeColorMeta.light.page,
                          borderColor: activeColorMeta.light.border,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="h-2 w-14 rounded-full"
                            style={{ backgroundColor: activeColorMeta.light.card }}
                          />
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: activeColorMeta.light.primary }}
                          />
                        </div>
                        <span
                          className="block h-2 w-2/3 rounded-full"
                          style={{ backgroundColor: activeColorMeta.light.border }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4 text-warning" aria-hidden="true" />
                          <span className="font-bold text-sm text-ink dark:text-txt-darkPrimary">{t('settings.appearance.lightMode')}</span>
                        </div>
                        {!dark && (
                          <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                            <Check className="w-3 h-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemeMode('dark')}
                      aria-pressed={dark}
                      className={`text-left p-4 rounded-2xl transition-all cursor-pointer min-h-[2.75rem] flex flex-col gap-3 ${
                        dark
                          ? 'neu-flat ring-2 ring-primary'
                          : 'neu-inset opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div
                        className="w-full h-16 rounded-xl border p-2.5 flex flex-col justify-between"
                        style={{
                          backgroundColor: activeColorMeta.dark.page,
                          borderColor: activeColorMeta.dark.border,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="h-2 w-14 rounded-full"
                            style={{ backgroundColor: activeColorMeta.dark.card }}
                          />
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: activeColorMeta.dark.primary }}
                          />
                        </div>
                        <span
                          className="block h-2 w-2/3 rounded-full"
                          style={{ backgroundColor: activeColorMeta.dark.border }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Moon className="w-4 h-4 text-link" aria-hidden="true" />
                          <span className="font-bold text-sm text-ink dark:text-txt-darkPrimary">{t('settings.appearance.darkMode')}</span>
                        </div>
                        {dark && (
                          <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                            <Check className="w-3 h-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                </SettingRow>

                <SettingRow
                  title={t('settings.appearance.paletteTitle')}
                  description={t('settings.appearance.paletteDesc')}
                >
                  <div className="w-full space-y-3">
                    <div
                      className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5 w-full"
                      role="group"
                      aria-label={t('settings.appearance.paletteGroupAria')}
                    >
                      {colorThemes.map((palette) => {
                        const isSelected = colorTheme === palette.id;
                        const swatch = dark ? palette.dark : palette.light;
                        return (
                          <button
                            key={palette.id}
                            type="button"
                            onClick={() => {
                              setColorTheme(palette.id);
                              toast.success(
                                t('settings.appearance.paletteToast', { label: palette.label })
                              );
                            }}
                            aria-pressed={isSelected}
                            className={`text-left p-3 rounded-2xl transition-all cursor-pointer min-h-[2.75rem] flex flex-col justify-between gap-2.5 ${
                              isSelected
                                ? 'neu-flat ring-2 ring-primary'
                                : 'neu-inset opacity-85 hover:opacity-100'
                            }`}
                          >
                            <div
                              className="w-full h-11 rounded-xl border p-2 flex items-center justify-between gap-2"
                              style={{
                                backgroundColor: swatch.page,
                                borderColor: swatch.border,
                              }}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-5 h-5 rounded-lg border shrink-0"
                                  style={{
                                    backgroundColor: swatch.card,
                                    borderColor: swatch.border,
                                  }}
                                />
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0"
                                  style={{ backgroundColor: swatch.primary }}
                                />
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: swatch.accent }}
                                />
                              </div>
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                                  <Check className="w-2.5 h-2.5" aria-hidden="true" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                              <span className="font-bold text-xs text-ink dark:text-txt-darkPrimary truncate">
                                {palette.label}
                              </span>
                              {palette.id === 'trust-blue' && (
                                <span className="px-1.5 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider bg-primary/10 text-link shrink-0">
                                  {t('settings.appearance.paletteDefaultBadge')}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {colorTheme !== 'trust-blue' && (
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setColorTheme('trust-blue');
                            toast.success(t('settings.appearance.paletteResetToast'));
                          }}
                          className="neu-btn px-3 py-1.5 min-h-[2.25rem] rounded-xl text-xs font-bold text-link inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <ArrowCounterClockwise className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{t('settings.appearance.paletteResetDefault')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </SettingRow>

                <SettingRow
                  title={t('settings.appearance.displayTitle')}
                  description={t('settings.appearance.displayDesc')}
                >
                  <div className="w-full space-y-3">
                    <div
                      className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full"
                      role="group"
                      aria-label={t('settings.appearance.displayGroupAria')}
                    >
                      {uiScalePresets.map((preset) => {
                        const isSelected = resolvedUiScalePreset === preset.id;
                        const presetLabel = t(DISPLAY_PRESET_KEY_MAP[preset.id] || preset.label, preset.label);
                        const barWidth =
                          preset.id === 'extra-compact'
                            ? 'w-1/2'
                            : preset.id === 'compact'
                            ? 'w-2/3'
                            : preset.id === 'standard'
                            ? 'w-4/5'
                            : 'w-full';
                        const previewHeight =
                          preset.id === 'extra-compact'
                            ? 'h-1.5'
                            : preset.id === 'compact'
                            ? 'h-2'
                            : preset.id === 'standard'
                            ? 'h-2.5'
                            : 'h-3';

                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setUiScale(preset.id);
                              toast.success(
                                t('settings.appearance.displayToast', {
                                  label: presetLabel,
                                  percentage: preset.percentage,
                                })
                              );
                            }}
                            aria-pressed={isSelected}
                            className={`text-left p-3 rounded-2xl transition-all cursor-pointer min-h-[2.75rem] flex flex-col justify-between gap-2.5 ${
                              isSelected
                                ? 'neu-flat ring-2 ring-primary'
                                : 'neu-inset opacity-85 hover:opacity-100'
                            }`}
                          >
                            <div className="w-full h-11 rounded-xl bg-surface-page border border-surface-border p-2 flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className={`${previewHeight} ${barWidth} rounded-full bg-primary/70 dark:bg-primary-400/80`} />
                                {isSelected && (
                                  <span className="w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5" aria-hidden="true" />
                                  </span>
                                )}
                              </div>
                              <span className="block h-1.5 w-3/4 rounded-full bg-slate-300 dark:bg-slate-700" />
                            </div>
                            <div className="min-w-0">
                              <span className="block font-bold text-xs text-ink dark:text-white truncate">
                                {presetLabel}
                              </span>
                              <span className="block text-[0.6875rem] font-bold text-link tabular-nums mt-0.5">
                                {preset.percentage}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-tertiary">
                        <TextAa className="w-3.5 h-3.5 text-link shrink-0" />
                        <span>
                          {uiScalePreset === 'auto'
                            ? isMobileViewport
                              ? t('settings.appearance.autoCompact')
                              : t('settings.appearance.autoStandard')
                            : t('settings.appearance.customPinned', {
                                percentage: uiScalePresets.find((p) => p.id === resolvedUiScalePreset)?.percentage || '100%',
                              })}
                        </span>
                      </div>
                      {uiScalePreset !== 'auto' && (
                        <button
                          type="button"
                          onClick={() => {
                            setUiScale('auto');
                            toast.success(t('settings.appearance.resetAutoToast'));
                          }}
                          className="neu-btn px-3 py-1.5 min-h-[2.25rem] rounded-xl text-xs font-bold text-link inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowCounterClockwise className="w-3.5 h-3.5" />
                          {t('settings.appearance.resetAuto')}
                        </button>
                      )}
                    </div>
                  </div>
                </SettingRow>

                <SettingRow
                  title={t('settings.appearance.motionTitle')}
                  description={t('settings.appearance.motionDesc')}
                >
                  <div className="flex items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-2.5 text-sm font-medium text-tertiary">
                      <Sparkle className="w-4 h-4 text-link" />
                      <span>
                        {reducedMotion ? t('settings.appearance.motionOn') : t('settings.appearance.motionOff')}
                      </span>
                    </div>
                    <SettingsSwitch
                      checked={reducedMotion}
                      onChange={() => {
                        const next = !reducedMotion;
                        setReducedMotion(next);
                        toast.success(
                          next
                            ? t('settings.appearance.motionEnabledToast')
                            : t('settings.appearance.motionRestoredToast')
                        );
                      }}
                      ariaLabel={t('settings.appearance.motionAria')}
                    />
                  </div>
                </SettingRow>

                <SettingRow
                  title={t('settings.appearance.languageTitle')}
                  description={t('settings.appearance.languageDesc')}
                  isLast
                >
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full"
                    role="group"
                    aria-label={t('settings.appearance.languageGroupAria')}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('en');
                        toast.success(t('settings.appearance.langSwitchedEn'));
                      }}
                      aria-pressed={language === 'en'}
                      className={`text-left p-4 rounded-2xl transition-all cursor-pointer min-h-[2.75rem] flex items-center justify-between gap-3 ${
                        language === 'en'
                          ? 'neu-flat ring-2 ring-primary'
                          : 'neu-inset opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-link flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-ink dark:text-white truncate">
                            {t('settings.appearance.langEnglish')}
                          </p>
                          <p className="text-xs text-tertiary truncate">
                            {t('settings.appearance.langEnglishSub')}
                          </p>
                        </div>
                      </div>
                      {language === 'en' && (
                        <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('tl');
                        toast.success(t('settings.appearance.langSwitchedTl'));
                      }}
                      aria-pressed={language === 'tl'}
                      className={`text-left p-4 rounded-2xl transition-all cursor-pointer min-h-[2.75rem] flex items-center justify-between gap-3 ${
                        language === 'tl'
                          ? 'neu-flat ring-2 ring-primary'
                          : 'neu-inset opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-link flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-ink dark:text-white truncate">
                            {t('settings.appearance.langTagalog')}
                          </p>
                          <p className="text-xs text-tertiary truncate">
                            {t('settings.appearance.langTagalogSub')}
                          </p>
                        </div>
                      </div>
                      {language === 'tl' && (
                        <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  </div>
                </SettingRow>
              </div>
            )}

            {/* Section 2: Personalization & Consent */}
            {activeSection === 'personalization' && (
              <div role="region" aria-label={t('settings.personalization.ariaRegion')} className="space-y-6">
                {currentRole === 'patient' ? (
                  <>
                    <SettingRow
                      title={t('settings.personalization.storageTitle')}
                      description={t('settings.personalization.storageDesc')}
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="text-sm font-medium text-tertiary">
                          {cookieAccepted
                            ? t('settings.personalization.storageSaved')
                            : t('settings.personalization.storageDefault')}
                        </span>
                        <SettingsSwitch
                          checked={cookieAccepted}
                          onChange={handleToggleCookieConsent}
                          ariaLabel={t('settings.personalization.storageAria')}
                        />
                      </div>
                    </SettingRow>

                    <div className="pt-2">
                      <PatientConsent embedded={true} />
                    </div>
                  </>
                ) : currentRole === 'provider' ? (
                  <SettingRow
                    title={t('settings.personalization.providerTitle')}
                    description={t('settings.personalization.providerDesc')}
                    isLast
                  >
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to="/provider/schedule"
                        className="neu-btn px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-link inline-flex items-center gap-2"
                      >
                        <CalendarDots className="w-4 h-4" />
                        {t('settings.personalization.manageAvailability')}
                      </Link>
                      <Link
                        to="/provider/patients"
                        className="neu-btn px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-ink dark:text-white inline-flex items-center gap-2"
                      >
                        {t('settings.personalization.consentedPatients')}
                      </Link>
                    </div>
                  </SettingRow>
                ) : (
                  <SettingRow
                    title={t('settings.personalization.adminTitle')}
                    description={t('settings.personalization.adminDesc')}
                    isLast
                  >
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to="/admin/announcements"
                        className="neu-btn px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-link inline-flex items-center gap-2"
                      >
                        {t('settings.personalization.manageAnnouncements')}
                      </Link>
                      <Link
                        to="/admin/providers"
                        className="neu-btn px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-ink dark:text-white inline-flex items-center gap-2"
                      >
                        {t('settings.personalization.providerDirectory')}
                      </Link>
                    </div>
                  </SettingRow>
                )}
              </div>
            )}

            {/* Section 3: Notifications & Audio */}
            {activeSection === 'notifications' && (
              <div role="region" aria-label={t('settings.notifications.ariaRegion')}>
                <SettingRow
                  title={t('settings.notifications.soundTitle')}
                  description={t('settings.notifications.soundDesc')}
                >
                  <div className="flex items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-2.5 text-sm font-medium text-tertiary">
                      {soundOn ? (
                        <SpeakerHigh className="w-4 h-4 text-link" />
                      ) : (
                        <SpeakerSlash className="w-4 h-4" />
                      )}
                      <span>
                        {soundOn ? t('settings.notifications.soundOn') : t('settings.notifications.soundOff')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {soundOn && (
                        <button
                          type="button"
                          onClick={() => playToastSound('success')}
                          className="neu-btn px-3.5 py-2 min-h-[2.75rem] rounded-xl text-xs font-bold text-link cursor-pointer"
                        >
                          {t('settings.notifications.testSound')}
                        </button>
                      )}
                      <SettingsSwitch
                        checked={soundOn}
                        onChange={handleToggleSound}
                        ariaLabel={t('settings.notifications.soundAria')}
                      />
                    </div>
                  </div>
                </SettingRow>

                <SettingRow
                  title={t('settings.notifications.permTitle')}
                  description={t('settings.notifications.permDesc')}
                  isLast
                >
                  <div className="flex items-center justify-between w-full gap-4">
                    <span className="text-sm font-semibold text-ink dark:text-white">
                      {t('settings.notifications.statusPrefix')} {notifPermLabel}
                    </span>
                    {notifPermission === 'default' && (
                      <button
                        type="button"
                        onClick={handleRequestNotifications}
                        className="neu-btn-primary px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold cursor-pointer shrink-0"
                      >
                        {t('settings.notifications.enableAlerts')}
                      </button>
                    )}
                  </div>
                </SettingRow>
              </div>
            )}

            {/* Section 4: Data & Privacy */}
            {activeSection === 'privacy' && (
              <div role="region" aria-label={t('settings.privacy.ariaRegion')}>
                {currentRole === 'patient' && (
                  <SettingRow
                    title={t('settings.privacy.fhirTitle')}
                    description={t('settings.privacy.fhirDesc')}
                  >
                    <Link
                      to="/patient/profile"
                      className="neu-btn px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-link inline-flex items-center gap-2"
                    >
                      <FileCode className="w-4 h-4" />
                      {t('settings.privacy.openExport')}
                    </Link>
                  </SettingRow>
                )}

                <SettingRow
                  title={t('settings.privacy.ephemeralTitle')}
                  description={t('settings.privacy.ephemeralDesc')}
                >
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/privacy"
                      className="neu-btn px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-ink dark:text-white inline-flex items-center gap-2"
                    >
                      {t('settings.privacy.privacyPolicy')}
                      <ArrowSquareOut className="w-3.5 h-3.5 text-tertiary" />
                    </Link>
                    <Link
                      to="/terms"
                      className="neu-btn px-4 py-2.5 min-h-[2.75rem] rounded-xl text-xs font-bold text-ink dark:text-white inline-flex items-center gap-2"
                    >
                      {t('settings.privacy.termsOfService')}
                      <ArrowSquareOut className="w-3.5 h-3.5 text-tertiary" />
                    </Link>
                  </div>
                </SettingRow>

                <SettingRow
                  title={t('settings.privacy.emergencyTitle')}
                  description={t('settings.privacy.emergencyDesc')}
                  isLast
                >
                  <div className="neu-inset rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-tertiary leading-relaxed w-full">
                    <Warning className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      {t('settings.privacy.emergencyTextBefore')}{' '}
                      <strong className="text-ink dark:text-white">911</strong>{' '}
                      {t('settings.privacy.emergencyTextAfter')}
                    </span>
                  </div>
                </SettingRow>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
