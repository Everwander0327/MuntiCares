import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { NotificationBell, MobileNavItem, ProfilePopover, GlobalSearch, clearSearchCache } from '@/shared/navigation';
import { BrandLogo } from '@/shared/ui';
import { WeeklyUpdatesModal } from '@/shared/feedback';
import { useTheme } from '@/contexts/ThemeContext';
import {
  SEVEN_DAYS_MS,
  splitWeeklyUpdatesForRole,
  hasUnseenWeeklyUpdates,
  dismissWeeklyUpdates,
} from '@/features/admin/utils/recentEvents';
import { supabase } from '@/lib/supabase';
import {
  SquaresFour,
  MagnifyingGlass,
  FileText,
  Users,
  Briefcase,
  Bell,
  CalendarDots,
  ChatCircle,
  Megaphone,
  User,
} from '@phosphor-icons/react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { liveUserRowToAction } from './liveUserSync';
import toast from 'react-hot-toast';

const DashboardLayoutContext = createContext(false);

const SidebarItem = ({ icon, label, to, active, onClick, badge, collapsed }) => {
  const [tooltip, setTooltip] = useState(null);
  const showTooltip = (event) => {
    if (!collapsed || !window.matchMedia('(min-width: 1024px)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ left: rect.right + 8, top: rect.top + rect.height / 2 });
  };
  return (<>
  <Link
    to={to}
    onClick={(event) => { setTooltip(null); onClick?.(event); }}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    onMouseEnter={showTooltip}
    onMouseLeave={() => setTooltip(null)}
    onFocus={showTooltip}
    onBlur={() => setTooltip(null)}
    onKeyDown={(event) => { if (event.key === 'Escape') setTooltip(null); }}
    className={`group flex items-center gap-3 min-h-[2.75rem] relative transition-colors duration-200 ${
      collapsed
        ? 'lg:w-full lg:h-11 lg:px-0 lg:justify-center px-3.5 py-2.5 rounded-2xl lg:rounded-none'
        : 'px-3.5 py-2.5 rounded-2xl'
    } ${
      active
        ? 'text-link font-bold'
        : `text-txt-secondary dark:text-txt-darkSecondary hover:text-link dark:hover:text-link ${
            collapsed ? 'hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] lg:hover:bg-transparent' : 'hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
          }`
    }`}
  >
    {active && (
      <>
        <motion.span
          layoutId="sidebar-active-tint"
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          aria-hidden="true"
          className={`absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary-400/15 pointer-events-none ${collapsed ? 'lg:hidden' : ''}`}
        />
        <motion.span
          layoutId="sidebar-active-indicator"
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          aria-hidden="true"
          className={`absolute pointer-events-none bg-primary dark:bg-primary-400 w-1 rounded-full ${
            collapsed
              ? 'left-1.5 top-2.5 bottom-2.5 lg:left-2 lg:top-2 lg:bottom-2'
              : 'left-1.5 top-2.5 bottom-2.5'
          }`}
        />
      </>
    )}
    <span className="relative z-10 flex items-center justify-center shrink-0">
      {React.cloneElement(icon, {
        className: 'w-5 h-5 shrink-0 transition-transform duration-200 ease-fluid group-hover:scale-105 group-active:scale-95',
        weight: active ? 'fill' : 'regular',
        'aria-hidden': true,
      })}
      {badge > 0 && collapsed && (
        <span className="hidden lg:flex absolute -top-1.5 -right-2 min-w-[1.125rem] h-[1.125rem] rounded-full items-center justify-center text-xs font-black px-1 shadow-sm tabular-nums bg-[#BC3030] dark:bg-[#F4918B] text-white dark:text-[#3C1B1A] scale-90">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </span>
    <span className={`relative z-10 text-sm flex-1 truncate ${collapsed ? 'lg:sr-only' : ''} ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
    {badge > 0 && (
      <span className={`relative z-10 ${collapsed ? 'lg:hidden' : ''} min-w-[1.25rem] h-[1.25rem] rounded-full flex items-center justify-center text-xs font-black px-1.5 shadow-sm tabular-nums bg-[#BC3030] dark:bg-[#F4918B] text-white dark:text-[#3C1B1A]`}>
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </Link>
  {collapsed && createPortal(
    <AnimatePresence>
      {tooltip && (
        <span style={tooltip} className="fixed z-popover -translate-y-1/2 pointer-events-none">
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, x: -6, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="block whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          >
            {label}
          </motion.span>
        </span>
      )}
    </AnimatePresence>,
    document.body
  )}
  </>);
};

const DashboardLayout = ({ children, role = 'patient' }) => {
  const isInsidePersistentLayout = useContext(DashboardLayoutContext);

  // If already inside the Persistent Dashboard Shell, just pass through the children
  // so existing page components don't duplicate the shell or re-mount layout.
  if (isInsidePersistentLayout) {
    return <>{children || <Outlet />}</>;
  }

  return (
    <DashboardLayoutContext.Provider value={true}>
      <DashboardShell role={role}>
        {children || <Outlet />}
      </DashboardShell>
    </DashboardLayoutContext.Provider>
  );
};

const DashboardShell = ({ children, role = 'patient' }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, formatDate, translateRole } = useLanguage();
  const { user: authUser, logout, updateUser } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState(() => authUser);
  const mainRef = useRef(null);
  const channelRef = useRef(null);
  const latestAuthUserRef = useRef(authUser);
  latestAuthUserRef.current = authUser;

  const [patientProfileReady, setPatientProfileReady] = useState(
    role !== 'patient' && role !== 'provider'
  );
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyUpdates, setWeeklyUpdates] = useState({ events: [], announcements: [], allItems: [] });
  const autoCheckedUserRef = useRef(null);

  useEffect(() => {
    if (role !== 'patient' && role !== 'provider') {
      setPatientProfileReady(true);
      return;
    }
    if (!authUser?.id) return;

    if (role === 'patient') {
      supabase
        .from('patients')
        .select('is_profile_complete')
        .eq('user_id', authUser.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && (!data || !data.is_profile_complete)) {
            navigate('/patient/onboarding', { replace: true });
          } else {
            setPatientProfileReady(true);
          }
        });
      return;
    }

    let deferred = false;
    try {
      deferred = Boolean(
        window.sessionStorage.getItem(`mc_provider_onboarding_deferred:${authUser.id}`)
      );
    } catch {
      deferred = false;
    }

    supabase
      .from('providers')
      .select('is_profile_complete')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && (!data || !data.is_profile_complete) && !deferred) {
          navigate('/provider/onboarding', { replace: true });
        } else {
          setPatientProfileReady(true);
        }
      });
  }, [role, authUser?.id, navigate]);

  // Keep local user profile fresh and subscribe to Supabase users changes
  useEffect(() => {
    setCurrentUserProfile(authUser);
  }, [authUser]);

  useEffect(() => {
    if (!authUser?.id) return;

    // A realtime UPDATE that lands while the fetch below is still in flight is newer
    // than the row that fetch resolves with, so the fetch must not merge over it.
    let sawRealtimeUpdate = false;
    // This effect re-runs while an earlier fetch is still in flight; a superseded run
    // must not write to the profile either.
    let active = true;

    const fetchLiveUser = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, avatar_url, role, is_banned')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        toast.error(t('nav.profileRefreshError'));
        return;
      }
      if (sawRealtimeUpdate) return;

      if (data) {
        const action = liveUserRowToAction(data);
        if (action.signOut) {
          clearSearchCache();
          await logout();
          navigate('/login', { replace: true });
          return;
        }
        setCurrentUserProfile(prev => ({ ...prev, ...data }));
        if (data.avatar_url !== latestAuthUserRef.current?.avatar_url || data.full_name !== latestAuthUserRef.current?.full_name) {
          updateUser?.(data);
        }
      }
    };

    fetchLiveUser();

    // Subscribe to postgres changes for the current user's profile
    const userChannel = supabase
      .channel(`live-user-${authUser.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${authUser.id}` }, payload => {
        if (payload?.new) {
          sawRealtimeUpdate = true;
          const action = liveUserRowToAction(payload.new);
          if (action.signOut) {
            clearSearchCache();
            logout();
            navigate('/login', { replace: true });
            return;
          }
          setCurrentUserProfile(prev => ({ ...prev, ...payload.new }));
          updateUser?.({
            full_name: payload.new.full_name,
            avatar_url: payload.new.avatar_url,
          });
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(userChannel);
    };
  }, [authUser?.id, updateUser, logout, navigate, t]);

  const toggleDesktopCollapse = () => {
    setIsDesktopCollapsed((collapsed) => !collapsed);
  };

  const patientLinks = [
    { icon: <SquaresFour />, label: t('nav.patient.dashboard'), shortLabel: t('nav.patient.dashboardShort'), primary: true, to: '/patient/dashboard', group: 'main' },
    { icon: <MagnifyingGlass />, label: t('nav.patient.providers'), shortLabel: t('nav.patient.providersShort'), to: '/patient/providers', group: 'main' },
    { icon: <FileText />, label: t('nav.patient.requests'), shortLabel: t('nav.patient.requestsShort'), badgeKey: 'requests', to: '/patient/requests', group: 'main' },
    { icon: <ChatCircle />, label: t('nav.patient.messages'), shortLabel: t('nav.patient.messagesShort'), badgeKey: 'messages', to: '/patient/messages', group: 'main' },
    { icon: <User />, label: t('nav.patient.profile'), shortLabel: t('nav.patient.profileShort'), to: '/patient/profile', group: 'main' },
  ];

  const providerLinks = [
    { icon: <SquaresFour />, label: t('nav.provider.dashboard'), shortLabel: t('nav.provider.dashboardShort'), primary: true, to: '/provider/dashboard', group: 'main' },
    { icon: <Bell />, label: t('nav.provider.requests'), shortLabel: t('nav.provider.requestsShort'), badgeKey: 'requests', to: '/provider/requests', group: 'main' },
    { icon: <Users />, label: t('nav.provider.patients'), shortLabel: t('nav.provider.patientsShort'), to: '/provider/patients', group: 'main' },
    { icon: <CalendarDots />, label: t('nav.provider.schedule'), shortLabel: t('nav.provider.scheduleShort'), to: '/provider/schedule', group: 'main' },
    { icon: <ChatCircle />, label: t('nav.provider.messages'), shortLabel: t('nav.provider.messagesShort'), badgeKey: 'messages', to: '/provider/messages', group: 'main' },
  ];

  const adminLinks = [
    { icon: <SquaresFour />, label: t('nav.admin.dashboard'), shortLabel: t('nav.admin.dashboardShort'), primary: true, to: '/admin/dashboard', group: 'main' },
    { icon: <Users />, label: t('nav.admin.patients'), shortLabel: t('nav.admin.patientsShort'), to: '/admin/patients', group: 'main' },
    { icon: <Briefcase />, label: t('nav.admin.providers'), shortLabel: t('nav.admin.providersShort'), to: '/admin/providers', group: 'main' },
    { icon: <FileText />, label: t('nav.admin.requests'), shortLabel: t('nav.admin.requestsShort'), badgeKey: 'requests', to: '/admin/requests', group: 'main' },
    { icon: <Megaphone />, label: t('nav.admin.announcements'), shortLabel: t('nav.admin.announcementsShort'), to: '/admin/announcements', group: 'main' },
  ];

  // Use the actual logged in user data, fallback to dummy info if not available
  const currentRole = currentUserProfile?.role || role;
  const links = currentRole === 'patient' ? patientLinks : currentRole === 'provider' ? providerLinks : adminLinks;
  const mainLinks = links.filter(l => l.group !== 'account');
  const accountLinks = links.filter(l => l.group === 'account');

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const userInfo = {
    patient: { name: 'Juan Dela Cruz', initials: 'JD', badge: translateRole('patient') },
    provider: { name: 'Maria Santos', initials: 'MS', badge: translateRole('provider') },
    admin: { name: 'Admin User', initials: 'AD', badge: translateRole('admin') },
  };

  const { reducedMotion, uiScale } = useTheme();

  const fetchWeeklyUpdates = useCallback(async ({ autoOpen = false } = {}) => {
    if (!authUser?.id || currentRole === 'admin') return;
    setWeeklyLoading(true);
    try {
      const cutoffIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !data) {
        setWeeklyUpdates({ events: [], announcements: [], allItems: [] });
        return;
      }

      const split = splitWeeklyUpdatesForRole(data, currentRole);
      setWeeklyUpdates(split);

      if (autoOpen && hasUnseenWeeklyUpdates(split.allItems, authUser.id)) {
        setWeeklyModalOpen(true);
      }
    } catch {
      // ignore non-critical weekly digest failure
    } finally {
      setWeeklyLoading(false);
    }
  }, [authUser?.id, currentRole]);

  useEffect(() => {
    if (!authUser?.id) {
      autoCheckedUserRef.current = null;
      return;
    }
    if (currentRole === 'admin' || !patientProfileReady) return;
    if (autoCheckedUserRef.current !== authUser.id) {
      autoCheckedUserRef.current = authUser.id;
      fetchWeeklyUpdates({ autoOpen: true });
    }
  }, [authUser?.id, currentRole, patientProfileReady, fetchWeeklyUpdates]);

  useEffect(() => {
    if (!authUser?.id || currentRole === 'admin') return undefined;

    const handleOpenRequest = () => {
      setWeeklyModalOpen(true);
      fetchWeeklyUpdates({ autoOpen: false });
    };
    window.addEventListener('munticares-open-weekly-updates', handleOpenRequest);

    const channel = supabase
      .channel(`weekly-updates-${currentRole}-${authUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          fetchWeeklyUpdates({ autoOpen: true });
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('munticares-open-weekly-updates', handleOpenRequest);
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, currentRole, fetchWeeklyUpdates]);

  const user = {
    name: currentUserProfile?.full_name || userInfo[currentRole]?.name,
    email: currentUserProfile?.email || authUser?.email || '',
    initials: getInitials(currentUserProfile?.full_name) || userInfo[currentRole]?.initials,
    badge: currentUserProfile?.role ? currentUserProfile.role.charAt(0).toUpperCase() + currentUserProfile.role.slice(1) : userInfo[currentRole]?.badge,
    avatar_url: currentUserProfile?.avatar_url || '',
  };

  const fetchCounts = useCallback(async () => {
    if (!authUser) return;
    let pendingQuery = supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Pending');
    if (authUser.role !== 'admin') {
      pendingQuery = pendingQuery.eq(authUser.role === 'patient' ? 'patient_id' : 'provider_id', authUser.id);
    }
    const pendingRes = await pendingQuery;
    if (!pendingRes.error) setPendingCount(pendingRes.count || 0);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .select('id, is_read')
      .eq('receiver_id', authUser.id)
      .eq('is_read', false)
      .gte('created_at', yesterday);
    if (!msgError) {
      let readIds = new Set();
      try {
        readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${authUser.id}`) || '[]'));
      } catch {}
      const unreadCount = (msgData || []).filter(m => !m.is_read && !readIds.has(m.id)).length;
      setUnreadMsgCount(unreadCount);
    }
  }, [authUser]);

  useEffect(() => {
    fetchCounts();

    if (!authUser) return;

    if (!channelRef.current) {
      channelRef.current = supabase.channel(`layout-counts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    }
    const reqFilter = authUser.role === 'admin'
      ? { event: '*', schema: 'public', table: 'requests' }
      : { event: '*', schema: 'public', table: 'requests', filter: `${authUser.role === 'patient' ? 'patient_id' : 'provider_id'}=eq.${authUser.id}` };
    channelRef.current
      .on('postgres_changes', reqFilter, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${authUser.id}` }, () => fetchCounts())
      .subscribe();

    const onMessagesRead = () => fetchCounts();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchCounts(); };
    const onWindowFocus = () => fetchCounts();
    window.addEventListener('messages-read', onMessagesRead);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    // Counts also arrive over realtime; this backstop only covers dropped sockets.
    const pollInterval = setInterval(fetchCounts, 15000);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.removeEventListener('messages-read', onMessagesRead);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [authUser, fetchCounts]);

  // Auto-hide mobile bottom nav & auto-collapse top bar on scroll down or input typing/focus
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    // Show nav & top bar whenever route changes
    setIsMobileNavVisible(true);
    setIsTopBarVisible(true);
    lastScrollTopRef.current = 0;
  }, [location.pathname]);

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    let ticking = false;

    const handleScrollEvent = (currentScrollTop) => {
      // 1. Always keep visible near the top of the container
      if (currentScrollTop <= 25) {
        setIsMobileNavVisible(true);
        setIsTopBarVisible(true);
        lastScrollTopRef.current = currentScrollTop;
        return;
      }

      // Ignore iOS rubber-band overscroll at page bottom
      if (mainEl && currentScrollTop > (mainEl.scrollHeight - mainEl.clientHeight - 20)) {
        return;
      }

      const delta = currentScrollTop - lastScrollTopRef.current;

      // Filter out tiny micro-jitters
      if (Math.abs(delta) < 8) return;

      if (delta > 0 && currentScrollTop > 40) {
        // Scrolling down past 40px -> collapse top bar & hide bottom nav
        setIsMobileNavVisible(false);
        setIsTopBarVisible(false);
      } else if (delta < 0) {
        // Scrolling up -> reveal top bar & show bottom nav
        setIsMobileNavVisible(true);
        setIsTopBarVisible(true);
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    const handleScroll = (e) => {
      // Ignore scroll events originating from portals, modals, sheets, or dropdowns
      const target = e?.target;
      if (target && target !== window && target !== document && target !== mainEl) {
        return;
      }
      // If a modal/dialog is currently open, prevent background top bar or bottom nav from collapsing
      if (document.querySelector('[role="dialog"]') || document.querySelector('[data-state="open"]')) {
        return;
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentTop = mainEl?.scrollTop ?? window.scrollY ?? document.documentElement.scrollTop ?? 0;
          handleScrollEvent(currentTop);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Auto-hide bottom nav when typing on mobile virtual keyboard, but keep top bar visible
    const handleFocusIn = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) {
        setIsMobileNavVisible(false);
        setIsTopBarVisible(true);
      }
    };

    const handleFocusOut = () => {
      setIsMobileNavVisible(true);
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      mainEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const buildMobileLinks = (links) => {
    const primaryIndex = links.findIndex(l => l.primary);
    if (primaryIndex === -1) return links;
    const primary = links[primaryIndex];
    const others = links.filter((_, i) => i !== primaryIndex);
    const result = [];
    let idx = 0;
    const maxSlots = Math.min(6, others.length + 1);
    for (let i = 0; i < maxSlots; i++) {
      if (i === 2) {
        result.push(primary);
      } else if (idx < others.length) {
        result.push(others[idx]);
        idx++;
      }
    }
    return result;
  };

  const getBadgeForLink = (link) => {
    if (link.badgeKey === 'requests') return pendingCount;
    if (link.badgeKey === 'messages') return unreadMsgCount;
    return 0;
  };

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div className="h-[100dvh] bg-[var(--bg)] flex overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              className="fixed inset-0 bg-slate-900/50 dark:bg-black/50 z-40 lg:hidden backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Desktop sidebar retains an icon rail when collapsed. */}
        <motion.aside
          style={{ '--sidebar-width': `${Math.round((isDesktopCollapsed ? 80 : 288) * uiScale)}px` }}
          className={`fixed inset-y-0 left-0 z-50 w-[18rem] lg:w-[var(--sidebar-width)] transition-[width,transform] duration-300 motion-reduce:transition-none transform ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:static lg:h-full lg:translate-x-0 lg:p-0 overflow-hidden shrink-0 select-none`}
        >
          <div className={`h-full w-full flex flex-col p-5 ${isDesktopCollapsed ? 'lg:px-0 lg:py-3' : ''} neu-flat rounded-none border-r border-slate-200/80 dark:border-white/10 transform-gpu`}>
            {/* Logo row - Flush & aligned with top bar height */}
            <div className={`flex items-center justify-between pb-4 mb-4 border-b border-slate-200/70 dark:border-white/10 shrink-0 px-1 pt-0.5 ${isDesktopCollapsed ? 'lg:justify-center lg:px-0 lg:mx-3' : ''}`}>
              <div className="flex items-center gap-2.5">
                <motion.button
                  layoutId="munti-heart-badge"
                  layout="position"
                  type="button"
                  onClick={toggleDesktopCollapse}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{
                    layout: { duration: 0.42, ease: [0.32, 0.72, 0, 1] },
                  }}
                  className="hidden lg:flex neu-flat-sm w-11 h-11 rounded-2xl items-center justify-center text-link cursor-pointer active:scale-95 transition-all shrink-0 shadow-sm group hover:text-primary-600"
                  title={t(isDesktopCollapsed ? 'nav.sidebar.expand' : 'nav.sidebar.collapse')}
                  aria-label={t(isDesktopCollapsed ? 'nav.sidebar.expand' : 'nav.sidebar.collapse')}
                  aria-expanded={!isDesktopCollapsed}
                >
                  <BrandLogo variant="glyph" className="w-6 h-6 text-link group-hover:scale-110 transition-transform duration-200" decorative />
                </motion.button>
                <Link to="/" className={`flex items-center ${isDesktopCollapsed ? 'lg:hidden' : ''}`}>
                  <span className="text-xl font-display font-extrabold text-link tracking-tight">MuntiCares</span>
                </Link>
              </div>
            </div>

            <div className={`flex-1 flex flex-col min-h-0 ${isDesktopCollapsed ? 'lg:px-0' : 'px-0.5'}`}>
              {/* Grouped Navigation (Option 4) */}
              <div className={`flex-1 overflow-y-auto overflow-x-hidden space-y-4 ${isDesktopCollapsed ? 'lg:py-1' : 'p-1 pr-1.5 -mr-1'}`}>
                <div>
                  <p className={`text-2xs font-extrabold text-tertiary uppercase tracking-widest px-3 mb-2 ${isDesktopCollapsed ? 'lg:sr-only' : ''}`}>{t('nav.sidebar.mainMenu')}</p>
                  <nav className="space-y-1.5">
                    {mainLinks.map((link) => (
                      <SidebarItem 
                        key={link.to} 
                        icon={link.icon}
                        label={link.label}
                        to={link.to}
                        active={location.pathname === link.to || location.pathname.startsWith(link.to + '/')}
                        onClick={() => setIsSidebarOpen(false)}
                        badge={getBadgeForLink(link)}
                        collapsed={isDesktopCollapsed}
                      />
                    ))}
                  </nav>
                </div>

                {accountLinks.length > 0 && (
                  <div className={isDesktopCollapsed ? 'lg:pt-1' : ''}>
                    {isDesktopCollapsed && (
                      <div className="hidden lg:block mx-3 mb-3 border-t border-slate-200/70 dark:border-white/10" aria-hidden="true" />
                    )}
                    <p className={`text-2xs font-extrabold text-tertiary uppercase tracking-widest px-3 mb-2 ${isDesktopCollapsed ? 'lg:sr-only' : ''}`}>{t('nav.sidebar.accountPrivacy')}</p>
                    <nav className="space-y-1.5">
                      {accountLinks.map((link) => (
                        <SidebarItem 
                          key={link.to} 
                          icon={link.icon}
                          label={link.label}
                          to={link.to}
                          active={location.pathname === link.to || location.pathname.startsWith(link.to + '/')}
                          onClick={() => setIsSidebarOpen(false)}
                          badge={getBadgeForLink(link)}
                          collapsed={isDesktopCollapsed}
                        />
                      ))}
                    </nav>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.aside>

        {/* Main Content Column - Sticky Full-Width Top Bar + Open Scrollable Canvas (Option 1) */}
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden transition-all duration-500 relative">
          {/* Upper Panel Header - Auto-Collapsing on Scroll */}
          <header 
            style={{
              transform: isTopBarVisible ? 'translateY(0)' : 'translateY(-100%)',
              opacity: isTopBarVisible ? 1 : 0,
              pointerEvents: isTopBarVisible ? 'auto' : 'none',
              transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            className="absolute top-0 left-0 right-0 h-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:h-[calc(4.75rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] neu-flat rounded-none flex items-center justify-between px-3.5 sm:px-6 lg:px-8 border-b border-slate-200/80 dark:border-white/10 z-40 shadow-sm will-change-transform"
          >
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="min-w-0">
                <p className="text-sm sm:text-base md:text-lg font-display font-black text-txt-primary dark:text-txt-darkPrimary truncate max-w-[11rem] xs:max-w-[14rem] sm:max-w-none leading-tight">
                  {user.name
                    ? t('nav.header.welcomeNamed', { name: user.name.split(' ')[0] })
                    : t('nav.header.welcome')}
                </p>
                <p className="text-[0.6875rem] sm:text-xs text-txt-secondary dark:text-txt-darkSecondary font-medium truncate">
                  {formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Center Working Search / Command Bar */}
            <GlobalSearch
              currentRole={currentRole}
              links={links}
              authUser={authUser}
              onNavigate={(to) => navigate(to)}
              onLogout={async () => {
                clearSearchCache();
                await logout();
                navigate('/login');
              }}
            />

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <NotificationBell />
              <ProfilePopover
                user={user}
                currentRole={currentRole}
                onLogout={async () => {
                  clearSearchCache();
                  await logout();
                  navigate('/login');
                }}
              />
            </div>
          </header>

          {/* Main content gains space when the sidebar collapses to its icon rail. */}
          {(() => {
            const isMessagesPage = location.pathname.includes('/messages');
            return (
              <main
                ref={mainRef}
                className={`flex-1 w-full max-w-full flex flex-col ${
                  isMessagesPage
                    ? 'pt-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:pt-[calc(5rem+env(safe-area-inset-top,0px))] px-2 sm:px-3 lg:px-3.5 pb-2 sm:pb-3 lg:pb-3.5 overflow-hidden'
                    : 'pt-[calc(4.25rem+env(safe-area-inset-top,0px))] sm:pt-[calc(5.5rem+env(safe-area-inset-top,0px))] px-3.5 sm:px-6 lg:px-8 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:pb-24 lg:pb-10 overflow-y-auto overflow-x-hidden'
                }`}
              >
                <div className="w-full max-w-full flex-1 flex flex-col h-full min-h-0">
                  {children || <Outlet />}
                </div>
              </main>
            );
          })()}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div 
        id="mobile-bottom-nav" 
        style={{
          transform: isMobileNavVisible ? 'translateY(0)' : 'translateY(120%)',
          opacity: isMobileNavVisible ? 1 : 0,
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden will-change-transform px-0 pb-0 pt-4 pointer-events-none"
      >
        <nav
          className="mc-bottom-nav"
          style={{ pointerEvents: isMobileNavVisible ? 'auto' : 'none' }}
          aria-label={t('nav.mobile.ariaMain')}
        >
          {(() => {
            const mobileLinks = buildMobileLinks(links);
            return mobileLinks.map((link, i) => (
              <MobileNavItem 
                key={link.to}
                icon={link.icon}
                label={link.shortLabel || link.label}
                to={link.to}
                active={location.pathname === link.to || location.pathname.startsWith(link.to + '/')}
                badge={getBadgeForLink(link)}
                prominent={i === 2}
              />
            ));
          })()}
        </nav>
      </div>
      {currentRole !== 'admin' && (
        <WeeklyUpdatesModal
          open={weeklyModalOpen}
          onOpenChange={setWeeklyModalOpen}
          events={weeklyUpdates.events}
          announcements={weeklyUpdates.announcements}
          loading={weeklyLoading}
          onNavigate={(path) => navigate(path)}
          onDontShowAgain={() => {
            dismissWeeklyUpdates(weeklyUpdates.allItems, authUser?.id);
          }}
        />
      )}
    </MotionConfig>
  );
};

export default DashboardLayout;
