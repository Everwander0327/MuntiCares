import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
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

const DashboardLayoutContext = createContext(false);

const SidebarItem = ({ icon, label, to, active, onClick, badge }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-300 relative overflow-hidden ${
      active 
        ? 'neu-btn-primary font-bold shadow-md' 
        : 'text-txt-secondary dark:text-txt-darkSecondary hover:text-link dark:hover:text-[#8CBDF0]'
    }`}
  >
    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
      active 
        ? '!bg-white/20 dark:!bg-[#08182A]/15 shadow-inner border border-white/30 dark:border-black/10 backdrop-blur-sm' 
        : 'neu-flat-sm text-txt-secondary dark:text-txt-darkSecondary group-hover:text-link dark:group-hover:text-[#8CBDF0] group-hover:scale-105'
    }`}>
      {React.cloneElement(icon, { className: 'w-4 h-4' })}
    </span>
    <span className={`font-semibold text-sm flex-1 truncate ${active ? 'font-bold' : ''}`}>{label}</span>
    {badge > 0 && (
      <span className={`min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-xs font-extrabold px-1.5 shadow-sm ${
        active 
          ? 'bg-white dark:bg-[#08182A] text-link dark:text-[#8CBDF0]' 
          : 'bg-[#BC3030] dark:bg-[#F4918B] text-white dark:text-[#3C1B1A]'
      }`}>
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </Link>
);

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

    const fetchLiveUser = async () => {
      const { data } = await supabase
        .from('users')
        .select('full_name, avatar_url, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (data) {
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
          setCurrentUserProfile(prev => ({ ...prev, ...payload.new }));
          updateUser?.({
            full_name: payload.new.full_name,
            avatar_url: payload.new.avatar_url,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [authUser?.id, updateUser]);

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
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/patient/dashboard', group: 'main' },
    { icon: <Search />, label: 'Find Providers', shortLabel: 'Find', primary: true, to: '/patient/providers', group: 'main' },
    { icon: <FileText />, label: 'My Requests', shortLabel: 'Requests', to: '/patient/requests', group: 'main' },
    { icon: <MessageCircle />, label: 'Messages', to: '/patient/messages', group: 'main' },
    { icon: <Settings />, label: 'Consent Settings', shortLabel: 'Consent', to: '/patient/consent', group: 'account' },
  ];

  const providerLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/provider/dashboard', group: 'main' },
    { icon: <Bell />, label: 'Incoming Requests', shortLabel: 'Requests', primary: true, to: '/provider/requests', group: 'main' },
    { icon: <Users />, label: 'My Patients', shortLabel: 'Patients', to: '/provider/patients', group: 'main' },
    { icon: <CalendarDays />, label: 'My Schedule', shortLabel: 'Schedule', to: '/provider/schedule', group: 'main' },
    { icon: <MessageCircle />, label: 'Messages', to: '/provider/messages', group: 'main' },
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

  const deleteOldMessages = useCallback(async () => {
    if (!authUser) return;
    const { error } = await supabase
      .from('messages')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (error) console.warn('Message cleanup error:', error);
  }, [authUser]);

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
    deleteOldMessages();

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

    const pollInterval = setInterval(fetchCounts, 2000);
    const cleanupInterval = setInterval(deleteOldMessages, 60000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(cleanupInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.removeEventListener('messages-read', onMessagesRead);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [authUser, fetchCounts, deleteOldMessages]);

  // Auto-hide mobile bottom nav on scroll down or input typing/focus
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    // Show nav whenever route changes
    setIsMobileNavVisible(true);
  }, [location.pathname]);

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    let ticking = false;
    let touchStartY = 0;

    const handleScrollEvent = (currentScrollTop) => {
      const delta = currentScrollTop - lastScrollTopRef.current;
      if (Math.abs(delta) > 8) {
        if (delta > 0 && currentScrollTop > 30) {
          // Scrolling down -> hide bottom nav
          setIsMobileNavVisible(false);
        } else if (delta < 0) {
          // Scrolling up -> show bottom nav
          setIsMobileNavVisible(true);
        }
        lastScrollTopRef.current = currentScrollTop;
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScrollEvent(mainEl.scrollTop || window.scrollY || document.documentElement.scrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Touch gesture detection for mobile devices
    const handleTouchStart = (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        const touchCurrentY = e.touches[0].clientY;
        const diff = touchStartY - touchCurrentY; // positive = swipe up (scrolling down page)
        if (Math.abs(diff) > 15) {
          if (diff > 0) {
            setIsMobileNavVisible(false);
          } else {
            setIsMobileNavVisible(true);
          }
          touchStartY = touchCurrentY;
        }
      }
    };

    // Auto-hide when virtual keyboard opens or user focuses on search/input/textarea
    const handleFocusIn = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) {
        setIsMobileNavVisible(false);
      }
    };

    const handleFocusOut = () => {
      setIsMobileNavVisible(true);
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      mainEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
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
                    className="group flex items-center gap-3 px-3.5 py-3 neu-flat-sm hover:neu-flat rounded-2xl transition-all cursor-pointer active:scale-95 shadow-sm"
                    title="View Profile"
                  >
                    <div className="w-10 h-10 rounded-xl neu-flat-sm flex items-center justify-center text-link font-bold text-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#17283B] dark:text-[#E6EEF6] text-sm truncate group-hover:text-link dark:group-hover:text-[#8CBDF0] transition-colors">{user.name}</p>
                      <span className="inline-flex items-center px-2 py-0.5 neu-flat-sm text-link dark:text-[#8CBDF0] text-2xs font-black rounded-full uppercase tracking-wider mt-0.5">
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
                    className="neu-btn flex items-center gap-3 px-3.5 py-3 rounded-2xl text-txt-secondary dark:text-txt-darkSecondary hover:text-[#BC3030] dark:hover:text-[#F4918B] transition-all w-full group cursor-pointer"
                  >
                    <div className="neu-flat-sm w-7 h-7 rounded-lg flex items-center justify-center group-hover:text-[#BC3030] dark:group-hover:text-[#F4918B]">
                      <LogOut className="w-4 h-4 text-txt-secondary dark:text-txt-darkSecondary group-hover:text-[#BC3030] dark:group-hover:text-[#F4918B]" />
                    </div>
                    <span className="font-bold text-xs">Logout</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.aside>

        {/* Main Content Column - Sticky Full-Width Top Bar + Open Scrollable Canvas (Option 1) */}
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden transition-all duration-500">
          {/* Upper Panel Header - Flush Sticky Top Bar */}
          <header className="h-[72px] sm:h-[76px] neu-flat rounded-none flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 border-b border-slate-200/80 dark:border-white/10 transition-all z-20">
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
                <p className="text-xs sm:text-base md:text-lg font-display font-black text-[#17283B] dark:text-[#E6EEF6] truncate max-w-[140px] xs:max-w-[180px] sm:max-w-none">
                  Welcome{user.name ? `, ${user.name.split(' ')[0]}!` : '!'}
                </p>
                <p className="text-xs text-txt-secondary dark:text-txt-darkSecondary font-medium truncate">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
              <ThemeToggle />
              <NotificationBell />
              <Link 
                to={`/${currentRole}/profile`} 
                className="neu-btn w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-link font-black shadow-sm shrink-0 hover:scale-105 transition-transform cursor-pointer overflow-hidden"
                title="Profile"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs sm:text-sm font-black">{user.initials}</span>
                )}
              </Link>
            </div>
          </header>

          {/* Open Canvas Main Area - Expands full width when sidebar collapses */}
          <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full p-4 sm:p-6 lg:p-8 pb-24 sm:pb-28 lg:pb-10 flex flex-col">
            <div className="w-full max-w-full flex-1 flex flex-col">
              {children || <Outlet />}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div 
        id="mobile-bottom-nav" 
        className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-all duration-300 ease-fluid ${
          isMobileNavVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
