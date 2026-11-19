import React, { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react';
import {
  MagnifyingGlass,
  X,
  Users,
  Briefcase,
  FileText,
  ChatCircle,
  CalendarDots,
  Megaphone,
  GearSix,
  ShieldCheck,
  User,
  Sun,
  Moon,
  Translate,
  Sparkle,
  SignOut,
  ClockCounterClockwise,
  SlidersHorizontal,
  Bell,
  Compass,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  buildStaticCatalog,
  filterCatalogItems,
  splitHighlightSegments,
} from './searchCatalog';
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
} from './recentSearches';
import { searchLiveRecords, warmRoleSearchCache } from './searchDataSource';

const HighlightText = ({ text, query }) => {
  const segments = splitHighlightSegments(text, query);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.match ? (
          <mark
            key={idx}
            className="bg-primary/15 dark:bg-primary-400/25 text-inherit rounded-sm px-0.5 font-bold"
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};

const renderOptionIcon = (item) => {
  if (item.avatar) {
    return <img src={item.avatar} alt="" className="w-full h-full object-cover" />;
  }
  if (item.icon && React.isValidElement(item.icon)) {
    return React.cloneElement(item.icon, {
      className: 'w-3.5 h-3.5',
      'aria-hidden': true,
    });
  }

  const iconProps = { className: 'w-3.5 h-3.5', 'aria-hidden': true };
  switch (item.iconName || item.kind) {
    case 'recent':
      return <ClockCounterClockwise {...iconProps} />;
    case 'consent':
    case 'settings-privacy':
      return <ShieldCheck {...iconProps} />;
    case 'profile':
      return <User {...iconProps} />;
    case 'settings':
      return <GearSix {...iconProps} />;
    case 'settings-appearance':
    case 'sun':
      return <Sun {...iconProps} />;
    case 'settings-personalization':
      return <SlidersHorizontal {...iconProps} />;
    case 'settings-notifications':
      return <Bell {...iconProps} />;
    case 'moon':
      return <Moon {...iconProps} />;
    case 'language':
      return <Translate {...iconProps} />;
    case 'updates':
      return <Sparkle {...iconProps} />;
    case 'logout':
      return <SignOut {...iconProps} />;
    case 'provider':
      return <Briefcase {...iconProps} />;
    case 'patient':
      return <Users {...iconProps} />;
    case 'request':
      return <FileText {...iconProps} />;
    case 'conversation':
      return <ChatCircle {...iconProps} />;
    case 'schedule':
      return <CalendarDots {...iconProps} />;
    case 'announcement':
      return <Megaphone {...iconProps} />;
    default:
      return <Compass {...iconProps} />;
  }
};

const GlobalSearch = ({ currentRole, links, authUser, onNavigate, onLogout }) => {
  const { dark, setThemeMode, reducedMotion } = useTheme();
  const { t, language, setLanguage, translateService, translateStatus } = useLanguage();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveState, setLiveState] = useState({ query: '', groups: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentItems, setRecentItems] = useState(() =>
    getRecentSearches(currentRole, authUser?.id)
  );

  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef(new Map());
  const requestSeqRef = useRef(0);
  const i18nHelpersRef = useRef({ t, translateService, translateStatus });
  i18nHelpersRef.current = { t, translateService, translateStatus };

  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;

  // Reload recent items when user or role changes
  useEffect(() => {
    setRecentItems(getRecentSearches(currentRole, authUser?.id));
  }, [currentRole, authUser?.id]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-warm scoped cache on open for patient/provider
  useEffect(() => {
    if (!searchOpen || !authUser?.id) return;
    if (currentRole === 'patient' || currentRole === 'provider') {
      warmRoleSearchCache(currentRole, authUser.id);
    }
  }, [searchOpen, currentRole, authUser?.id]);

  // Static catalog (pages + hidden routes + Settings tabs + Quick Actions)
  const catalog = useMemo(
    () =>
      buildStaticCatalog({
        role: currentRole,
        links,
        t,
        dark,
        language,
      }),
    [currentRole, links, t, dark, language]
  );

  const trimmedQuery = searchQuery.trim();

  // Fetch live records with sequence guard so stale responses never win
  useEffect(() => {
    if (trimmedQuery.length < 2 || !authUser?.id) {
      requestSeqRef.current += 1;
      setLiveState({ query: '', groups: [] });
      setIsSearching(false);
      return;
    }

    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setIsSearching(true);

    const debounceMs = currentRole === 'admin' ? 200 : 60;
    const timer = setTimeout(async () => {
      try {
        const {
          t: currentT,
          translateService: currentTranslateService,
          translateStatus: currentTranslateStatus,
        } = i18nHelpersRef.current;

        const groups = await searchLiveRecords({
          role: currentRole,
          userId: authUser.id,
          query: trimmedQuery,
          translateService: currentTranslateService,
          translateStatus: currentTranslateStatus,
          t: currentT,
        });

        if (requestSeqRef.current !== seq) return;
        setLiveState({ query: trimmedQuery, groups });
      } catch {
        if (requestSeqRef.current !== seq) return;
        setLiveState({ query: trimmedQuery, groups: [] });
      } finally {
        if (requestSeqRef.current === seq) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmedQuery, currentRole, authUser?.id, language]);

  // Build ordered visible sections & flat selectable options list
  const sections = useMemo(() => {
    const built = [];

    if (!trimmedQuery) {
      if (recentItems.length > 0) {
        built.push({
          key: 'recent',
          label: t('nav.search.recent'),
          showClear: true,
          items: recentItems.map((item) => ({
            ...item,
            uid: `recent:${item.to}`,
            isRecent: true,
          })),
        });
      }

      built.push({
        key: 'quick-nav',
        label: t('nav.search.quickNavigation'),
        items: catalog.pages.slice(0, Math.max(links.length, 5)).map((item) => ({
          ...item,
          uid: item.id,
        })),
      });

      built.push({
        key: 'quick-actions',
        label: t('nav.search.quickActions'),
        items: catalog.actions.map((item) => ({
          ...item,
          uid: item.id,
        })),
      });

      return built;
    }

    const matchedPages = filterCatalogItems(catalog.pages, trimmedQuery);
    if (matchedPages.length > 0) {
      built.push({
        key: 'pages',
        label: t('nav.search.matchingPages'),
        items: matchedPages.map((item) => ({ ...item, uid: item.id })),
      });
    }

    const matchedSettings = filterCatalogItems(catalog.settings, trimmedQuery);
    if (matchedSettings.length > 0) {
      built.push({
        key: 'settings',
        label: t('nav.search.settings'),
        items: matchedSettings.map((item) => ({ ...item, uid: item.id })),
      });
    }

    const activeLiveGroups =
      liveState.query === trimmedQuery ? liveState.groups : [];

    for (const group of activeLiveGroups) {
      if (group.items && group.items.length > 0) {
        built.push({
          key: `live-${group.key}`,
          label: group.label,
          items: group.items.map((item) => ({
            ...item,
            uid: `live:${group.key}:${item.id}`,
          })),
        });
      }
    }

    const matchedActions = filterCatalogItems(catalog.actions, trimmedQuery);
    if (matchedActions.length > 0) {
      built.push({
        key: 'actions',
        label: t('nav.search.quickActions'),
        items: matchedActions.map((item) => ({ ...item, uid: item.id })),
      });
    }

    return built;
  }, [trimmedQuery, recentItems, catalog, links.length, liveState, t]);

  const flatOptions = useMemo(() => {
    const list = [];
    for (const sec of sections) {
      for (const item of sec.items) {
        list.push(item);
      }
    }
    return list;
  }, [sections]);

  // Reset active index when query or option count changes
  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery, flatOptions.length]);

  const safeActiveIndex =
    flatOptions.length > 0 ? Math.min(activeIndex, flatOptions.length - 1) : -1;
  const activeOption = safeActiveIndex >= 0 ? flatOptions[safeActiveIndex] : null;
  const optionDomId = useCallback(
    (uid) => `${baseId}-opt-${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    [baseId]
  );

  // Scroll active option into view during keyboard navigation
  useEffect(() => {
    if (!searchOpen || !activeOption) return;
    const node = optionRefs.current.get(activeOption.uid);
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [searchOpen, activeOption]);

  const executeOption = useCallback(
    (item) => {
      if (!item) return;

      if (item.kind === 'action') {
        setSearchOpen(false);
        setSearchQuery('');
        if (item.actionId === 'toggle-theme') {
          setThemeMode(dark ? 'light' : 'dark');
        } else if (item.actionId === 'toggle-language') {
          setLanguage(language === 'en' ? 'tl' : 'en');
        } else if (item.actionId === 'weekly-updates') {
          window.dispatchEvent(new CustomEvent('munticares-open-weekly-updates'));
        } else if (item.actionId === 'sign-out') {
          onLogout?.();
        }
        return;
      }

      if (item.to) {
        const updated = addRecentSearch(currentRole, authUser?.id, {
          id: item.id || item.uid,
          label: item.label,
          subtitle: item.recentSubtitle !== undefined ? item.recentSubtitle : item.subtitle,
          to: item.to,
          kind: item.kind || 'page',
        });
        setRecentItems(updated);
        setSearchOpen(false);
        setSearchQuery('');
        onNavigate?.(item.to);
      }
    },
    [currentRole, authUser?.id, dark, language, setThemeMode, setLanguage, onLogout, onNavigate]
  );

  const handleInputKeyDown = (e) => {
    // IME safety: let composition handle Enter/Escape/Arrows natively (including Safari keyCode 229)
    if (e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229) {
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!searchOpen) {
        setSearchOpen(true);
        return;
      }
      if (flatOptions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatOptions.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!searchOpen) {
        setSearchOpen(true);
        return;
      }
      if (flatOptions.length > 0) {
        setActiveIndex((prev) => (prev - 1 + flatOptions.length) % flatOptions.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchOpen && activeOption) {
        executeOption(activeOption);
      }
    }
  };

  const handleClearRecent = (e) => {
    e.stopPropagation();
    clearRecentSearches(currentRole, authUser?.id);
    setRecentItems([]);
  };

  const placeholderText =
    currentRole === 'provider'
      ? t('nav.search.providerPlaceholder')
      : currentRole === 'admin'
      ? t('nav.search.adminPlaceholder')
      : t('nav.search.patientPlaceholder');

  let runningIndex = -1;

  return (
    <div
      ref={searchContainerRef}
      className="relative hidden md:flex flex-1 max-w-md mx-4 lg:mx-6 z-30"
    >
      <label htmlFor={inputId} className="sr-only">
        {t('nav.search.ariaLabel')}
      </label>
      <div
        className={`neu-inset dark:bg-surface-darkAlt w-full h-10 sm:h-11 rounded-2xl px-3.5 flex items-center gap-2.5 text-xs transition-all border ${
          searchOpen
            ? 'border-primary/40 ring-2 ring-primary/20 shadow-[inset_2px_3px_6px_rgba(23,40,59,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_3px_6px_rgba(0,0,0,0.7),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]'
            : 'border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-[inset_1.5px_2px_4px_rgba(23,40,59,0.08),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55),inset_-1px_-1px_3px_rgba(255,255,255,0.03)]'
        }`}
      >
        <MagnifyingGlass
          aria-hidden="true"
          className={`w-4 h-4 transition-colors shrink-0 ${
            searchOpen ? 'text-link' : 'text-txt-secondary dark:text-txt-darkSecondary'
          }`}
        />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={searchOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            searchOpen && activeOption ? optionDomId(activeOption.uid) : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={searchQuery}
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!searchOpen) setSearchOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholderText}
          className="bg-transparent border-none outline-none text-xs text-txt-primary dark:text-txt-darkPrimary placeholder-txt-secondary/60 dark:placeholder-txt-darkSecondary/60 w-full focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            aria-label={t('nav.search.clearInput')}
            className="min-w-6 min-h-6 rounded-lg flex items-center justify-center text-txt-secondary dark:text-txt-darkSecondary hover:text-txt-primary dark:hover:text-txt-darkPrimary hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-label={t('nav.search.ariaLabel')}
            initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-2 neu-flat rounded-2xl shadow-xl overflow-hidden p-2 z-50 max-h-[26rem] overflow-y-auto"
          >
            {sections.map((section, secIdx) => (
              <div
                key={section.key}
                className={
                  secIdx > 0
                    ? 'mt-2 pt-2 border-t border-slate-200/70 dark:border-white/10'
                    : ''
                }
              >
                <div className="flex items-center justify-between px-3 py-1.5">
                  <p className="text-2xs font-bold text-txt-secondary dark:text-txt-darkSecondary uppercase tracking-wider">
                    {section.label}
                  </p>
                  {section.showClear && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClearRecent}
                      className="min-h-6 px-1.5 text-2xs font-semibold text-txt-secondary hover:text-link dark:text-txt-darkSecondary dark:hover:text-link rounded transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {t('nav.search.clearRecent')}
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    runningIndex += 1;
                    const optionIdx = runningIndex;
                    const isActive = optionIdx === safeActiveIndex;
                    const hintLabel =
                      item.kind === 'action' ? t('nav.search.run') : t('nav.search.jump');

                    return (
                      <button
                        key={item.uid}
                        id={optionDomId(item.uid)}
                        ref={(el) => {
                          if (el) optionRefs.current.set(item.uid, el);
                          else optionRefs.current.delete(item.uid);
                        }}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={isActive}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIndex(optionIdx)}
                        onClick={() => executeOption(item)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs transition-colors group cursor-pointer ${
                          isActive
                            ? 'bg-primary/10 dark:bg-white/10 text-link dark:text-link'
                            : 'text-txt-primary dark:text-txt-darkPrimary hover:bg-primary/10 dark:hover:bg-white/5 hover:text-link dark:hover:text-link'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg neu-flat-sm flex items-center justify-center shrink-0 overflow-hidden ${
                            isActive
                              ? 'text-link'
                              : 'text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link'
                          }`}
                        >
                          {renderOptionIcon(item)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">
                            <HighlightText text={item.label} query={trimmedQuery} />
                          </span>
                          {item.subtitle && (
                            <span className="block text-2xs text-txt-secondary dark:text-txt-darkSecondary truncate">
                              <HighlightText text={item.subtitle} query={trimmedQuery} />
                            </span>
                          )}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`text-2xs text-txt-secondary dark:text-txt-darkSecondary shrink-0 transition-opacity ${
                            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {hintLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {isSearching && (
              <div
                role="progressbar"
                aria-label={t('nav.search.searchingRecords')}
                className="py-2 text-center text-2xs text-txt-secondary dark:text-txt-darkSecondary"
              >
                {t('nav.search.searchingRecords')}
              </div>
            )}

            {!isSearching && trimmedQuery && flatOptions.length === 0 && (
              <p className="text-xs text-txt-secondary dark:text-txt-darkSecondary px-3 py-4 text-center">
                {t('nav.search.noResultsFor', { query: trimmedQuery })}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSearch;
