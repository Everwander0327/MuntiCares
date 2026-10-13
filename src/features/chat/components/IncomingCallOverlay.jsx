import { useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalls } from '@/contexts/CallContext';
import { useAuth } from '@/contexts/AuthContext';
import { playRingtone, stopRingtone } from '@/lib/audio';

const IncomingCallOverlay = () => {
  const { incomingCall, acceptCall, rejectCall, callCancelledByPeer } = useCalls();
  const { user } = useAuth();

  useEffect(() => {
    if (incomingCall) {
      playRingtone();
      try { navigator.vibrate?.(200); } catch {}
      return () => stopRingtone();
    }
    stopRingtone();
  }, [incomingCall]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') stopRingtone();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!incomingCall && !callCancelledByPeer) return null;
  if (!user) return null;

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="neu-flat bg-[#ebf1f8] dark:bg-[#172236] rounded-[2.5rem] p-7 sm:p-8 max-w-xs w-full mx-5 shadow-2xl border border-white/80 dark:border-white/10 text-center select-text"
          >
            <div className="relative w-28 h-28 mx-auto mb-5">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/40"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-400/40"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
              />
              <div className="absolute inset-1.5 rounded-full neu-flat flex items-center justify-center p-1 overflow-hidden">
                <span className="text-2xl font-black text-primary">
                  {getInitials(incomingCall.sender_name)}
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-flat-sm text-3xs font-extrabold text-primary uppercase tracking-widest mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              Incoming Video Call
            </div>

            <h2 className="text-lg font-display font-black text-slate-900 dark:text-white truncate">
              {incomingCall.sender_name || 'Healthcare Provider'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Teleconsultation request
            </p>

            <div className="flex gap-6 mt-7 justify-center items-center">
              <button
                type="button"
                onClick={rejectCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-14 h-14 neu-btn rounded-2xl flex items-center justify-center text-rose-500 hover:text-rose-600 transition-all active:scale-95 shadow-md">
                  <PhoneOff className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-3xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Decline</span>
              </button>

              <button
                type="button"
                onClick={acceptCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl neu-btn-primary flex items-center justify-center text-white transition-all active:scale-95 shadow-lg shadow-emerald-500/25">
                  <Phone className="w-7 h-7 stroke-[2.5]" />
                </div>
                <span className="text-3xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Accept</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {callCancelledByPeer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="neu-flat bg-[#ebf1f8] dark:bg-[#172236] rounded-[2.25rem] p-7 max-w-xs w-full mx-5 shadow-2xl border border-white/80 dark:border-white/10 text-center select-text"
          >
            <div className="w-16 h-16 mx-auto mb-3.5 rounded-2xl neu-flat flex items-center justify-center text-slate-400">
              <PhoneOff className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-display font-black text-slate-900 dark:text-white">Call Cancelled</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              The caller ended the call before it was accepted
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallOverlay;
