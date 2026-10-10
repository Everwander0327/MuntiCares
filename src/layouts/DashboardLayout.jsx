import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import { supabase } from '../lib/supabase';
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
import { useAuth } from '../contexts/AuthContext';
import MobileNavItem from '../components/MobileNavItem';

const DashboardLayoutContext = createContext(false);

const SidebarItem = ({ icon, label, to, active, onClick, badge }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative overflow-hidden ${
      active 
        ? 'neu-btn-primary text-white font-bold shadow-md' 
        : 'text-slate-600 dark:text-slate-300 hover:text-primary'
    }`}
  >
    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
      active 
        ? '!bg-white/20 !text-white shadow-inner border border-white/30 backdrop-blur-sm' 
        : 'neu-flat-sm text-slate-600 dark:text-slate-300 group-hover:text-primary group-hover:scale-105'
    }`}>
      {React.cloneElement(icon, { className: `w-4 h-4 ${active ? '!text-white' : ''}` })}
    </span>
    <span className={`font-semibold text-sm flex-1 truncate ${active ? 'text-white font-bold' : ''}`}>{label}</span>
    {badge > 0 && (
      <span className={`min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-3xs font-extrabold px-1.5 shadow-sm ${
        active ? 'bg-white text-primary' : 'bg-red-500 text-white'
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
  const { user: authUser, logout } = useAuth();
  const mainRef = useRef(null);
  const channelRef = useRef(null);

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
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/patient/dashboard' },
    { icon: <Search />, label: 'Find Providers', shortLabel: 'Find', primary: true, to: '/patient/providers' },
    { icon: <FileText />, label: 'My Requests', shortLabel: 'Requests', to: '/patient/requests' },
    { icon: <MessageCircle />, label: 'Messages', to: '/patient/messages' },
    { icon: <Settings />, label: 'Consent Settings', shortLabel: 'Consent', to: '/patient/consent' },
  ];

  const providerLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/provider/dashboard' },
    { icon: <Bell />, label: 'Incoming Requests', shortLabel: 'Requests', primary: true, to: '/provider/requests' },
    { icon: <Users />, label: 'My Patients', shortLabel: 'Patients', to: '/provider/patients' },
    { icon: <CalendarDays />, label: 'My Schedule', shortLabel: 'Schedule', to: '/provider/schedule' },
    { icon: <MessageCircle />, label: 'Messages', to: '/provider/messages' },
  ];

  const adminLinks = [
    { icon: <LayoutDashboard />, label: 'Overview', shortLabel: 'Home', primary: true, to: '/admin/dashboard' },
    { icon: <Users />, label: 'Patients', shortLabel: 'Patients', to: '/admin/patients' },
    { icon: <Briefcase />, label: 'Providers', shortLabel: 'Providers', to: '/admin/providers' },
    { icon: <FileText />, label: 'Requests', shortLabel: 'Requests', to: '/admin/requests' },
    { icon: <Megaphone />, label: 'Announcements', shortLabel: 'Alerts', to: '/admin/announcements' },
  ];

  // Use the actual logged in user data, fallback to dummy info if not available
  const currentRole = authUser?.role || role;
  const links = currentRole === 'patient' ? patientLinks : currentRole === 'provider' ? providerLinks : adminLinks;

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
    name: authUser?.full_name || userInfo[currentRole]?.name,
    initials: getInitials(authUser?.full_name) || userInfo[currentRole]?.initials,
    badge: authUser?.role ? authUser.role.charAt(0).toUpperCase() + authUser.role.slice(1) : userInfo[currentRole]?.badge,
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
    const pendingRes = await supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq(authUser.role === 'patient' ? 'patient_id' : 'provider_id', authUser.id)
      .eq('status', 'Pending');
    if (!pendingRes.error) setPendingCount(pendingRes.count || 0);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .eq('receiver_id', authUser.id)
      .gte('created_at', yesterday);
    if (!msgError) {
      const readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${authUser.id}`) || '[]'));
      const unreadCount = (msgData || []).filter(m => !readIds.has(m.id)).length;
      setUnreadMsgCount(unreadCount);
    }
  }, [authUser]);

  useEffect(() => {
    fetchCounts();
    deleteOldMessages();

    if (!channelRef.current) {
      channelRef.current = supabase.channel(`layout-counts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    }
    channelRef.current
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `${authUser.role === 'patient' ? 'patient_id' : 'provider_id'}=eq.${authUser.id}` }, () => fetchCounts())
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

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden">
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

        {/* Sidebar - floating neumorphic island with rollup bottom-to-top collapse */}
        <motion.aside
          initial={false}
          animate={{
            width: isDesktopCollapsed ? 0 : 312,
            opacity: isDesktopCollapsed ? 0 : 1,
            paddingLeft: isDesktopCollapsed ? 0 : undefined,
            paddingRight: isDesktopCollapsed ? 0 : undefined,
          }}
          transition={{ duration: 0.38, ease: [0.25, 1, 0.5, 1] }}
          className={`fixed inset-y-0 left-0 z-50 transition-transform duration-500 ease-fluid transform ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:static lg:translate-x-0 lg:p-4 overflow-hidden shrink-0 select-none`}
        >
          <div className="h-full w-[280px] flex flex-col p-6 neu-flat lg:rounded-[2.25rem] transform-gpu overflow-hidden">
            {/* Logo row - ALWAYS natural 1:1 scale, NEVER stretched */}
            <div className="flex items-center justify-between mb-8 shrink-0">
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
                    className="neu-flat-sm w-11 h-11 rounded-2xl flex items-center justify-center text-primary cursor-pointer active:scale-95 transition-all shrink-0 shadow-sm group hover:text-primary-600"
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
                      <Heart className="w-5 h-5 text-primary fill-primary group-hover:scale-110 transition-transform duration-200" />
                    </motion.div>
                  </motion.button>
                ) : (
                  <div className="w-11 h-11" />
                )}
                <Link to="/" className="flex items-center">
                  <span className="text-xl font-display font-extrabold text-primary tracking-tight">MuntiCares</span>
                </Link>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 p-2 neu-btn rounded-xl transition-all">
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
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* Nav section label */}
              <p className="text-3xs font-extrabold text-slate-400 uppercase tracking-widest px-4 mb-3">Navigation</p>

              {/* Nav links */}
              <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
                {links.map((link) => {
                  let badge = 0;
                  if (currentRole === 'patient') {
                    if (link.label === 'My Requests') badge = pendingCount;
                    if (link.label === 'Messages') badge = unreadMsgCount;
                  } else if (currentRole === 'provider') {
                    if (link.label === 'Incoming Requests') badge = pendingCount;
                    if (link.label === 'Messages') badge = unreadMsgCount;
                  }
                  return (
                    <SidebarItem 
                      key={link.label} 
                      icon={link.icon}
                      label={link.label}
                      to={link.to}
                      active={location.pathname === link.to}
                      onClick={() => setIsSidebarOpen(false)}
                      badge={badge}
                    />
                  );
                })}
              </nav>

              {/* Divider */}
              <div className="border-t border-slate-200/50 dark:border-white/5 my-4" />

              {/* User Info - Clickable Raised Neumorphic Card leading to Profile */}
              <Link 
                to={`/${currentRole}/profile`}
                onClick={() => setIsSidebarOpen(false)}
                className="group flex items-center gap-3 px-4 py-3 neu-flat-sm hover:neu-flat rounded-2xl mb-3 transition-all cursor-pointer active:scale-95"
                title="View Profile"
              >
                <div className="w-10 h-10 rounded-xl neu-flat-sm flex items-center justify-center text-primary font-bold text-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                  {authUser?.avatar_url ? (
                    <img src={authUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-primary transition-colors">{user.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 neu-flat-sm text-primary text-3xs font-black rounded-full uppercase tracking-wider mt-0.5">
                    {user.badge}
                  </span>
                </div>
              </Link>

              {/* Logout */}
              <button 
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="neu-btn flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all w-full group"
              >
                <div className="neu-flat-sm w-7 h-7 rounded-lg flex items-center justify-center group-hover:text-red-500">
                  <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-500 dark:group-hover:text-red-400" />
                </div>
                <span className="font-bold text-xs">Logout</span>
              </button>
            </motion.div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <div className={`flex-1 flex flex-col min-w-0 h-screen lg:p-4 ${isDesktopCollapsed ? 'lg:pl-4' : 'lg:pl-4'} transition-all duration-500`}>
          {/* Upper Panel Header - Raised Neumorphic Banner */}
          <header className="h-[76px] neu-flat lg:rounded-[2rem] flex items-center justify-between px-5 lg:px-7 shrink-0 lg:mb-4">
            <div className="flex items-center gap-3.5 min-w-0">
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
                  className="hidden lg:flex neu-btn w-11 h-11 rounded-2xl items-center justify-center text-primary cursor-pointer shrink-0 shadow-md group hover:text-primary-600"
                  title="Expand sidebar (click to expand)"
                >
                  <motion.div
                    initial={{ rotate: -360 }}
                    animate={{ rotate: 0 }}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <Heart className="w-5 h-5 text-primary fill-primary group-hover:scale-110 transition-transform duration-200" />
                  </motion.div>
                </motion.button>
              )}

              <div className="min-w-0">
              <h2 className="text-sm md:text-lg font-display font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[200px] md:max-w-none">
                Welcome{user.name ? `, ${user.name.split(' ')[0]}!` : '!'}
              </h2>
              <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle />
            <NotificationBell />
            <Link 
              to={`/${currentRole}/profile`} 
              className="neu-btn w-11 h-11 rounded-2xl flex items-center justify-center text-primary font-black shadow-sm shrink-0 hover:scale-105 transition-transform cursor-pointer overflow-hidden"
              title="Profile"
            >
              {authUser?.avatar_url ? (
                <img src={authUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user.initials
              )}
            </Link>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full p-4 sm:p-6 lg:p-7 pb-28 lg:pb-10 neu-flat lg:rounded-[2.25rem] flex flex-col">
          <div className="w-full max-w-full p-1 flex-1 flex flex-col">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>

      {/* Mobile Bottom Navigation */}
      <div 
        id="mobile-bottom-nav" 
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-3 mb-3 rounded-2xl neu-flat">
          <div className="flex items-center justify-around px-1 py-1">
            {(() => {
              const mobileLinks = buildMobileLinks(links);
                return mobileLinks.map((link, i) => {
                  let badge = 0;
                  if (currentRole === 'patient') {
                    if (link.label === 'My Requests') badge = pendingCount;
                    if (link.label === 'Messages') badge = unreadMsgCount;
                  } else if (currentRole === 'provider') {
                    if (link.label === 'Incoming Requests') badge = pendingCount;
                    if (link.label === 'Messages') badge = unreadMsgCount;
                  }
                  return (
                    <MobileNavItem 
                      key={link.label}
                      icon={link.icon}
                      label={link.shortLabel || link.label}
                      to={link.to}
                      active={location.pathname === link.to || location.pathname.startsWith(link.to + '/')}
                      badge={badge}
                      prominent={i === 2}
                    />
                  );
                });
              })()}
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardLayout;
