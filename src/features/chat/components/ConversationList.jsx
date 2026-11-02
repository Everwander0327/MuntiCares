import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { initialsAvatar } from '@/lib/avatar';
import { MessageSquareWarning, Search, PhoneOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePresence } from '@/contexts/PresenceContext';
import { fetchRecentCalls, onCallsChanged } from '../lib/callRecords';

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getLastMessagePreview = (msg, userId, callRecord) => {
  if (!msg) return { text: 'No messages yet', isYou: false };
  const isYou = msg.sender_id === userId;
  if (msg.message_type === 'call') {
    return { text: `${callRecord?.call_type === 'audio' ? 'Voice' : 'Video'} consultation`, isYou };
  }
  const isImage = msg.message_type === 'image' || (msg.content && /\.(jpg|jpeg|png|webp|gif|heic)(\?.*)?$/i.test(msg.content.split('\n')[0]));
  if (isImage) {
    const lines = (msg.content || '').split('\n');
    const caption = lines.slice(1).join('\n').trim();
    return { text: caption ? `📷 ${caption}` : '📷 Photo', isYou };
  }
  const isVideo = msg.message_type === 'video' || (msg.content && /\.(mp4|webm|mov|ogg|3gp)(\?.*)?$/i.test(msg.content.split('\n')[0]));
  if (isVideo) {
    const lines = (msg.content || '').split('\n');
    const caption = lines.slice(1).join('\n').trim();
    return { text: caption ? `🎥 ${caption}` : '🎥 Video', isYou };
  }
  if (msg.message_type === 'file') {
    return { text: '📎 Attachment', isYou };
  }
  // Chat rows written before calls were recorded carry only their emoji, which is how
  // this list came to label a voice consultation as "Video call started".
  if (msg.content?.startsWith('📹') || msg.content?.startsWith('📞')) {
    return { text: 'Consultation call', isYou };
  }
  let text = msg.content || '';
  if (text.length > 50) text = text.slice(0, 50) + '…';
  return { text, isYou };
};

