import WebPushControl from './WebPushControl';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  FileText,
  ChatCircle,
  Star,
  CheckCircle,
  XCircle,
  NavigationArrow,
  Clock,
  X,
} from '@phosphor-icons/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDate, formatLocalizedTime, translate, translateServiceName, translateStatus } from '@/i18n';
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
    case 'request_accepted': return <CheckCircle className="w-4 h-4" />;
    case 'request_rejected': return <XCircle className="w-4 h-4" />;
    case 'status_on_the_way': return <NavigationArrow className="w-4 h-4" />;
    case 'status_arrived': return <CheckCircle className="w-4 h-4" />;
    case 'status_completed': return <Star className="w-4 h-4" />;
    case 'new_request': return <FileText className="w-4 h-4" />;
    case 'new_message': return <ChatCircle className="w-4 h-4" />;
    case 'request_cancelled': return <XCircle className="w-4 h-4" />;
    default: return <Bell className="w-4 h-4" />;
  }
};

const timeAgo = (dateStr, language = 'en') => {
  if (!dateStr) return translate(language, 'notif.justNow');
  const now = new Date();
  let then = new Date(dateStr);

  if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !/[-+]\d{2}:\d{2}$/.test(dateStr)) {
    then = new Date(dateStr.includes('T') ? `${dateStr}Z` : `${dateStr.replace(' ', 'T')}Z`);
  }

  const diffMs = now - then;
  if (diffMs <= 0) return translate(language, 'notif.justNow');

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return translate(language, 'notif.justNow');
  if (diffMins < 60) return translate(language, 'notif.minsAgo', { count: diffMins });
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return translate(language, 'notif.hrsAgo', { count: diffHrs });
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return translate(language, 'notif.daysAgo', { count: diffDays });
  return formatLocalizedDate(then, language, { month: 'short', day: 'numeric' });
};

const formatNotifClock = (dateStr, language = 'en') => {
  if (!dateStr) return '';
  let date = new Date(dateStr);
  if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !/[-+]\d{2}:\d{2}$/.test(dateStr)) {
    date = new Date(dateStr.includes('T') ? `${dateStr}Z` : `${dateStr.replace(' ', 'T')}Z`);
  }
  if (isNaN(date.getTime())) return '';
  return formatLocalizedTime(date, language, { hour: 'numeric', minute: '2-digit', hour12: true });
};

