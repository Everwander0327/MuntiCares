import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquareWarning, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePresence } from '@/contexts/PresenceContext';

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

const getLastMessagePreview = (msg, userId) => {
  if (!msg) return { text: 'No messages yet', isYou: false };
  const isYou = msg.sender_id === userId;
  let text = msg.content || '';
  if (text.startsWith('📞')) text = '📞 Video call started';
  if (text.length > 50) text = text.slice(0, 50) + '…';
  return { text, isYou };
};

const ConversationList = ({ user, onSelect, searchTerm = '' }) => {
  const { isUserOnline } = usePresence();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

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
            photoUrl: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'U')}&background=${isPatient ? 'F3E8FF&color=9333EA' : 'E0F2FE&color=2563EB'}`,
          };
        });

        const partnerIds = Object.keys(partnerMap);
        if (partnerIds.length === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        const { data: msgData } = await supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, created_at')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
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
        .select('id, sender_id')
        .eq('receiver_id', user.id)
        .gte('created_at', yesterday);

      if (!data) return;
      const readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
      const counts = {};
      data.forEach(msg => {
        if (!readIds.has(msg.id)) counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });
      setConversations(prev => prev.map(c => ({ ...c, unreadCount: counts[c.id] || 0 })));
    };

    const channel = supabase
      .channel(`conversation-list-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, fetchUnreadCounts)
      .subscribe();

    fetchUnreadCounts();

    const onMessagesRead = () => fetchUnreadCounts();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchUnreadCounts(); };
    const onWindowFocus = () => fetchUnreadCounts();
    window.addEventListener('messages-read', onMessagesRead);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    const pollInterval = setInterval(fetchUnreadCounts, 2000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      window.removeEventListener('messages-read', onMessagesRead);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [user]);

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
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-16 px-4">
          <div className="neu-flat-sm w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-slate-400">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">No results found</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-center">No conversations match {'\u201C'}{searchTerm}{'\u201D'}</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-16 px-4">
        <div className="neu-flat w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-primary">
          <MessageSquareWarning className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">No conversations yet</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs text-center">
          {user?.role === 'patient'
            ? 'Chat with providers once a request is accepted.'
            : 'Chat with patients once you accept their request.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 select-text">
      {filtered.map((conv, i) => {
        const preview = getLastMessagePreview(conv.lastMessage, user.id);
        const hasUnread = conv.unreadCount > 0;
        return (
          <motion.div
            key={conv.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03 }}
            onClick={() => onSelect(conv)}
            className={`neu-flat p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] flex items-center justify-between gap-3.5 sm:gap-4 transition-all cursor-pointer transform-gpu will-change-transform ${
              hasUnread 
                ? 'border border-primary/30 ring-1 ring-primary/20' 
                : 'hover:scale-[1.008]'
            }`}
          >
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="neu-flat-sm w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden p-0.5 flex items-center justify-center aspect-square">
                  <img src={conv.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                </div>
                <div 
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#172236] transition-colors ${
                    isUserOnline(conv.id) ? 'bg-emerald-500' : 'bg-slate-400'
                  }`} 
                  title={isUserOnline(conv.id) ? 'Online' : 'Offline'}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-display font-extrabold text-sm sm:text-base truncate ${
                    hasUnread ? 'text-primary' : 'text-slate-900 dark:text-white'
                  }`}>
                    {conv.name}
                  </p>
                  <span className="text-3xs sm:text-2xs text-slate-400 dark:text-slate-500 shrink-0 font-bold tabular-nums">
                    {formatRelativeTime(conv.lastMessage?.created_at)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  {preview.text ? (
                    <p className={`text-xs sm:text-sm truncate ${
                      hasUnread 
                        ? 'text-slate-800 dark:text-slate-100 font-bold' 
                        : 'text-slate-500 dark:text-slate-400 font-medium'
                    }`}>
                      {preview.isYou && <span className="text-slate-400 font-normal">You: </span>}
                      {preview.text}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No messages yet</p>
                  )}
                </div>
              </div>
            </div>

            {hasUnread && (
              <span className="min-w-[22px] h-[22px] bg-primary rounded-full flex items-center justify-center text-3xs font-black text-white px-1.5 shadow-sm shrink-0">
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