const ConversationList = ({ user, onSelect, searchTerm = '', selectedId = null }) => {
  const { isUserOnline } = usePresence();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [callById, setCallById] = useState({});
  const [missedByPartner, setMissedByPartner] = useState({});

  // Only the last 24 hours are flagged, matching the window the transcript itself shows
  // when the conversation is opened. Older records stay in `calls` for auditing.
  const loadCalls = useCallback(async () => {
    if (!user?.id) return;
    const rows = await fetchRecentCalls({ userId: user.id });
    setCallById(Object.fromEntries(rows.map((row) => [row.id, row])));
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const missed = {};
    rows.forEach((row) => {
      if (row.status !== 'missed' || row.callee_id !== user.id) return;
      if (row.seen_at) return;
      if (new Date(row.ringing_at).getTime() < dayAgo) return;
      const previous = missed[row.caller_id];
      if (!previous || new Date(row.ringing_at) > new Date(previous.ringing_at)) {
        missed[row.caller_id] = row;
      }
    });
    setMissedByPartner(missed);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const isPatient = user.role === 'patient';
        const filterCol = isPatient ? 'patient_id' : 'provider_id';
        const otherCol = isPatient ? 'provider_id' : 'patient_id';

        const { data: reqData } = await supabase
          .from('requests')
          .select(`${otherCol}, partner:${otherCol}(full_name, email, avatar_url)`)
          .eq(filterCol, user.id)
          .in('status', ['Accepted', 'On The Way', 'Arrived', 'Completed']);

        const partnerMap = {};
        (reqData || []).forEach(req => {
          const rawId = req[otherCol];
          const p = req.partner;
          if (!rawId || !p || partnerMap[rawId]) return;
          partnerMap[rawId] = {
            id: rawId,
            name: p.full_name || (isPatient ? 'Provider' : 'Patient'),
            email: p.email,
            avatar_url: p.avatar_url || '',
            photoUrl: p.avatar_url || initialsAvatar(p.full_name, { background: isPatient ? 'DDEBF8' : 'E1F3EA', color: isPatient ? '2F6FB5' : '2C7A55' }),
          };
        });

        const partnerIds = Object.keys(partnerMap);
        if (partnerIds.length === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: msgData } = await supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, created_at, message_type')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .gte('created_at', yesterday)
          .order('created_at', { ascending: false })
          .limit(100);

        const lastMsgMap = {};

        (msgData || []).forEach(msg => {
          const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          if (!partnerMap[partnerId]) return;
          if (!lastMsgMap[partnerId]) lastMsgMap[partnerId] = msg;
        });

        const list = partnerIds
          .map(id => ({
            ...partnerMap[id],
            lastMessage: lastMsgMap[id] || null,
            unreadCount: 0,
          }))
          .sort((a, b) => {
            const ta = a.lastMessage?.created_at || '';
            const tb = b.lastMessage?.created_at || '';
            return tb.localeCompare(ta);
          });

        setConversations(list);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    fetchData();

    const fetchUnreadCounts = async () => {
      if (!user) return;
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at, is_read, message_type')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!data) return;
      let readIds = new Set();
      try {
        readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
      } catch {}
      const counts = {};
      const lastMsgMap = {};
      data.forEach(msg => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!lastMsgMap[partnerId]) lastMsgMap[partnerId] = msg;
        if (msg.receiver_id === user.id && !msg.is_read && !readIds.has(msg.id)) {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        }
      });
      setConversations(prev =>
        prev
          .map(c => ({
            ...c,
            unreadCount: counts[c.id] || 0,
            lastMessage: lastMsgMap[c.id] || null,
          }))
          .sort((a, b) => {
            const ta = a.lastMessage?.created_at || '';
            const tb = b.lastMessage?.created_at || '';
            return tb.localeCompare(ta);
          })
      );
    };

    const channel = supabase
      .channel(`conversation-list-${user.id}-${Math.random().toString(36).slice(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, fetchUnreadCounts)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, fetchUnreadCounts)
      .subscribe();

    fetchUnreadCounts();

    const onMessagesRead = () => fetchUnreadCounts();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') { fetchUnreadCounts(); loadCalls(); } };
    const onWindowFocus = () => { fetchUnreadCounts(); loadCalls(); };
    window.addEventListener('messages-read', onMessagesRead);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);
    const stopCallsListener = onCallsChanged(loadCalls);

    loadCalls();

    // Incoming messages already arrive over realtime; polling only covers a
    // dropped socket and must not query every two seconds per open session.
    const pollInterval = setInterval(fetchUnreadCounts, 15000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      stopCallsListener();
      window.removeEventListener('messages-read', onMessagesRead);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [user, loadCalls]);

  const filtered = searchTerm
    ? conversations.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : conversations;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="neu-flat-sm w-12 h-12 rounded-2xl flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    if (searchTerm && conversations.length > 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-tertiary dark:text-tertiary py-16 px-4">
          <div className="neu-flat-sm w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-tertiary">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">No results found</h3>
          <p className="text-xs text-tertiary dark:text-tertiary mt-1 text-center">No conversations match {'\u201C'}{searchTerm}{'\u201D'}</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-tertiary dark:text-tertiary py-16 px-4">
        <div className="neu-flat w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-link">
          <MessageSquareWarning className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">No conversations yet</h3>
        <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-xs text-center">
          {user?.role === 'patient'
            ? 'Chat with providers once a request is accepted.'
            : 'Chat with patients once you accept their request.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 sm:space-y-1.5 select-text">
      {filtered.map((conv, i) => {
        const preview = getLastMessagePreview(conv.lastMessage, user.id, callById[conv.lastMessage?.call_id]);
        const missed = missedByPartner[conv.id];
        const hasUnread = conv.unreadCount > 0;
        return (
          <motion.div
            key={conv.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.02 }}
            onClick={() => {
              setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
              onSelect(conv);
            }}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
              conv.id === selectedId
                ? 'neu-pressed border border-primary/40 bg-primary/10'
                : hasUnread 
                ? 'neu-flat border border-primary/30 ring-1 ring-primary/20' 
                : 'hover:bg-slate-200/50 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden p-0.5 flex items-center justify-center aspect-square bg-slate-100 dark:bg-slate-700 shadow-sm">
                  <img src={conv.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                </div>
                <div 
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-surface-shell transition-colors ${
                    isUserOnline(conv.id) ? 'bg-emerald-500' : 'bg-slate-400'
                  }`} 
                  title={isUserOnline(conv.id) ? 'Online' : 'Offline'}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-display font-extrabold text-xs sm:text-sm truncate ${
                    hasUnread ? 'text-link' : 'text-slate-900 dark:text-white'
                  }`}>
                    {conv.name}
                  </p>
                  <span className="text-2xs text-tertiary dark:text-tertiary shrink-0 font-medium tabular-nums">
                    {formatRelativeTime(conv.lastMessage?.created_at)}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 mt-0.5">
                  {preview.text ? (
                    <p className={`text-xs truncate ${
                      hasUnread 
                        ? 'text-slate-800 dark:text-slate-100 font-bold' 
                        : 'text-tertiary dark:text-tertiary font-normal'
                    }`}>
                      {preview.isYou && <span className="text-tertiary font-normal">You: </span>}
                      {preview.text}
                    </p>
                  ) : (
                    <p className="text-2xs text-tertiary italic">No messages yet</p>
                  )}
                </div>

                {missed && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <PhoneOff className="w-3 h-3 text-danger shrink-0" />
                    <span className="text-3xs font-extrabold uppercase tracking-wider text-danger truncate">
                      Missed {missed.call_type === 'audio' ? 'voice' : 'video'} call · {formatRelativeTime(missed.ringing_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {hasUnread && (
              <span className="min-w-[18px] h-[18px] bg-primary rounded-full flex items-center justify-center text-3xs font-black text-white px-1 shadow-sm shrink-0">
                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default ConversationList;