const getNotifTone = (type) => {
  switch (type) {
    case 'request_cancelled':
    case 'request_rejected':
      return 'bg-danger-soft dark:bg-danger-darkSoft text-danger dark:text-danger-dark';
    case 'status_on_the_way':
      return 'bg-warning-soft dark:bg-warning-darkSoft text-warning dark:text-warning-dark';
    case 'status_completed':
    case 'request_accepted':
      return 'bg-success-soft dark:bg-success-darkSoft text-success dark:text-success-dark';
    case 'status_arrived':
    case 'new_request':
    case 'new_message':
    default:
      return 'bg-primary/10 dark:bg-primary/20 text-link';
  }
};

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread' | 'bookings'
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 16 });
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const prevNotifsRef = useRef({ userId: null, initialized: false, items: [] });
  const isFetchingRef = useRef(false);
  const isUpdatingPosRef = useRef(false);
  const { user } = useAuth();
  const { uiScale } = useTheme();
  const { language, t } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const updatePanelPos = useCallback(() => {
    if (!buttonRef.current || isUpdatingPosRef.current) return;
    isUpdatingPosRef.current = true;
    requestAnimationFrame(() => {
      isUpdatingPosRef.current = false;
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      const scaledDesktop = Math.round(400 * uiScale);
      const scaledMobile = Math.round(380 * uiScale);
      const width = isMobile ? Math.min(window.innerWidth - 24, scaledMobile) : Math.min(window.innerWidth - 32, scaledDesktop);
      const right = isMobile ? Math.max(12, (window.innerWidth - width) / 2) : Math.max(16, window.innerWidth - rect.right - (scaledDesktop - width) / 2);
      
      setPanelPos(prev => {
        const nextTop = rect.bottom + Math.round(12 * uiScale);
        if (prev.top === nextTop && prev.right === right && prev.width === width) {
          return prev;
        }
        return { top: nextTop, right, width };
      });
    });
  }, [uiScale]);

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

  const generateNotifications = (requests, role, lang = 'en') => {
    const notifs = [];

    requests.forEach(req => {
      const providerName = req.provider?.full_name || translate(lang, 'common.roles.provider');
      const patientName = req.patient?.full_name || translate(lang, 'common.roles.patient');
      const serviceLabel = translateServiceName(req.service, lang);
      const timestamp = req.created_at;

      if (role === 'patient') {
        switch (req.status) {
          case 'Pending':
            notifs.push({
              id: `${req.id}-pending`,
              type: 'new_request',
              title: translate(lang, 'notif.patientPendingTitle'),
              message: translate(lang, 'notif.patientPendingMsg', { service: serviceLabel }),
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'Cancelled':
            notifs.push({
              id: `${req.id}-cancelled`,
              type: 'request_cancelled',
              title: translate(lang, 'notif.patientCancelledTitle'),
              message: translate(lang, 'notif.patientCancelledMsg', { service: serviceLabel }),
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'Accepted':
            notifs.push({
              id: `${req.id}-accepted`,
              type: 'request_accepted',
              title: translate(lang, 'notif.patientAcceptedTitle'),
              message: translate(lang, 'notif.patientAcceptedMsg', { provider: providerName, service: serviceLabel }),
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'Rejected':
            notifs.push({
              id: `${req.id}-rejected`,
              type: 'request_rejected',
              title: translate(lang, 'notif.patientRejectedTitle'),
              message: translate(lang, 'notif.patientRejectedMsg', { provider: providerName }),
              time: timestamp,
              link: '/patient/requests'
            });
            break;
          case 'On The Way':
            notifs.push({
              id: `${req.id}-otw`,
              type: 'status_on_the_way',
              title: translate(lang, 'notif.patientOtwTitle'),
              message: translate(lang, 'notif.patientOtwMsg', { provider: providerName }),
              time: timestamp,
              link: '/patient/dashboard'
            });
            break;
          case 'Arrived':
            notifs.push({
              id: `${req.id}-arrived`,
              type: 'status_arrived',
              title: translate(lang, 'notif.patientArrivedTitle'),
              message: translate(lang, 'notif.patientArrivedMsg', { provider: providerName }),
              time: timestamp,
              link: '/patient/dashboard'
            });
            break;
          case 'Completed':
            notifs.push({
              id: `${req.id}-completed`,
              type: 'status_completed',
              title: translate(lang, 'notif.patientCompletedTitle'),
              message: translate(lang, 'notif.patientCompletedMsg', { provider: providerName }),
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
              title: translate(lang, 'notif.providerNewTitle'),
              message: translate(lang, 'notif.providerNewMsg', { patient: patientName, service: serviceLabel }),
              time: timestamp,
              link: '/provider/requests'
            });
            break;
          case 'Cancelled':
            notifs.push({
              id: `${req.id}-cancelled`,
              type: 'request_cancelled',
              title: translate(lang, 'notif.providerCancelledTitle'),
              message: translate(lang, 'notif.providerCancelledMsg', { patient: patientName, service: serviceLabel }),
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
              title: translate(lang, 'notif.adminPendingTitle'),
              message: translate(lang, 'notif.adminPendingMsg', { patient: patientName, service: serviceLabel, provider: providerName }),
              time: timestamp,
              link: '/admin/requests'
            });
            break;
          case 'Completed':
            notifs.push({
              id: `${req.id}-admin-completed`,
              type: 'status_completed',
              title: translate(lang, 'notif.adminCompletedTitle'),
              message: translate(lang, 'notif.adminCompletedMsg', { provider: providerName, service: serviceLabel, patient: patientName }),
              time: timestamp,
              link: '/admin/requests'
            });
            break;
          case 'Cancelled':
            notifs.push({
              id: `${req.id}-admin-cancelled`,
              type: 'request_cancelled',
              title: translate(lang, 'notif.adminCancelledTitle'),
              message: translate(lang, 'notif.adminCancelledMsg', { patient: patientName, service: serviceLabel }),
              time: timestamp,
              link: '/admin/requests'
            });
            break;
          default:
            notifs.push({
              id: `${req.id}-admin-${req.status?.toLowerCase()}`,
              type: 'new_request',
              title: translate(lang, 'notif.adminStatusTitle', { status: translateStatus(req.status, lang) }),
              message: translate(lang, 'notif.adminStatusMsg', { patient: patientName, service: serviceLabel, provider: providerName }),
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

  const readStoredList = (key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // A corrupt key must not silence the whole bell.
      localStorage.removeItem(key);
      return [];
    }
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

      const activeLang = languageRef.current;
      const notifs = generateNotifications(data || [], user.role, activeLang);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: msgData } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, is_read, message_type, sender:sender_id(full_name)')
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(60);

      if (msgData) {
        let readMsgIds = new Set();
        try {
          readMsgIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
        } catch {}
        const unreadMsgs = msgData.filter(m => !m.is_read && !readMsgIds.has(m.id));
        const seenSenders = new Set();
        unreadMsgs.forEach(msg => {
          const senderName = msg.sender?.full_name || translate(activeLang, 'notif.someone');
          if (!seenSenders.has(msg.sender_id)) {
            seenSenders.add(msg.sender_id);
            let previewText = msg.content || '';
            const isImg = msg.message_type === 'image' || (msg.content && /\.(jpg|jpeg|png|webp|gif|heic)(\?.*)?$/i.test(msg.content.split('\n')[0]));
            const isVid = msg.message_type === 'video' || (msg.content && /\.(mp4|webm|mov|ogg|3gp)(\?.*)?$/i.test(msg.content.split('\n')[0]));
            if (isImg) {
              const cap = msg.content?.split('\n').slice(1).join('\n').trim();
              previewText = cap ? `📷 ${cap}` : `📷 ${translate(activeLang, 'notif.photoPreview')}`;
            } else if (isVid) {
              const cap = msg.content?.split('\n').slice(1).join('\n').trim();
              previewText = cap ? `🎥 ${cap}` : `🎥 ${translate(activeLang, 'notif.videoPreview')}`;
            } else if (msg.message_type === 'call') {
              previewText = translate(activeLang, 'notif.callPreview');
            }
            notifs.push({
              id: `msg-${msg.id}`,
              type: 'new_message',
              title: translate(activeLang, 'notif.newMessageTitle', { sender: senderName }),
              message: previewText.substring(0, 80),
              time: msg.created_at,
              link: user.role === 'patient' ? '/patient/messages' : '/provider/messages',
            });
          }
        });
      }

      notifs.sort((a, b) => new Date(b.time) - new Date(a.time));

      const dismissed = readStoredList(`dismissed_notifs_${user.id}`);
      const activeNotifs = notifs.filter(n => !dismissed.includes(n.id));

      const seenToastKey = `seen_toast_notifs_${user.id}`;
      const seenToastIds = new Set(readStoredList(seenToastKey));
      const readKey = `read_notifs_${user.id}`;
      const readIds = new Set(readStoredList(readKey));

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
          // Message text is PHI: it stays inside the app, the OS tray gets a pointer only.
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

    // Realtime already fires on every request/message change; this is only a
    // backstop for dropped sockets, so it must not cost two queries per second.
    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 15000);

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

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [language, user?.id, fetchNotifications]);

  const markAllAsRead = (e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const allIds = notifications.map(n => n.id);
    const existingRead = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
    const nextRead = Array.from(new Set([...existingRead, ...allIds]));
    localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(nextRead));
    setUnreadCount(0);
    toast.success(t('notif.markedAllRead'));
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
    toast.success(t('notif.clearedAll'));
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

  const filteredNotifications = useMemo(() => {
    let list = [...notifications];
    if (filterTab === 'unread') {
      list = list.filter(n => unreadNotifications.some(u => u.id === n.id));
    } else if (filterTab === 'bookings') {
      list = list.filter(n => n.type.includes('request') || n.type.includes('status'));
    }
    return list.sort((a, b) => {
      const aUnread = unreadNotifications.some(n => n.id === a.id) ? 0 : 1;
      const bUnread = unreadNotifications.some(n => n.id === b.id) ? 0 : 1;
      if (aUnread !== bUnread) return aUnread - bUnread;
      return new Date(b.time) - new Date(a.time);
    });
  }, [notifications, filterTab, unreadNotifications]);

  return (
    <div className="relative">
      {/* Bell Button (Strictly NO capsule pill counter) */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `${t('notif.header')} (${t('notif.newCount', { count: unreadCount })})` : t('notif.header')}
        className={`neu-btn w-11 h-11 transition-all relative rounded-2xl flex items-center justify-center cursor-pointer ${
          isOpen ? 'neu-pressed text-link shadow-inner' : 'text-txt-secondary dark:text-txt-darkSecondary hover:text-link'
        }`}
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <motion.span
            className="absolute -top-1 -right-1 min-w-[1.25rem] h-[1.25rem] bg-danger rounded-md sm:rounded-lg border-2 border-surface dark:border-surface-dark flex items-center justify-center text-[0.6875rem] font-extrabold leading-none tabular-nums text-white px-1 shadow-md"
            initial={prefersReducedMotion ? false : { scale: 0 }}
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
            role="dialog"
            aria-label={t('notif.header')}
            className="fixed neu-flat rounded-3xl overflow-hidden transform-gpu will-change-transform shadow-card bg-surface-shell dark:bg-surface-dark border border-surface-border/80 dark:border-white/10"
            style={{ 
              top: panelPos.top, 
              right: panelPos.right, 
              width: panelPos.width || 392, 
              maxHeight: 'calc(100dvh - 5.5rem)',
              zIndex: 'var(--z-popover)',
              contain: 'paint layout'
            }}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.18, ease: [0.32, 0.72, 0, 1] }}
          >
            <div ref={panelRef} className="w-full h-full flex flex-col bg-surface-shell dark:bg-surface-dark">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-surface-border/70 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-display font-bold text-base text-txt-primary dark:text-txt-darkPrimary tracking-tight truncate">
                    {t('notif.header')}
                  </h2>
                  {unreadCount > 0 && (
                    <span className="whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-primary/10 dark:bg-primary/20 text-link">
                      {t('notif.newCount', { count: unreadCount })}
                    </span>
                  )}
                </div>
                {(user?.role === 'patient' || user?.role === 'provider') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      window.dispatchEvent(new Event('munticares-open-weekly-updates'));
                    }}
                    className="whitespace-nowrap shrink-0 px-3 h-8 rounded-xl text-xs font-bold text-link bg-primary/10 hover:bg-primary/15 dark:bg-primary/15 dark:hover:bg-primary/25 transition-colors cursor-pointer active:scale-95"
                    title={t('notif.updatesTitle')}
                  >
                    {t('notif.updatesBtn')}
                  </button>
                )}
              </div>

              {/* Segmented Filter Track */}
              <div className="px-3 sm:px-4 py-2.5 border-b border-surface-border/70 dark:border-white/10 bg-surface-subtle/45 dark:bg-surface-darkAlt/40 shrink-0">
                <div
                  role="tablist"
                  aria-label={t('notif.header')}
                  className="p-1 rounded-2xl bg-surface-subtle dark:bg-surface-darkAlt/70 border border-surface-border/70 dark:border-white/10 flex items-center gap-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterTab === 'all'}
                    onClick={() => setFilterTab('all')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all text-center cursor-pointer ${
                      filterTab === 'all'
                        ? 'bg-surface dark:bg-surface-dark text-link shadow-soft font-bold'
                        : 'text-tertiary font-semibold hover:text-txt-primary dark:hover:text-txt-darkPrimary'
                    }`}
                  >
                    {t('notif.tabAll', { count: notifications.length })}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterTab === 'unread'}
                    onClick={() => setFilterTab('unread')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all text-center cursor-pointer ${
                      filterTab === 'unread'
                        ? 'bg-surface dark:bg-surface-dark text-link shadow-soft font-bold'
                        : 'text-tertiary font-semibold hover:text-txt-primary dark:hover:text-txt-darkPrimary'
                    }`}
                  >
                    {t('notif.tabUnread', { count: unreadCount })}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterTab === 'bookings'}
                    onClick={() => setFilterTab('bookings')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs whitespace-nowrap transition-all text-center cursor-pointer ${
                      filterTab === 'bookings'
                        ? 'bg-surface dark:bg-surface-dark text-link shadow-soft font-bold'
                        : 'text-tertiary font-semibold hover:text-txt-primary dark:hover:text-txt-darkPrimary'
                    }`}
                  >
                    {t('notif.tabBookings')}
                  </button>
                </div>
              </div>

              <WebPushControl />
              {/* Notification List */}
              <div 
                className="max-h-[21.875rem] sm:max-h-[23.75rem] overflow-y-auto overscroll-contain p-3 space-y-2.5"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-y'
                }}
              >
                {filteredNotifications.length > 0 ? (
                  <AnimatePresence initial={false}>
                    {filteredNotifications.map((notif, idx) => {
                      const isUnread = unreadNotifications.some((n) => n.id === notif.id);
                      const toneClass = getNotifTone(notif.type);
                      return (
                        <motion.div
                          key={notif.id}
                          layout={!prefersReducedMotion}
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -80, height: 0, marginBottom: 0, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }}
                          transition={{ 
                            duration: prefersReducedMotion ? 0.01 : 0.22,
                            ease: [0.32, 0.72, 0, 1],
                            delay: prefersReducedMotion ? 0 : Math.min(idx * 0.025, 0.12) 
                          }}
                          drag={prefersReducedMotion ? false : 'x'}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.4}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < -80 || info.offset.x > 80) {
                              dismissNotification({ stopPropagation: () => {} }, notif.id);
                            }
                          }}
                          className={`relative rounded-2xl border transition-colors group ${
                            isUnread 
                              ? 'bg-surface dark:bg-surface-darkAlt border-primary/20 dark:border-primary-400/20 shadow-soft' 
                              : 'bg-surface-subtle/60 dark:bg-surface-dark/70 border-surface-border/70 dark:border-white/10 opacity-85 hover:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleNotifClick(notif)}
                            className="w-full text-left p-3.5 pr-11 flex items-start gap-3 rounded-2xl cursor-pointer active:scale-[0.99] transition-transform"
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${toneClass}`} aria-hidden="true">
                              {getNotifIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={`text-sm truncate ${isUnread ? 'font-bold text-txt-primary dark:text-txt-darkPrimary' : 'font-semibold text-txt-secondary dark:text-txt-darkSecondary'}`}>
                                  {notif.title}
                                </p>
                                {isUnread && (
                                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-primary/10 dark:bg-primary/20 text-link shrink-0">
                                    {t('notif.newBadge')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-txt-secondary dark:text-txt-darkSecondary line-clamp-2 mt-0.5 leading-relaxed">
                                {notif.message}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-tertiary font-medium tabular-nums">
                                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span>{timeAgo(notif.time, language)}</span>
                                {formatNotifClock(notif.time, language) && (
                                  <>
                                    <span aria-hidden="true">&bull;</span>
                                    <span>{formatNotifClock(notif.time, language)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => dismissNotification(e, notif.id)}
                            aria-label={t('notif.dismissTitle')}
                            className="absolute top-3 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-tertiary opacity-60 hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-subtle dark:hover:bg-white/10 hover:text-txt-primary dark:hover:text-white transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <motion.div 
                    key="empty-notifs" className="neu-inset p-8 rounded-2xl text-center"
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-success-soft dark:bg-success-darkSoft flex items-center justify-center mx-auto mb-2.5 text-success dark:text-success-dark">
                      <CheckCircle className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-txt-primary dark:text-txt-darkPrimary font-bold">{t('notif.emptyTitle')}</p>
                    <p className="text-xs text-tertiary mt-1">{t('notif.emptySubtitle')}</p>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 sm:px-5 py-2.5 border-t border-surface-border/70 dark:border-white/10 flex items-center justify-between gap-2 text-xs font-medium bg-surface-shell dark:bg-surface-dark shrink-0">
                  <span className="text-tertiary truncate">
                    {notifications.length === 1
                      ? t('notif.footerCountOne', { shown: filteredNotifications.length, total: notifications.length })
                      : t('notif.footerCountMany', { shown: filteredNotifications.length, total: notifications.length })}
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs font-bold text-link hover:underline whitespace-nowrap cursor-pointer"
                        title={t('notif.markReadTitle')}
                      >
                        {t('notif.markRead')}
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-success dark:text-success-dark whitespace-nowrap">
                        {t('notif.allCaughtUp')}
                      </span>
                    )}
                    <span aria-hidden="true" className="text-tertiary/50">&bull;</span>
                    <button
                      type="button"
                      onClick={clearAllNotifications}
                      className="text-xs font-semibold text-tertiary hover:text-danger dark:hover:text-danger-dark whitespace-nowrap transition-colors cursor-pointer"
                      title={t('notif.clearAllTitle')}
                    >
                      {t('notif.clearAll')}
                    </button>
                  </div>
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
