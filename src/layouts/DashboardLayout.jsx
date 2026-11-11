import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { NotificationBell, MobileNavItem } from '@/shared/navigation';
import { ThemeToggle } from '@/shared/feedback';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Search, 
  FileText, 
  Settings, 
  LogOut, 
  X,
  Heart,
  Users,
  Briefcase,
  Bell,
  CalendarDays,
  MessageCircle,
  Megaphone

} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { liveUserRowToAction } from './liveUserSync';
import toast from 'react-hot-toast';

const DashboardLayoutContext = createContext(false);

const SidebarItem = ({ icon, label, to, active, onClick, badge }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-300 relative overflow-hidden ${
      active 
        ? 'neu-btn-primary font-bold shadow-md' 
        : 'text-txt-secondary dark:text-txt-darkSecondary hover:neu-flat hover:text-[#17283B] dark:hover:text-[#E6EEF6]'
    }`}
  >
    <span className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
      active 
        ? '!bg-white/20 dark:!bg-[#08182A]/20 shadow-inner border border-white/30 dark:border-white/10 backdrop-blur-sm text-white' 
        : 'neu-flat-sm text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-[#8CBDF0] group-hover:scale-105'
    }`}>
      {React.cloneElement(icon, { className: 'w-4 h-4' })}
    </span>
    <span className={`font-semibold text-sm flex-1 truncate ${active ? 'font-bold text-white' : ''}`}>{label}</span>
    {badge > 0 && (
      <span className={`min-w-[20px] h-[20px] rounded-md flex items-center justify-center text-xs font-black px-1.5 shadow-sm ${
        active 
          ? 'bg-white dark:bg-[#08182A] text-link dark:text-[#8CBDF0]' 
          : 'bg-[#BC3030] dark:bg-[#F4918B] text-white dark:text-[#3C1B1A]'
      }`}>
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </Link>
);

const GlobalSearch = ({ currentRole, links, authUser, onNavigate }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Keyboard shortcut (Cmd+K / Ctrl+K & Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Filter navigation links
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return links;
    const q = searchQuery.toLowerCase();
    return links.filter(l => 
      l.label.toLowerCase().includes(q) || 
      (l.shortLabel && l.shortLabel.toLowerCase().includes(q))
    );
  }, [links, searchQuery]);

  // Query patient / request data if query length >= 2 and user is provider
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2 || !authUser?.id) {
      setSearchResults([]);
      return;
    }

    let isMounted = true;
    const fetchMatches = async () => {
      setIsSearching(true);
      try {
        if (currentRole === 'provider') {
          const { data } = await supabase
            .from('requests')
            .select('id, service, status, patient:patient_id(full_name, avatar_url)')
            .eq('provider_id', authUser.id)
            .limit(5);

          if (isMounted && data) {
            const q = searchQuery.toLowerCase();
            const matches = data.filter(r => 
              (r.patient?.full_name && r.patient.full_name.toLowerCase().includes(q)) ||
              (r.service && r.service.toLowerCase().includes(q)) ||
              (r.status && r.status.toLowerCase().includes(q))
            ).map(r => ({
              id: r.id,
              title: r.patient?.full_name || 'Patient',
              subtitle: `${r.service || 'Consultation'} • ${r.status}`,
              to: '/provider/patients',
              avatar: r.patient?.avatar_url,
            }));
            setSearchResults(matches);
          }
        }
      } catch {
        // gracefully ignore
      } finally {
        if (isMounted) setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchMatches, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, currentRole, authUser]);

  const handleSelect = (to) => {
    setSearchOpen(false);
    setSearchQuery('');
    if (onNavigate) onNavigate(to);
  };

  return (
    <div ref={searchContainerRef} className="relative hidden md:flex flex-1 max-w-md mx-4 lg:mx-6 z-30">
      <div 
        className={`neu-inset dark:bg-[#111A28] w-full h-10 sm:h-11 rounded-2xl px-3.5 flex items-center gap-2.5 text-xs transition-all border ${
          searchOpen 
            ? 'border-primary/40 ring-2 ring-primary/20 shadow-[inset_2px_3px_6px_rgba(23,40,59,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_3px_6px_rgba(0,0,0,0.7),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]' 
            : 'border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-[inset_1.5px_2px_4px_rgba(23,40,59,0.08),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55),inset_-1px_-1px_3px_rgba(255,255,255,0.03)]'
        }`}
      >
        <Search className={`w-4 h-4 transition-colors shrink-0 ${
          searchOpen ? 'text-link dark:text-[#8CBDF0]' : 'text-txt-secondary dark:text-txt-darkSecondary'
        }`} />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            currentRole === 'provider' 
              ? 'Search patient, schedule, or menu...' 
              : currentRole === 'admin' 
              ? 'Search users, requests, or menu...' 
              : 'Search providers, requests, or menu...'
          }
          className="bg-transparent border-none outline-none text-xs text-[#17283B] dark:text-[#E6EEF6] placeholder-txt-secondary/60 dark:placeholder-txt-darkSecondary/60 w-full focus:outline-none"
        />
      </div>

      {/* Dropdown Results */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-2 neu-flat rounded-2xl shadow-xl overflow-hidden p-2 z-50 max-h-[380px] overflow-y-auto"
          >
            {/* Navigation Section */}
            <div>
              <p className="text-2xs font-bold text-txt-secondary dark:text-txt-darkSecondary uppercase tracking-wider px-3 py-1.5">
                {searchQuery ? 'Matching Pages' : 'Quick Navigation'}
              </p>
              <div className="space-y-1">
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => handleSelect(item.to)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#17283B] dark:text-[#E6EEF6] hover:bg-primary/10 dark:hover:bg-white/5 hover:text-link dark:hover:text-[#8CBDF0] transition-colors group cursor-pointer"
                    >
                      <span className="w-7 h-7 rounded-lg neu-flat-sm flex items-center justify-center text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-[#8CBDF0] shrink-0">
                        {React.cloneElement(item.icon, { className: 'w-3.5 h-3.5' })}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-2xs text-txt-secondary opacity-0 group-hover:opacity-100 transition-opacity">Jump ↵</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-txt-secondary px-3 py-2">No matching pages found</p>
                )}
              </div>
            </div>

            {/* Patients / Data Section if searching */}
            {searchResults.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-white/10">
                <p className="text-2xs font-bold text-txt-secondary dark:text-txt-darkSecondary uppercase tracking-wider px-3 py-1.5">
                  Patient Records &amp; Requests
                </p>
                <div className="space-y-1">
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => handleSelect(res.to)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-[#17283B] dark:text-[#E6EEF6] hover:bg-primary/10 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg neu-flat-sm flex items-center justify-center text-link font-bold text-xs shrink-0 overflow-hidden">
                        {res.avatar ? (
                          <img src={res.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate text-xs">{res.title}</p>
                        <p className="text-2xs text-txt-secondary truncate">{res.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSearching && (
              <div className="py-2 text-center text-2xs text-txt-secondary">
                Searching records...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [isRollupCollapsing, setIsRollupCollapsing] = useState(false);
  const [isRollupExpanding, setIsRollupExpanding] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, logout, updateUser } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState(() => authUser);
  const mainRef = useRef(null);
  const channelRef = useRef(null);
  const latestAuthUserRef = useRef(authUser);
  latestAuthUserRef.current = authUser;

  useEffect(() => {
    if (role !== 'patient' || !authUser?.id) return;
    supabase
      .from('patients')
      .select('is_profile_complete')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && (!data || !data.is_profile_complete)) {
          navigate('/patient/onboarding', { replace: true });
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
        toast.error('Could not refresh your profile.');
        return;
      }
      if (sawRealtimeUpdate) return;

      if (data) {
        const action = liveUserRowToAction(data);
        if (action.signOut) {
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
  }, [authUser?.id, updateUser, logout, navigate]);

  const toggleDesktopCollapse = () => {
    if (!isDesktopCollapsed) {
      // CLOSE: Stage 1 - Tupi pataas mula bottom habang umiikot ang heart
      setIsRollupCollapsing(true);
      setTimeout(() => {
        // CLOSE: Stage 2 - Lilipad na ang heart papuntang top panel
        setIsDesktopCollapsed(true);
        setIsRollupCollapsing(false);
      }, 340);
    } else {
      // OPEN (REVERSE): Stage 1 - Lilipad pabalik ang heart sa sidebar habang umiikot in place
      setIsDesktopCollapsed(false);
      setIsRollupExpanding(true);
      setTimeout(() => {
        // OPEN (REVERSE): Stage 2 - Pagka-land ng heart, bubuka at mag-uunroll ang panel pababa
        setIsRollupExpanding(false);
      }, 380);
    }
  };

  const patientLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', shortLabel: 'Home', to: '/patient/dashboard', group: 'main' },
    { icon: <Search />, label: 'Find Providers', shortLabel: 'Find', primary: true, to: '/patient/providers', group: 'main' },
    { icon: <FileText />, label: 'My Requests', shortLabel: 'Requests', to: '/patient/requests', group: 'main' },
    { icon: <MessageCircle />, label: 'Messages', shortLabel: 'Messages', to: '/patient/messages', group: 'main' },
    { icon: <Settings />, label: 'Consent Settings', shortLabel: 'Consent', to: '/patient/consent', group: 'account' },
  ];

  const providerLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', shortLabel: 'Home', to: '/provider/dashboard', group: 'main' },
    { icon: <Bell />, label: 'Incoming Requests', shortLabel: 'Requests', primary: true, to: '/provider/requests', group: 'main' },
    { icon: <Users />, label: 'My Patients', shortLabel: 'Patients', to: '/provider/patients', group: 'main' },
    { icon: <CalendarDays />, label: 'My Schedule', shortLabel: 'Schedule', to: '/provider/schedule', group: 'main' },
    { icon: <MessageCircle />, label: 'Messages', shortLabel: 'Messages', to: '/provider/messages', group: 'main' },
  ];

  const adminLinks = [
    { icon: <LayoutDashboard />, label: 'Overview', shortLabel: 'Home', primary: true, to: '/admin/dashboard', group: 'main' },
    { icon: <Users />, label: 'Patients', shortLabel: 'Patients', to: '/admin/patients', group: 'main' },
    { icon: <Briefcase />, label: 'Providers', shortLabel: 'Providers', to: '/admin/providers', group: 'main' },
    { icon: <FileText />, label: 'Requests', shortLabel: 'Requests', to: '/admin/requests', group: 'main' },
    { icon: <Megaphone />, label: 'Announcements', shortLabel: 'Alerts', to: '/admin/announcements', group: 'main' },
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
    patient: { name: 'Juan Dela Cruz', initials: 'JD', badge: 'Patient' },
    provider: { name: 'Maria Santos', initials: 'MS', badge: 'Provider' },
    admin: { name: 'Admin User', initials: 'AD', badge: 'Admin' },
  };

  const user = {
    name: currentUserProfile?.full_name || userInfo[currentRole]?.name,
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
    if (currentRole === 'patient') {
      if (link.label === 'My Requests') return pendingCount;
      if (link.label === 'Messages') return unreadMsgCount;
    } else if (currentRole === 'provider') {
      if (link.label === 'Incoming Requests') return pendingCount;
      if (link.label === 'Messages') return unreadMsgCount;
    } else if (currentRole === 'admin') {
      if (link.label === 'Requests') return pendingCount;
    }
    return 0;
  };

  return (
    <>
      <div className="h-[100dvh] bg-[#F4F8FC] dark:bg-[#0E1620] flex overflow-hidden">
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

        {/* Sidebar - Seamless Full-Height Edge Shell (Option 1) + Grouped Menu & Support Card (Option 4) */}
        <motion.aside
          initial={false}
          animate={{
            width: isDesktopCollapsed ? 0 : 288,
            opacity: isDesktopCollapsed ? 0 : 1,
          }}
          transition={{ duration: 0.38, ease: [0.25, 1, 0.5, 1] }}
          className={`fixed inset-y-0 left-0 z-50 transition-transform duration-500 ease-fluid transform ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:static lg:h-full lg:translate-x-0 lg:p-0 overflow-hidden shrink-0 select-none`}
        >
          <div className="h-full w-[288px] flex flex-col p-5 neu-flat rounded-none border-r border-slate-200/80 dark:border-white/10 transform-gpu">
            {/* Logo row - Flush & aligned with top bar height */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/70 dark:border-white/10 shrink-0 px-1 pt-0.5">
              <div className="flex items-center gap-2.5">
                {!isDesktopCollapsed ? (
                  <motion.button
                    layoutId="munti-heart-badge"
                    layout="position"
                    type="button"
                    onClick={toggleDesktopCollapse}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{
                      layout: { duration: 0.42, ease: [0.25, 1, 0.5, 1] },
                    }}
                    className="hidden lg:flex neu-flat-sm w-10 h-10 rounded-xl items-center justify-center text-link cursor-pointer active:scale-95 transition-all shrink-0 shadow-sm group hover:text-primary-600"
                    title="Collapse sidebar (click to toggle)"
                  >
                    <motion.div
                      animate={{ 
                        rotate: isRollupCollapsing ? 720 : isRollupExpanding ? -720 : 0,
                      }}
                      whileHover={{ rotate: 360 }}
                      transition={{ 
                        rotate: { duration: isRollupCollapsing || isRollupExpanding ? 0.38 : 0.55, ease: [0.25, 1, 0.5, 1] },
                      }}
                    >
                      <Heart className="w-5 h-5 text-link fill-primary group-hover:scale-110 transition-transform duration-200" />
                    </motion.div>
                  </motion.button>
                ) : (
                  <div className="w-10 h-10" />
                )}
                <Link to="/" className="flex items-center">
                  <span className="text-xl font-display font-extrabold text-link tracking-tight">MuntiCares</span>
                </Link>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} aria-label="Close navigation menu" className="lg:hidden text-tertiary flex h-10 w-10 items-center justify-center neu-btn rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Body - Roll up when collapsing; Unroll downwards when expanding in reverse */}
            <motion.div 
              animate={{
                opacity: isRollupCollapsing || isDesktopCollapsed || isRollupExpanding ? 0 : 1,
                y: isRollupCollapsing || isDesktopCollapsed || isRollupExpanding ? -16 : 0,
                scaleY: isRollupCollapsing || isDesktopCollapsed || isRollupExpanding ? 0.05 : 1,
                originY: 0,
              }}
              transition={{ duration: 0.36, ease: [0.25, 1, 0.5, 1] }}
              className="flex-1 flex flex-col min-h-0 px-0.5"
            >
              {/* Grouped Navigation (Option 4) */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 pr-1.5 -mr-1 space-y-4">
                <div>
                  <p className="text-2xs font-extrabold text-tertiary uppercase tracking-widest px-3 mb-2">Main Menu</p>
                  <nav className="space-y-1.5">
                    {mainLinks.map((link) => (
                      <SidebarItem 
                        key={link.label} 
                        icon={link.icon}
                        label={link.label}
                        to={link.to}
                        active={location.pathname === link.to || location.pathname.startsWith(link.to + '/')}
                        onClick={() => setIsSidebarOpen(false)}
                        badge={getBadgeForLink(link)}
                      />
                    ))}
                  </nav>
                </div>

                {accountLinks.length > 0 && (
                  <div>
                    <p className="text-2xs font-extrabold text-tertiary uppercase tracking-widest px-3 mb-2">Account &amp; Privacy</p>
                    <nav className="space-y-1.5">
                      {accountLinks.map((link) => (
                        <SidebarItem 
                          key={link.label} 
                          icon={link.icon}
                          label={link.label}
                          to={link.to}
                          active={location.pathname === link.to || location.pathname.startsWith(link.to + '/')}
                          onClick={() => setIsSidebarOpen(false)}
                          badge={getBadgeForLink(link)}
                        />
                      ))}
                    </nav>
                  </div>
                )}
              </div>

              {/* Bottom Account & Logout Section (Option A - Clean, No Extra Card) */}
              <div className="mt-auto pt-3 space-y-2.5">
                {/* Divider */}
                <div className="border-t border-slate-200/70 dark:border-white/10 mx-1" />

                {/* User Info - Clickable Raised Neumorphic Card leading to Profile */}
                <div className="px-1">
                  <Link 
                    to={`/${currentRole}/profile`}
                    onClick={() => setIsSidebarOpen(false)}
                    className="group flex items-center gap-3 p-3 neu-flat hover:neu-flat-sm rounded-2xl transition-all cursor-pointer active:scale-95 shadow-sm"
                    title="View Profile"
                  >
                    <div className="w-10 h-10 rounded-xl neu-flat flex items-center justify-center text-link font-bold text-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#17283B] dark:text-[#E6EEF6] text-xs truncate group-hover:text-link dark:group-hover:text-[#8CBDF0] transition-colors">{user.name}</p>
                      <span className="inline-flex items-center px-2 py-0.5 neu-flat-sm text-link dark:text-[#8CBDF0] text-[10px] font-black rounded-md uppercase tracking-wider mt-0.5">
                        {user.badge}
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Full-Width Logout Button */}
                <div className="px-1">
                  <button 
                    onClick={async () => {
                      await logout();
                      navigate('/login');
                    }}
                    className="neu-btn flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-txt-secondary dark:text-txt-darkSecondary hover:text-[#BC3030] dark:hover:text-[#F4918B] hover:neu-flat transition-all w-full group cursor-pointer active:scale-95"
                  >
                    <div className="neu-flat-sm w-7 h-7 rounded-lg flex items-center justify-center group-hover:text-[#BC3030] dark:group-hover:text-[#F4918B] transition-colors">
                      <LogOut className="w-4 h-4 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-[#BC3030] dark:group-hover:text-[#F4918B]" />
                    </div>
                    <span className="font-bold text-xs group-hover:text-[#BC3030] dark:group-hover:text-[#F4918B] transition-colors">Logout</span>
                  </button>
                </div>
              </div>
            </motion.div>
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
              transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease-in-out',
            }}
            className="absolute top-0 left-0 right-0 h-[72px] sm:h-[76px] neu-flat rounded-none flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 dark:border-white/10 z-40 shadow-sm will-change-transform"
          >
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              {/* When collapsed on desktop: The heart badge physically flies here from the sidebar while spinning! */}
              {isDesktopCollapsed && (
                <motion.button
                  layoutId="munti-heart-badge"
                  layout="position"
                  type="button"
                  onClick={toggleDesktopCollapse}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{
                    layout: { duration: 0.45, ease: [0.25, 1, 0.5, 1] },
                  }}
                  className="hidden lg:flex neu-btn w-10 h-10 rounded-xl items-center justify-center text-link cursor-pointer shrink-0 shadow-md group hover:text-primary-600"
                  title="Expand sidebar (click to expand)"
                >
                  <motion.div
                    initial={{ rotate: -360 }}
                    animate={{ rotate: 0 }}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <Heart className="w-5 h-5 text-link fill-primary group-hover:scale-110 transition-transform duration-200" />
                  </motion.div>
                </motion.button>
              )}

              <div className="min-w-0">
                <p className="text-sm sm:text-base md:text-lg font-display font-black text-[#17283B] dark:text-[#E6EEF6] truncate max-w-[140px] xs:max-w-[180px] sm:max-w-none">
                  Welcome{user.name ? `, ${user.name.split(' ')[0]}!` : '!'}
                </p>
                <p className="text-xs text-txt-secondary dark:text-txt-darkSecondary font-medium truncate mt-0.5">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Center Working Search / Command Bar */}
            <GlobalSearch 
              currentRole={currentRole} 
              links={links} 
              authUser={authUser} 
              onNavigate={(to) => navigate(to)} 
            />

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <ThemeToggle />
              <NotificationBell />
              <Link 
                to={`/${currentRole}/profile`} 
                className="neu-btn h-10 px-2 sm:px-2.5 rounded-xl sm:rounded-2xl flex items-center gap-2 text-link font-black shadow-sm shrink-0 hover:scale-105 transition-all cursor-pointer group"
                title="Profile & Settings"
              >
                <div className="relative w-7 h-7 sm:w-8 sm:h-8 shrink-0">
                  <div className="w-full h-full rounded-lg sm:rounded-xl neu-flat-sm flex items-center justify-center text-link font-black overflow-hidden ring-1 ring-white/50 dark:ring-white/10">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover block" />
                    ) : (
                      <span className="text-xs font-black">{user.initials}</span>
                    )}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#e8ecf2] dark:border-[#16212E] rounded-[3px] z-10" title="Online" />
                </div>
                <span className="hidden xl:inline text-xs font-bold text-[#17283B] dark:text-[#E6EEF6] group-hover:text-link dark:group-hover:text-[#8CBDF0] transition-colors truncate max-w-[100px]">
                  {user.name ? user.name.split(' ')[0] : 'Profile'}
                </span>
              </Link>
            </div>
          </header>

          {/* Open Canvas Main Area - Expands full width when sidebar collapses */}
          {(() => {
            const isMessagesPage = location.pathname.includes('/messages');
            return (
              <main
                ref={mainRef}
                className={`flex-1 w-full max-w-full flex flex-col ${
                  isMessagesPage
                    ? 'pt-[76px] sm:pt-[82px] px-2 sm:px-3 lg:px-3.5 pb-2 sm:pb-3 lg:pb-3.5 overflow-hidden'
                    : 'pt-[84px] sm:pt-[92px] px-4 sm:px-6 lg:px-8 pb-24 sm:pb-28 lg:pb-10 overflow-y-auto overflow-x-hidden'
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
          pointerEvents: isMobileNavVisible ? 'auto' : 'none',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease-in-out',
        }}
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden will-change-transform"
      >
        <div className="mx-3 mb-3 rounded-2xl neu-flat">
          <div className="flex items-center justify-around px-1 py-1">
            {(() => {
              const mobileLinks = buildMobileLinks(links);
              return mobileLinks.map((link, i) => (
                <MobileNavItem 
                  key={link.label}
                  icon={link.icon}
                  label={link.shortLabel || link.label}
                  to={link.to}
                  active={location.pathname === link.to || location.pathname.startsWith(link.to + '/')}
                  badge={getBadgeForLink(link)}
                  prominent={i === 2}
                />
              ));
            })()}
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardLayout;
