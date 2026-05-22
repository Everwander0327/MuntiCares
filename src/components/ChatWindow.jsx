import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, UserCircle, Loader2, Check, CheckCheck, Video, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JitsiMeeting } from '@jitsi/react-sdk';

const addReadMsgIds = (userId, ids) => {
  if (!ids.length) return;
  try {
    const key = `read_msgs_${userId}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const set = new Set(stored);
    ids.forEach(id => set.add(id));
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
};

const ChatWindow = ({ currentUser, otherUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const channelRef = useRef(null);
  const ringtoneRef = useRef(null);

  useEffect(() => {
    // Setup Ringtone Audio
    ringtoneRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg');
    ringtoneRef.current.loop = true;
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Auto-scroll when messages update or typing indicator appears
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!currentUser || !otherUser) return;

    const fetchMessages = async () => {
      setLoading(true);

      await supabase
        .from('messages')
        .delete()
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .gte('created_at', yesterday)
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
        
        const unreadIds = data.filter(m => m.receiver_id === currentUser.id && !m.is_read).map(m => m.id);
        if (unreadIds.length > 0) {
          addReadMsgIds(currentUser.id, unreadIds);
        }
      }
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };

    fetchMessages();

    // 2. Setup Realtime Channel (Database, Presence, Broadcast)
    const roomName = `chat_room`; // Shared room for presence
    const channel = supabase.channel(roomName, {
      config: { presence: { key: currentUser.id }, broadcast: { self: true } }
    });
    channelRef.current = channel;

    channel
      // Listen for new messages
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        if (
          (msg.sender_id === currentUser.id && msg.receiver_id === otherUser.id) ||
          (msg.sender_id === otherUser.id && msg.receiver_id === currentUser.id)
        ) {
          if (msg.receiver_id === currentUser.id) {
            msg.is_read = true;
            addReadMsgIds(currentUser.id, [msg.id]);
          }
          setMessages(prev => {
            // Prevent duplicates due to optimistic UI
            if (prev.find(m => m.id === msg.id)) return prev;
            
            // Look for the optimistic temp message (starts with 'temp-') and replace it with the real DB message
            const tempMatch = prev.find(m => 
              typeof m.id === 'string' && 
              m.id.startsWith('temp-') && 
              m.content === msg.content && 
              m.sender_id === msg.sender_id
            );
            
            if (tempMatch) {
              return prev.map(m => m.id === tempMatch.id ? msg : m);
            }
            
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 100);
        }
      })
      // Listen for message updates (e.g., when they read our message)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      // Track online status via Presence
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const otherUserPresent = Object.values(state).flat().some(p => p.presence_ref === otherUser.id || p.user_id === otherUser.id || state[otherUser.id]);
        setIsOnline(!!state[otherUser.id] || otherUserPresent);
      })
      // Listen for Typing events via Broadcast
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender_id === otherUser.id && payload.payload.receiver_id === currentUser.id) {
          setIsTyping(payload.payload.isTyping);
        }
      })
      // Listen for INSTANT new messages via Broadcast (bypasses DB latency)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload;
        if (msg.sender_id === otherUser.id && msg.receiver_id === currentUser.id) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id || m.content === msg.content && Math.abs(new Date(m.created_at) - new Date(msg.created_at)) < 5000)) return prev;
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 50);
        }
      })
      // Listen for incoming call event
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        if (payload.payload.sender_id === otherUser.id && payload.payload.receiver_id === currentUser.id) {
          setIncomingCall(true);
          ringtoneRef.current?.play().catch(e => console.log('Audio play blocked:', e));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, otherUser]);

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    // Broadcast typing status
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_id: currentUser.id, receiver_id: otherUser.id, isTyping: true }
      });

      // Clear typing status after 2 seconds of stopping
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { sender_id: currentUser.id, receiver_id: otherUser.id, isTyping: false }
        });
      }, 2000);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    
    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      receiver_id: otherUser.id,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false
    };

    if (channelRef.current) {
       // Stop typing indicator
       channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { sender_id: currentUser.id, receiver_id: otherUser.id, isTyping: false } });
       // BROADCAST INSTANTLY to receiver (bypasses database latency)
       channelRef.current.send({ type: 'broadcast', event: 'new_message', payload: tempMsg });
    }
    
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(scrollToBottom, 100);

    await supabase.from('messages').insert([{
      sender_id: currentUser.id,
      receiver_id: otherUser.id,
      content: text,
      is_read: false
    }]);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgText = newMessage.trim();
    setNewMessage('');
    clearTimeout(typingTimeoutRef.current);
    
    await sendMessage(msgText);
  };

  const startVideoCall = () => {
    setIsVideoCallActive(true);
    sendMessage("📞 I've started a video consultation. Please click the Video icon at the top right to join the call!");
    
    // Broadcast incoming call to the other user
    if (channelRef.current) {
      channelRef.current.send({ 
        type: 'broadcast', 
        event: 'incoming_call', 
        payload: { sender_id: currentUser.id, receiver_id: otherUser.id } 
      });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Unique Room Name for Jitsi based on sorted user IDs
  const roomName = `MuntiCaresRoom_${[currentUser.id, otherUser.id].sort().join('')}`.replace(/-/g, '');

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative overflow-hidden">
      {/* Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="absolute top-4 inset-x-4 z-[150] bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center animate-pulse shrink-0">
                <Video className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">Incoming Video Call...</h3>
                <p className="text-sm text-slate-500 font-medium">{otherUser.name} is calling you</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  ringtoneRef.current?.pause();
                  setIncomingCall(false);
                  setIsVideoCallActive(true); // Accept Call
                }}
                className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30 hover:scale-105"
                title="Accept Call"
              >
                <Check className="w-6 h-6" />
              </button>
              <button 
                onClick={() => {
                  ringtoneRef.current?.pause();
                  setIncomingCall(false);
                }}
                className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 hover:scale-105"
                title="Decline Call"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Call Overlay */}
      <AnimatePresence>
        {isVideoCallActive && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100] bg-slate-900 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 text-white shrink-0 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Video className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold">Teleconsultation</h3>
                  <p className="text-xs text-slate-400">with {otherUser.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsVideoCallActive(false)}
                className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors flex items-center gap-2 text-sm font-bold bg-slate-800"
              >
                <X className="w-5 h-5" />
                End Call
              </button>
            </div>
            <div className="flex-1 w-full bg-black relative">
              <JitsiMeeting
                domain="meet.jit.si"
                roomName={roomName}
                configOverwrite={{
                  startWithAudioMuted: false,
                  startWithVideoMuted: false,
                  disableModeratorIndicator: true,
                  enableEmailInStats: false,
                  prejoinPageEnabled: false // Skip prejoin page for instant connect
                }}
                interfaceConfigOverwrite={{
                  DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                  TOOLBAR_BUTTONS: [
                    'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                    'fodeviceselection', 'hangup', 'profile', 'chat', 'settings', 'raisehand',
                    'videoquality', 'filmstrip', 'shortcuts', 'tileview'
                  ]
                }}
                userInfo={{
                  displayName: currentUser.name,
                }}
                getIFrameRef={(iframeRef) => {
                  iframeRef.style.height = '100%';
                  iframeRef.style.width = '100%';
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center gap-4 shrink-0 shadow-sm z-10">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-slate-200">
            {otherUser.photoUrl ? (
              <img src={otherUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-6 h-6" />
            )}
          </div>
          {/* Active Dot */}
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white transition-colors duration-300 ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 leading-tight">{otherUser.name}</h3>
          <p className={`text-xs font-medium transition-colors duration-300 ${isOnline ? 'text-green-500' : 'text-slate-400'}`}>
            {isOnline ? 'Active now' : 'Offline'}
          </p>
        </div>
        
        {/* Video Call Button */}
        <button
          onClick={startVideoCall}
          className="w-12 h-12 rounded-full bg-blue-50 text-primary flex items-center justify-center hover:bg-blue-100 transition-all shadow-sm shrink-0 border border-blue-100 hover:scale-105"
          title="Start Teleconsultation"
        >
          <Video className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-10">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm font-medium">Say hello to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUser.id;
            const showAvatar = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;

            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id} 
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${!showAvatar ? 'mt-1' : 'mt-4'}`}
              >
                {!isMe && (
                  <div className={`w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold shrink-0 mr-2 shadow-sm ${!showAvatar ? 'invisible' : ''}`}>
                    {otherUser.photoUrl ? (
                      <img src={otherUser.photoUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <UserCircle className="w-5 h-5" />
                    )}
                  </div>
                )}
                
                <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 shadow-sm relative ${
                    isMe 
                      ? 'bg-gradient-to-tr from-primary to-blue-500 text-white rounded-br-sm' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                  }`}>
                    <p className="text-[15px] whitespace-pre-wrap leading-snug">{msg.content}</p>
                  </div>
                  
                  {/* Timestamp & Seen Indicator */}
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[9px] text-slate-400 font-medium">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      <span className="text-slate-400">
                        {msg.is_read ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        {/* 24-Hour Notice (Instagram style) */}
        {messages.length > 0 && (
          <div className="flex justify-center mt-6 mb-2">
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase bg-slate-200/50 px-3 py-1 rounded-full">
              🔒 Messages disappear after 24 hours
            </span>
          </div>
        )}

        {/* Typing Indicator Bubble */}
        <AnimatePresence>
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="flex justify-start mt-4"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 mr-2 overflow-hidden shadow-sm shrink-0">
                <img src={otherUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                <motion.div className="w-1.5 h-1.5 bg-slate-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                <motion.div className="w-1.5 h-1.5 bg-slate-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                <motion.div className="w-1.5 h-1.5 bg-slate-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] relative z-20">
        <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="Type your message..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all text-sm font-medium"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50 disabled:scale-95 shrink-0 shadow-lg shadow-primary/20"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
