import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalls } from '../contexts/CallContext';
import { useAuth } from '../contexts/AuthContext';
import { playRingtone, stopRingtone } from '../lib/audio';

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
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-xs w-full mx-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center"
          >
            <div className="relative w-28 h-28 mx-auto mb-6">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-green-400"
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-green-400"
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              />
              <div className="absolute inset-2 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {getInitials(incomingCall.sender_name)}
                </span>
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Incoming Call</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
              {incomingCall.sender_name || 'Someone'} is calling
            </p>

            <div className="flex gap-8 mt-8 justify-center">
              <button
                onClick={rejectCall}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-90 group-hover:bg-red-600">
                  <PhoneOff className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Decline</span>
              </button>

              <button
                onClick={acceptCall}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-all active:scale-90 group-hover:bg-green-600">
                  <Phone className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Accept</span>
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
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-xs w-full mx-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <PhoneOff className="w-9 h-9 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Call Cancelled</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              The caller ended the call before it was accepted
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallOverlay;
