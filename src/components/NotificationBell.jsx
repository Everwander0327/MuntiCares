import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, FileText, MessageCircle, Star, CheckCircle2, XCircle, Navigation, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
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

const getNotifBg = (type) => {
  switch (type) {
    case 'request_accepted': return 'bg-green-50 dark:bg-green-900/30';
    case 'request_rejected': return 'bg-red-50 dark:bg-red-900/30';
    case 'status_on_the_way': return 'bg-amber-50 dark:bg-amber-900/30';
    case 'status_arrived': return 'bg-purple-50 dark:bg-purple-900/30';
    case 'status_completed': return 'bg-green-50 dark:bg-green-900/30';
    case 'new_request': return 'bg-blue-50 dark:bg-blue-900/30';
    case 'new_message': return 'bg-blue-50 dark:bg-blue-900/30';
    case 'request_cancelled': return 'bg-slate-50 dark:bg-slate-800';
    default: return 'bg-slate-50 dark:bg-slate-800';
  }
};

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Just now';
  const now = new Date();
  let then = new Date(dateStr);

  // Securely parse UTC database strings to avoid 8-hour local timezone shift
  if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !/[-+]\d{2}:\d{2}$/.test(dateStr)) {
    then = new Date(dateStr.includes('T') ? `${dateStr}Z` : `${dateStr.replace(' ', 'T')}Z`);
  }

  const diffMs = now - then;

  // Handle small client-server time drifts or timezone gaps securely
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
  const panelRef = useRef(null);
  const prevNotifsRef = useRef([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate notifications from request status changes
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
      }
    });

    // Sort by time descending
    notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
    return notifs.slice(0, 20); // Cap at 20
  };

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const isPatient = user.role === 'patient';
      const filterCol = isPatient ? 'patient_id' : 'provider_id';

      const { data, error } = await supabase
        .from('requests')
        .select('id, status, service, created_at, patient:patient_id(full_name), provider:provider_id(full_name)')
        .eq(filterCol, user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const notifs = generateNotifications(data || [], user.role);

      // Also fetch unread messages for notification bell
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: msgData } = await supabase
        .from('messages')
        .select('id, content, created_at, sender:sender_id(full_name)')
        .eq('receiver_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false });
      if (msgData) {
        const readMsgIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
        const unreadMsgs = msgData.filter(m => !readMsgIds.has(m.id));
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

      // Compare with previous fetch to trigger real-time toasts on updates (essential for anon auth)
      if (prevNotifsRef.current.length > 0) {
        const newlyAdded = notifs.filter(n => !prevNotifsRef.current.some(pn => pn.id === n.id));
        newlyAdded.forEach(notif => {
          playChime();
          let icon = '🔔';
          if (notif.type === 'request_accepted') icon = '✅';
          else if (notif.type === 'status_on_the_way') icon = '🚗';
          else if (notif.type === 'status_arrived') icon = '🏠';
          else if (notif.type === 'status_completed') icon = '⭐';
          else if (notif.type === 'request_rejected') icon = '❌';
          else if (notif.type === 'new_request') icon = '📋';
          else if (notif.type === 'request_cancelled') icon = '🚫';
          else if (notif.type === 'new_message') icon = '💬';

          toast(
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{notif.title}</p>
              <p className="text-slate-500 dark:text-slate-400 text-nano font-normal mt-0.5">{notif.message}</p>
            </div>,
            {
              icon,
              style: {
                borderRadius: '1rem',
                background: '#fff',
                color: '#1e293b',
                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                border: '1px solid #f1f5f9',
                padding: '10px 14px'
              },
              duration: 4000
            }
          );

          fireBrowserNotification(notif.title, notif.message);
        });
      }
      
      prevNotifsRef.current = notifs;
      setNotifications(notifs);

      // Count unread based on localStorage
      const readIds = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
      const unread = notifs.filter(n => !readIds.includes(n.id)).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [user]);

  const fireBrowserNotification = (title, body) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+CiAgPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNyIgZmlsbD0iIzI1NjNlYiIvPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQsIDQpIj4KICAgIDxwYXRoIGQ9Ik0xOSAxNGMxLjQ5LTEuNDYgMy0zLjIxIDMtNS41QTUuNSA1LjUgMCAwIDAgMTYuNSAzYy0xLjc2IDAtMyAuNS00LjUgMi0xLjUtMS41LTIuNzQtMi00LjUtMkE1LjUgNS41IDAgMCAwIDIgOC41YzAgMi4zIDEuNSA0LjA1IDMgNS41bDcgN1oiIGZpbGw9IiNmZmYiLz4KICA8L2c+Cjwvc3ZnPgo=' });
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // 1. Polling Fallback (runs every 1.5 seconds) - 100% reliable even without Supabase Auth!
    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 1500);

    // 2. Real-time subscription (attempt)
    const filterCol = user.role === 'patient' ? 'patient_id' : 'provider_id';
    const channel = supabase
      .channel('notification-bell-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `${filterCol}=eq.${user.id}`
        },
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
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      supabase.removeChannel(msgChannel);
    };
  }, [user, fetchNotifications]);

  const markAllRead = () => {
    if (!user) return;
    const allIds = notifications.map(n => n.id);
    localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(allIds));
    setUnreadCount(0);
  };

  const handleNotifClick = (notif) => {
    // Mark this one as read
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
    e.stopPropagation(); // Avoid triggering navigation
    if (user) {
      const readIds = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
      if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(readIds));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const readIds = user ? JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]') : [];
  const unreadNotifications = notifications.filter(n => !readIds.includes(n.id));

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }}
        className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors relative"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <motion.span 
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-3xs font-bold text-white px-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            key={unreadCount}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-20 sm:top-full mt-2 w-auto sm:w-96 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-2xl z-50 overflow-hidden"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
              {unreadNotifications.length > 0 ? (
                unreadNotifications.map((notif) => {
                  return (
                    <div
                      key={notif.id}
                      className="w-full text-left px-5 py-3.5 flex items-start gap-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/80 bg-blue-50/20 dark:bg-blue-900/10 relative group cursor-pointer"
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${getNotifBg(notif.type)}`}>
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2">
                          <p className="text-sm truncate font-bold text-slate-900 dark:text-slate-100">
                            {notif.title}
                          </p>
                          <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{notif.message}</p>
                        <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(notif.time)}
                        </p>
                      </div>

                      {/* X / Dismiss Button on Hover */}
                      <button
                        onClick={(e) => dismissNotification(e, notif.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2 animate-bounce" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">You{'\u2019'}re all caught up!</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No unread notifications at the moment.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {unreadNotifications.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 text-center">
                <p className="text-2xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Showing latest {unreadNotifications.length} notifications
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
