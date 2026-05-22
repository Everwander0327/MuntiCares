import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquareWarning, Search } from 'lucide-react';
import { motion } from 'framer-motion';

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
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const isPatient = user.role === 'patient';
        const filterCol = isPatient ? 'patient_id' : 'provider_id';
        const otherCol = isPatient ? 'provider_id' : 'patient_id';

        const partnerAlias = isPatient ? 'partner' : 'partner';
        const { data: reqData } = await supabase
          .from('requests')
          .select(`${otherCol}, partner:${otherCol}(full_name, email)`)
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
            photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'U')}&background=${isPatient ? 'F3E8FF&color=9333EA' : 'E0F2FE&color=2563EB'}`,
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

        const readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
        const unreadCounts = {};
        const lastMsgMap = {};

        (msgData || []).forEach(msg => {
          const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          if (!partnerMap[partnerId]) return;

          if (!lastMsgMap[partnerId]) lastMsgMap[partnerId] = msg;

          if (msg.receiver_id === user.id && !readIds.has(msg.id)) {
            unreadCounts[partnerId] = (unreadCounts[partnerId] || 0) + 1;
          }
        });

        const list = partnerIds
          .map(id => ({
            ...partnerMap[id],
            lastMessage: lastMsgMap[id] || null,
            unreadCount: unreadCounts[id] || 0,
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
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('receiver_id', user.id);

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

    const pollInterval = setInterval(fetchUnreadCounts, 5000);

    return () => { clearInterval(pollInterval); supabase.removeChannel(channel); };
  }, [user]);

  const filtered = searchTerm
    ? conversations.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : conversations;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (filtered.length === 0) {
    if (searchTerm && conversations.length > 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20">
          <Search className="w-10 h-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No results found</h3>
          <p className="text-sm text-slate-400 mt-1">No conversations match "{searchTerm}"</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
          <MessageSquareWarning className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No conversations yet</h3>
        <p className="text-sm text-slate-400 mt-1">
          {user?.role === 'patient'
            ? 'Chat with providers once a request is accepted.'
            : 'Chat with patients once you accept their request.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
      {filtered.map((conv, i) => {
        const preview = getLastMessagePreview(conv.lastMessage, user.id);
        return (
          <motion.button
            key={conv.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(conv)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-blue-100 overflow-hidden">
                <img src={conv.photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
              {conv.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white px-1">
                  {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm text-slate-900 truncate">{conv.name}</p>
                <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                  {formatRelativeTime(conv.lastMessage?.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {preview.text ? (
                  <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                    {preview.isYou && <span className="text-slate-400">You: </span>}
                    {preview.text}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No messages yet</p>
                )}
                {conv.unreadCount > 0 && (
                  <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                )}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default ConversationList;
