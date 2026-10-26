import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, FileText, MessageCircle, Star, CheckCircle2, XCircle, Navigation, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const playChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Web Audio API not available
  }
};

const getNotifIcon = (type) => {
  switch (type) {
    case 'request_accepted': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'request_rejected': return <XCircle className="w-4 h-4 text-red-500" />;
    case 'status_on_the_way': return <Navigation className="w-4 h-4 text-amber-500" />;
    case 'status_arrived': return <CheckCircle2 className="w-4 h-4 text-purple-500" />;
    case 'status_completed': return <Star className="w-4 h-4 text-green-500" />;
    case 'new_request': return <FileText className="w-4 h-4 text-blue-500" />;
    case 'new_message': return <MessageCircle className="w-4 h-4 text-primary" />;
    case 'request_cancelled': return <XCircle className="w-4 h-4 text-slate-400" />;
    default: return <Bell className="w-4 h-4 text-slate-400" />;
  }
};

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Just now';
  const now = new Date();
  let then = new Date(dateStr);

  if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !/[-+]\d{2}:\d{2}$/.test(dateStr)) {
    then = new Date(dateStr.includes('T') ? `${dateStr}Z` : `${dateStr.replace(' ', 'T')}Z`);
  }

  const diffMs = now - then;
  if (diffMs <= 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 16 });
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const prevNotifsRef = useRef({ userId: null, initialized: false, items: [] });
  const isFetchingRef = useRef(false);
  const isUpdatingPosRef = useRef(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const updatePanelPos = useCallback(() => {
    if (!buttonRef.current || isUpdatingPosRef.current) return;
    isUpdatingPosRef.current = true;
    requestAnimationFrame(() => {
      isUpdatingPosRef.current = false;
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      const width = isMobile ? Math.min(window.innerWidth - 24, 380) : 384;
      const right = isMobile ? Math.max(12, (window.innerWidth - width) / 2) : Math.max(16, window.innerWidth - rect.right - (384 - width) / 2);
      
      setPanelPos(prev => {
        const nextTop = rect.bottom + 12;
        if (prev.top === nextTop && prev.right === right && prev.width === width) {
          return prev;
        }
        return { top: nextTop, right, width };
      });
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePanelPos();
    window.addEventListener('resize', updatePanelPos, { passive: true });
    window.addEventListener('scroll', updatePanelPos, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePanelPos);
      window.removeEventListener('scroll', updatePanelPos);
    };
  }, [isOpen, updatePanelPos]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      const inButton = buttonRef.current && buttonRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inButton && !inPanel) setIsOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const generateNotifications = (requests, role) => {
    const notifs = [];

    requests.forEach(req => {
      const providerName = req.provider?.full_name || 'Provider';
      const patientName = req.patient?.full_name || 'Patient';
      const timestamp = req.created_at;

      if (role === 'patient') {
        switch (req.status) {
          case 'Pending':
            notifs.push({
              id: `${req.id}-pending`,
              type: 'new_request',
              title: 'Booking Requested',
              message: `Your request for ${req.service} has been sent and is pending approval.`,
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'Cancelled':
            notifs.push({
              id: `${req.id}-cancelled`,
              type: 'request_cancelled',
              title: 'Booking Cancelled',
              message: `You cancelled your request for ${req.service}.`,
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'Accepted':
            notifs.push({
              id: `${req.id}-accepted`,
              type: 'request_accepted',
              title: 'Request Accepted!',
              message: `${providerName} accepted your ${req.service} booking.`,
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'Rejected':
            notifs.push({
              id: `${req.id}-rejected`,
              type: 'request_rejected',
              title: 'Request Declined',
              message: `${providerName} was unable to accept your request.`,
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'On The Way':
            notifs.push({
              id: `${req.id}-otw`,
              type: 'status_on_the_way',
              title: 'Provider On The Way!',
              message: `${providerName} is heading to your location.`,
              time: timestamp,
              link: '/patient/dashboard'
            });
            break;
          case 'Arrived':
            notifs.push({
              id: `${req.id}-arrived`,
              type: 'status_arrived',
              title: 'Provider Has Arrived',
              message: `${providerName} is at your doorstep.`,
              time: timestamp,
              link: '/patient/dashboard'
            });
            break;
          case 'Completed':
            notifs.push({
              id: `${req.id}-completed`,
              type: 'status_completed',
              title: 'Visit Completed',
              message: `Your session with ${providerName} is done. Rate your experience!`,
              time: timestamp,
              link: '/patient/requests'
            });
            break;
        }
      } else if (role === 'provider') {
        switch (req.status) {
          case 'Pending':
            notifs.push({
              id: `${req.id}-new`,
              type: 'new_request',
              title: 'New Booking Request',
              message: `${patientName} is requesting ${req.service}.`,
              time: timestamp,
              link: '/provider/requests'
            });
            break;
          case 'Cancelled':
            notifs.push({
              id: `${req.id}-cancelled`,
              type: 'request_cancelled',
              title: 'Request Cancelled',
              message: `${patientName} cancelled their ${req.service} booking.`,
              time: timestamp,
              link: '/provider/schedule'
            });
            break;
        }
      } else if (role === 'admin') {
        switch (req.status) {
          case 'Pending':
            notifs.push({
              id: `${req.id}-admin-pending`,
              type: 'new_request',
              title: 'Pending Platform Request',
              message: `${patientName} requested ${req.service} from ${providerName}.`,
              time: timestamp,
              link: '/admin/requests'
            });
            break;
          case 'Completed':
            notifs.push({
              id: `${req.id}-admin-completed`,
              type: 'status_completed',
              title: 'Service Completed',
              message: `${providerName} completed ${req.service} for ${patientName}.`,
              time: timestamp,
              link: '/admin/requests'
            });
            break;
          case 'Cancelled':
            notifs.push({
              id: `${req.id}-admin-cancelled`,
              type: 'request_cancelled',
              title: 'Request Cancelled',
              message: `${patientName}'s ${req.service} booking was cancelled.`,
              time: timestamp,
              link: '/admin/requests'
            });
            break;
          default:
            notifs.push({
              id: `${req.id}-admin-${req.status?.toLowerCase()}`,
              type: 'new_request',
              title: `Request ${req.status}`,
              message: `${patientName} — ${req.service} (${providerName})`,
              time: timestamp,
              link: '/admin/requests'
            });
            break;
        }
      }
    });

    notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
    return notifs.slice(0, 20);
  };

  const fireBrowserNotification = (title, body) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch {}
  };

  const fetchNotifications = useCallback(async () => {
    if (!user?.id || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      let reqQuery = supabase
        .from('requests')
        .select('id, status, service, created_at, patient:patient_id(full_name), provider:provider_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(30);

      if (user.role !== 'admin') {
        const isPatient = user.role === 'patient';
        const filterCol = isPatient ? 'patient_id' : 'provider_id';
        reqQuery = reqQuery.eq(filterCol, user.id);
      }

      const { data, error } = await reqQuery;

      if (error) throw error;

      const notifs = generateNotifications(data || [], user.role);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: msgData } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, is_read, sender:sender_id(full_name)')
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false });

      if (msgData) {
        let readMsgIds = new Set();
        try {
          readMsgIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
        } catch {}
        const unreadMsgs = msgData.filter(m => !m.is_read && !readMsgIds.has(m.id));
        const seenSenders = new Set();
        unreadMsgs.forEach(msg => {
          const senderName = msg.sender?.full_name || 'Someone';
          if (!seenSenders.has(msg.sender_id)) {
            seenSenders.add(msg.sender_id);
            notifs.push({
              id: `msg-${msg.id}`,
              type: 'new_message',
              title: `New Message from ${senderName}`,
              message: msg.content?.substring(0, 80),
              time: msg.created_at,
              link: user.role === 'patient' ? '/patient/messages' : '/provider/messages',
            });
          }
        });
      }

      notifs.sort((a, b) => new Date(b.time) - new Date(a.time));

      const dismissed = JSON.parse(localStorage.getItem(`dismissed_notifs_${user.id}`) || '[]');
      const activeNotifs = notifs.filter(n => !dismissed.includes(n.id));

      const seenToastKey = `seen_toast_notifs_${user.id}`;
      const seenToastIds = new Set(JSON.parse(localStorage.getItem(seenToastKey) || '[]'));
      const readKey = `read_notifs_${user.id}`;
      const readIds = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'));

      const isAlreadyInitialized =
        prevNotifsRef.current.userId === user.id && prevNotifsRef.current.initialized;

      if (isAlreadyInitialized) {
        // Only toast notifications that arrived AFTER login and have never been toasted before
        const newlyAdded = activeNotifs.filter(
          n => !seenToastIds.has(n.id) && !prevNotifsRef.current.items.some(pn => pn.id === n.id)
        );
        if (newlyAdded.length > 0) playChime();
        newlyAdded.forEach(notif => {
          seenToastIds.add(notif.id);
          toast(`${notif.title}: ${notif.message}`, { id: `bell-${notif.id}` });
          fireBrowserNotification(notif.title, notif.message);
        });
      } else {
        // Initial load on login: mark all pre-existing notifications as already seen so past
        // notifications NEVER pop up on login, and mark older (>24h) notifications as read.
        const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
        let readUpdated = false;
        activeNotifs.forEach(n => {
          seenToastIds.add(n.id);
          const t = new Date(n.time).getTime();
          if (!Number.isNaN(t) && t < oneDayAgoMs && !readIds.has(n.id)) {
            readIds.add(n.id);
            readUpdated = true;
          }
        });
        if (readUpdated) {
          localStorage.setItem(readKey, JSON.stringify(Array.from(readIds).slice(-300)));
        }
      }

      activeNotifs.forEach(n => seenToastIds.add(n.id));
      localStorage.setItem(seenToastKey, JSON.stringify(Array.from(seenToastIds).slice(-300)));

      prevNotifsRef.current = { userId: user.id, initialized: true, items: activeNotifs };
      setNotifications(activeNotifs);

      const unread = activeNotifs.filter(n => !readIds.has(n.id)).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchNotifications();

    if (!user?.id) return;

    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 1500);

    const filterCol = user.role === 'patient' ? 'patient_id' : 'provider_id';
    const reqChangeConfig = user.role === 'admin'
      ? { event: '*', schema: 'public', table: 'requests' }
      : { event: '*', schema: 'public', table: 'requests', filter: `${filterCol}=eq.${user.id}` };

    const channel = supabase
      .channel('notification-bell-changes')
      .on(
        'postgres_changes',
        reqChangeConfig,
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    const msgChannel = supabase
      .channel('notification-bell-msgs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    const onMessagesRead = () => fetchNotifications();
    window.addEventListener('messages-read', onMessagesRead);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('messages-read', onMessagesRead);
      supabase.removeChannel(channel);
      supabase.removeChannel(msgChannel);
    };
  }, [user, fetchNotifications]);

  const markAllAsRead = (e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const allIds = notifications.map(n => n.id);
    const existingRead = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
    const nextRead = Array.from(new Set([...existingRead, ...allIds]));
    localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(nextRead));
    setUnreadCount(0);
    toast.success('All notifications marked as read');
  };

  const clearAllNotifications = (e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const allIds = notifications.map(n => n.id);
    const existingDismissed = JSON.parse(localStorage.getItem(`dismissed_notifs_${user.id}`) || '[]');
    const nextDismissed = Array.from(new Set([...existingDismissed, ...allIds]));
    localStorage.setItem(`dismissed_notifs_${user.id}`, JSON.stringify(nextDismissed));
    setNotifications([]);
    setUnreadCount(0);
    toast.success('All notifications cleared');
  };

  const handleNotifClick = (notif) => {
    if (user) {
      const readIds = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
      if (!readIds.includes(notif.id)) {
        readIds.push(notif.id);
        localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(readIds));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    setIsOpen(false);
    if (notif.link) navigate(notif.link);
  };

  const dismissNotification = (e, id) => {
    e.stopPropagation();
    if (user) {
      const existingDismissed = JSON.parse(localStorage.getItem(`dismissed_notifs_${user.id}`) || '[]');
      const nextDismissed = Array.from(new Set([...existingDismissed, id]));
      localStorage.setItem(`dismissed_notifs_${user.id}`, JSON.stringify(nextDismissed));
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      const readIds = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
      if (!readIds.includes(id)) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const readIds = user ? JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]') : [];
  const unreadNotifications = notifications.filter(n => !readIds.includes(n.id));

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          setIsOpen(!isOpen);
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="neu-btn w-11 h-11 text-slate-600 dark:text-slate-300 hover:text-primary transition-all relative rounded-2xl flex items-center justify-center cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-3xs font-extrabold text-white px-1 shadow-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            key={unreadCount}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notification-dropdown-panel"
            className="fixed neu-flat rounded-3xl overflow-hidden transform-gpu will-change-transform shadow-2xl"
            style={{ 
              top: panelPos.top, 
              right: panelPos.right, 
              width: panelPos.width || 384, 
              maxHeight: 'calc(100vh - 90px)',
              zIndex: 200,
              contain: 'paint layout'
            }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div ref={panelRef} className="w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200/60 dark:border-white/5 bg-transparent">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">Notifications</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="neu-btn px-2.5 py-1 rounded-xl text-3xs font-extrabold text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary cursor-pointer active:scale-95"
                    title="Mark all notifications as read"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="neu-btn px-2.5 py-1 rounded-xl text-3xs font-extrabold text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 cursor-pointer active:scale-95"
                    title="Clear all notifications"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div 
              className="max-h-[350px] sm:max-h-[380px] overflow-y-auto overscroll-contain p-2.5 sm:p-3 space-y-2"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y'
              }}
            >
              {notifications.length > 0 ? (
                <AnimatePresence initial={false}>
                  {[...notifications].sort((a, b) => {
                    const aUnread = unreadNotifications.some((n) => n.id === a.id) ? 0 : 1;
                    const bUnread = unreadNotifications.some((n) => n.id === b.id) ? 0 : 1;
                    return aUnread - bUnread;
                  }).map((notif, idx) => {
                    const isUnread = unreadNotifications.some((n) => n.id === notif.id);
                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -100, height: 0, marginBottom: 0, transition: { duration: 0.22, ease: 'easeOut' } }}
                        transition={{ 
                          type: 'spring', 
                          damping: 24, 
                          stiffness: 280, 
                          delay: Math.min(idx * 0.03, 0.15) 
                        }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.4}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -80 || info.offset.x > 80) {
                            dismissNotification({ stopPropagation: () => {} }, notif.id);
                          }
                        }}
                        whileTap={{ scale: 0.985 }}
                        className={`w-full text-left p-3 sm:p-3.5 rounded-2xl flex items-start gap-3 transition-colors relative group cursor-pointer select-none ${
                          isUnread 
                            ? 'neu-flat border border-primary/25 bg-[#e4ecf6] dark:bg-[#1c2940]' 
                            : 'neu-flat-sm opacity-90 hover:opacity-100'
                        }`}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <motion.div 
                          className="neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          whileHover={{ scale: 1.08 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        >
                          {getNotifIcon(notif.type)}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs sm:text-[13px] truncate ${isUnread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
                              {notif.title}
                            </p>
                            {isUnread && <span className="w-2 h-2 bg-primary rounded-full shrink-0 shadow-sm animate-pulse" />}
                          </div>
                          <p className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{notif.message}</p>
                          <p className="text-3xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 font-semibold">
                            <Clock className="w-3 h-3" />
                            {timeAgo(notif.time)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <motion.div 
                  key="empty-notifs" className="neu-inset p-8 rounded-2xl text-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="neu-flat-sm w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 text-emerald-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-extrabold">You&apos;re all caught up!</p>
                  <p className="text-3xs sm:text-xs text-slate-400 mt-1">No notifications at the moment.</p>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-5 py-2.5 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-3xs text-slate-400 dark:text-slate-500 font-bold">
                <span>{notifications.length} notification{notifications.length > 1 ? 's' : ''}</span>
                {unreadCount > 0 && (
                  <span className="text-primary font-extrabold">{unreadCount} unread</span>
                )}
              </div>
            )}
          </div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default NotificationBell;
