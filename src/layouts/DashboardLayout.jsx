import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  Search, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Heart,
  Users,
  Briefcase,
  Bell,
  ChevronLeft,
  CalendarDays,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const SidebarItem = ({ icon, label, to, active, onClick, badge }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group relative ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-primary'}`}
  >
    <motion.div
      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-primary rounded-r-full"
      initial={false}
      animate={{ 
        height: active ? '60%' : '0%',
        opacity: active ? 1 : 0,
      }}
      transition={{ duration: 0.2 }}
    />
    {React.cloneElement(icon, { className: `w-5 h-5 ${active ? 'text-white' : 'text-slate-400 group-hover:text-primary'}` })}
    <span className="font-semibold flex-1">{label}</span>
    {badge > 0 && (
      <span className={`min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[9px] font-bold px-1.5 ${
        active ? 'bg-white text-primary' : 'bg-red-500 text-white'
      }`}>
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </Link>
);

const MobileNavItem = ({ icon, label, to, active, badge }) => (
  <Link 
    to={to}
    className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all relative ${active ? 'text-primary' : 'text-slate-400'}`}
  >
    <div className="relative">
      {React.cloneElement(icon, { className: `w-5 h-5 ${active ? 'text-primary' : 'text-slate-400'}` })}
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-[7px] font-bold text-white px-0.5">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
    <span className={`text-[10px] font-bold ${active ? 'text-primary' : 'text-slate-400'}`}>{label}</span>
    {active && (
      <motion.div 
        className="w-1 h-1 bg-primary rounded-full"
        layoutId="mobile-indicator"
      />
    )}
  </Link>
);

const DashboardLayout = ({ children, role = 'patient' }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();

  const patientLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/patient/dashboard' },
    { icon: <Search />, label: 'Find Providers', to: '/patient/providers' },
    { icon: <FileText />, label: 'My Requests', to: '/patient/requests' },
    { icon: <MessageCircle />, label: 'Messages', to: '/patient/messages' },
    { icon: <Settings />, label: 'Consent Settings', to: '/patient/consent' },
  ];

  const providerLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/provider/dashboard' },
    { icon: <Bell />, label: 'Incoming Requests', to: '/provider/requests' },
    { icon: <Users />, label: 'My Patients', to: '/provider/patients' },
    { icon: <CalendarDays />, label: 'My Schedule', to: '/provider/schedule' },
    { icon: <MessageCircle />, label: 'Messages', to: '/provider/messages' },
  ];

  const adminLinks = [
    { icon: <LayoutDashboard />, label: 'Overview', to: '/admin/dashboard' },
    { icon: <Users />, label: 'Patients', to: '/admin/patients' },
    { icon: <Briefcase />, label: 'Providers', to: '/admin/providers' },
    { icon: <FileText />, label: 'Requests', to: '/admin/requests' },
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

    const channel = supabase
      .channel('layout-counts')
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
      supabase.removeChannel(channel);
      window.removeEventListener('messages-read', onMessagesRead);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [authUser, fetchCounts, deleteOldMessages]);

  useEffect(() => {
    fetchCounts();
  }, [location.pathname, fetchCounts]);

  return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex overflow-hidden">
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

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}>
        <div className="h-full flex flex-col p-6">
          {/* Logo */}
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-primary p-2 rounded-lg group-hover:rotate-12 transition-transform">
                <Heart className="text-white w-5 h-5" fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-primary tracking-tight">MuntiCares</span>
            </Link>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Nav section label */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-3">Navigation</p>

          {/* Nav links */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
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
          <div className="border-t border-slate-100 dark:border-slate-700 my-4" />

          {/* User Info */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{user.name}</p>
              <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider">
                {user.badge}
              </span>
            </div>
          </div>

          {/* Logout */}
          <button 
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-all w-full group"
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-500 dark:group-hover:text-red-400" />
            <span className="font-semibold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-20 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between px-4 lg:px-10 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h2 className="text-sm md:text-lg font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] md:max-w-none">
                Welcome{user.name ? `, ${user.name.split(' ')[0]}!` : '!'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <NotificationBell />
            <Link 
              to={`/${currentRole}/profile`} 
              className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-primary font-bold shadow-sm border border-white dark:border-slate-800 shrink-0 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
            >
              {user.initials}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10 pb-24 lg:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div id="mobile-bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
        <div className="flex items-center justify-around px-1 py-1">
          {links.slice(0, 5).map((link) => {
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
                label={link.label.split(' ').pop()}
                to={link.to}
                active={location.pathname === link.to}
                badge={badge}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const User = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default DashboardLayout;
