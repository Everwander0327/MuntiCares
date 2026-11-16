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
import { motion, AnimatePresence } from 'framer-motion';
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
    case 'request_accepted': return <CheckCircle className="w-4 h-4 text-success" />;
    case 'request_rejected': return <XCircle className="w-4 h-4 text-danger" />;
    case 'status_on_the_way': return <NavigationArrow className="w-4 h-4 text-warning" />;
    case 'status_arrived': return <CheckCircle className="w-4 h-4 text-link" />;
    case 'status_completed': return <Star className="w-4 h-4 text-success" />;
    case 'new_request': return <FileText className="w-4 h-4 text-link" />;
    case 'new_message': return <ChatCircle className="w-4 h-4 text-link" />;
    case 'request_cancelled': return <XCircle className="w-4 h-4 text-tertiary" />;
    default: return <Bell className="w-4 h-4 text-tertiary" />;
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

const getNotifAccent = (type) => {
  switch (type) {
    case 'request_cancelled':
    case 'request_rejected':
      return {
        border: 'border-l-4 border-l-rose-500',
        badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/25',
        iconBg: 'neu-inset text-rose-500 dark:text-rose-400'
      };
    case 'status_on_the_way':
      return {
        border: 'border-l-4 border-l-amber-500',
        badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25',
        iconBg: 'neu-inset text-amber-500 dark:text-amber-400'
      };
    case 'status_arrived':
    case 'status_completed':
    case 'request_accepted':
      return {
        border: 'border-l-4 border-l-emerald-500',
        badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25',
        iconBg: 'neu-inset text-emerald-500 dark:text-emerald-400'
      };
    case 'new_request':
    case 'new_message':
    default:
      return {
        border: 'border-l-4 border-l-blue-500',
        badgeBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/25',
        iconBg: 'neu-inset text-blue-500 dark:text-blue-400'
      };
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

  const fireBrowserNotification = (title, body) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch {}
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
          fireBrowserNotification(
            notif.title,
            notif.type === 'new_message' ? translate(activeLang, 'notif.osMessageBody') : notif.message
          );
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
        onClick={() => {
          setIsOpen(!isOpen);
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`neu-btn w-11 h-11 transition-all relative rounded-2xl flex items-center justify-center cursor-pointer ${
          isOpen ? 'neu-pressed text-link shadow-inner' : 'text-slate-600 dark:text-slate-300 hover:text-link'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            className="absolute -top-1 -right-1 min-w-[1.25rem] h-[1.25rem] bg-danger rounded-md sm:rounded-lg border-2 border-white dark:border-surface-dark flex items-center justify-center text-3xs font-black text-white px-1 shadow-md"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            key={unreadCount}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel (Option 1: Linear Micro-Feed with Segmented Track) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notification-dropdown-panel"
            className="fixed neu-flat rounded-3xl overflow-hidden transform-gpu will-change-transform shadow-2xl bg-surface-shell border border-slate-200/80 dark:border-white/10"
            style={{ 
              top: panelPos.top, 
              right: panelPos.right, 
              width: panelPos.width || 384, 
              maxHeight: 'calc(100vh - 90px)',
              zIndex: 'var(--z-popover)',
              contain: 'paint layout'
            }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div ref={panelRef} className="w-full h-full flex flex-col bg-surface-shell">
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-white/10 bg-surface-shell shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">{t('notif.header')}</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-3xs font-black uppercase tracking-wider bg-blue-500/15 text-link dark:text-blue-300 border border-blue-500/25">
                      {t('notif.newCount', { count: unreadCount })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {(user?.role === 'patient' || user?.role === 'provider') && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        window.dispatchEvent(new Event('munticares-open-weekly-updates'));
                      }}
                      className="neu-btn px-2.5 py-1 rounded-xl text-xs font-extrabold text-link hover:opacity-90 cursor-pointer active:scale-95"
                      title={t('notif.updatesTitle')}
                    >
                      {t('notif.updatesBtn')}
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="neu-btn px-2.5 py-1 rounded-xl text-xs font-extrabold text-tertiary hover:text-link dark:text-tertiary dark:hover:text-link cursor-pointer active:scale-95"
                      title={t('notif.markReadTitle')}
                    >
                      {t('notif.markRead')}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllNotifications}
                      className="neu-btn px-2.5 py-1 rounded-xl text-xs font-extrabold text-tertiary hover:text-danger dark:text-tertiary dark:hover:text-red-400 cursor-pointer active:scale-95"
                      title={t('notif.clearAllTitle')}
                    >
                      {t('notif.clearAll')}
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented Filter Track (Option 1 - Strictly NO pills, NO dots) */}
              <div className="px-3 sm:px-4 py-2 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-surface-dark/60 shrink-0">
                <div className="p-1 rounded-xl bg-slate-200/60 dark:bg-surface-dark border border-slate-300/40 dark:border-white/5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`flex-1 py-1 px-2 rounded-lg text-2xs font-extrabold transition-all text-center cursor-pointer ${
                      filterTab === 'all'
                        ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm font-black'
                        : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('notif.tabAll', { count: notifications.length })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('unread')}
                    className={`flex-1 py-1 px-2 rounded-lg text-2xs font-extrabold transition-all text-center cursor-pointer ${
                      filterTab === 'unread'
                        ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm font-black'
                        : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('notif.tabUnread', { count: unreadCount })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('bookings')}
                    className={`flex-1 py-1 px-2 rounded-lg text-2xs font-extrabold transition-all text-center cursor-pointer ${
                      filterTab === 'bookings'
                        ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm font-black'
                        : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('notif.tabBookings')}
                  </button>
                </div>
              </div>

              {/* Notification List (Option 1 Linear Feed) */}
              <div 
                className="max-h-[21.875rem] sm:max-h-[23.75rem] overflow-y-auto overscroll-contain p-2.5 sm:p-3 space-y-2.5"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-y'
                }}
              >
                {filteredNotifications.length > 0 ? (
                  <AnimatePresence initial={false}>
                    {filteredNotifications.map((notif, idx) => {
                      const isUnread = unreadNotifications.some((n) => n.id === notif.id);
                      const accent = getNotifAccent(notif.type);
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
                          className={`w-full text-left p-3 sm:p-3.5 rounded-2xl flex items-start gap-3 transition-all relative group cursor-pointer select-none ${accent.border} ${
                            isUnread 
                              ? 'neu-flat bg-white/70 dark:bg-surface-darkAlt shadow-sm' 
                              : 'neu-flat-sm opacity-85 hover:opacity-100 bg-slate-50/50 dark:bg-surface-dark'
                          }`}
                          onClick={() => handleNotifClick(notif)}
                        >
                          <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            {getNotifIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className={`text-xs sm:text-[0.8125rem] truncate ${isUnread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
                                {notif.title}
                              </p>
                              {isUnread && (
                                <span className={`px-1.5 py-0.2 rounded text-3xs font-black uppercase tracking-wider ${accent.badgeBg} shrink-0`}>
                                  {t('notif.newBadge')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5 leading-snug">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between gap-2 mt-1.5 text-3xs text-tertiary">
                              <div className="flex items-center gap-1.5 font-semibold">
                                <Clock className="w-3 h-3 text-tertiary shrink-0" />
                                <span>{timeAgo(notif.time, language)}</span>
                                {formatNotifClock(notif.time, language) && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="font-mono text-slate-500 dark:text-slate-400 font-bold">{formatNotifClock(notif.time, language)}</span>
                                  </>
                                )}
                              </div>
                              
                              {/* Individual Quick Dismiss Button */}
                              <button
                                type="button"
                                onClick={(e) => dismissNotification(e, notif.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700/60 text-tertiary hover:text-slate-900 dark:hover:text-white transition-opacity cursor-pointer shrink-0"
                                title={t('notif.dismissTitle')}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
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
                    <div className="neu-flat-sm w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 text-success">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-extrabold">{t('notif.emptyTitle')}</p>
                    <p className="text-xs text-tertiary mt-1">{t('notif.emptySubtitle')}</p>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 sm:px-5 py-2.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-2xs text-tertiary font-bold bg-surface-shell shrink-0">
                  <span>
                    {notifications.length === 1
                      ? t('notif.footerCountOne', { shown: filteredNotifications.length, total: notifications.length })
                      : t('notif.footerCountMany', { shown: filteredNotifications.length, total: notifications.length })}
                  </span>
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-link hover:underline font-extrabold cursor-pointer"
                    >
                      {t('notif.unreadMarkAll', { count: unreadCount })}
                    </button>
                  ) : (
                    <span className="text-success font-extrabold">{t('notif.allCaughtUp')}</span>
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
