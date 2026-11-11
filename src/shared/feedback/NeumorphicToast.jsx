import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast, resolveValue } from 'react-hot-toast';
import { Check, Pause, X, Loader2, Bell } from 'lucide-react';
import { playToastSound } from '@/lib/audio';

const NeumorphicToast = ({ t }) => {
  const message = resolveValue(t.message, t);
  const isCurrentVisible = t.visible !== false;

  const rawText = typeof message === 'string' ? message : '';
  const lower = rawText.toLowerCase();
  const isPaused =
    t.icon === 'pause' ||
    t.type === 'pause' ||
    lower.includes('paused') ||
    lower.includes('suspended') ||
    lower.includes('revoked');

  const isSuccess = t.type === 'success' && !isPaused;
  const isError = t.type === 'error';
  const isLoading = t.type === 'loading';

  useEffect(() => {
    playToastSound(isPaused ? 'blank' : t.type);
  }, [t.type, isPaused]);

  let statusText = 'NOTICE';
  let glowColor = '#94a3b8';
  let textClass = 'text-slate-600 dark:text-slate-400';
  let Icon = Bell;

  if (isPaused) {
    statusText = 'PAUSED';
    glowColor = '#f59e0b';
    textClass = 'text-amber-600 dark:text-amber-400';
    Icon = Pause;
  } else if (isSuccess) {
    statusText = lower.includes('grant') ? 'GRANTED' : 'SAVED';
    glowColor = '#10b981';
    textClass = 'text-emerald-600 dark:text-emerald-400';
    Icon = Check;
  } else if (isError) {
    statusText = 'FAILED';
    glowColor = '#f43f5e';
    textClass = 'text-rose-600 dark:text-rose-400';
    Icon = X;
  } else if (isLoading) {
    statusText = 'SYNCING';
    glowColor = '#3b82f6';
    textClass = 'text-blue-600 dark:text-blue-400';
    Icon = Loader2;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={
        isCurrentVisible
          ? { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }
          : { opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.18, ease: 'easeIn' } }
      }
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.8, bottom: 0.1 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -20 || info.velocity.y < -200) toast.dismiss(t.id);
      }}
      onClick={() => toast.dismiss(t.id)}
      whileTap={{ scale: 0.98 }}
      className="pointer-events-auto select-none cursor-pointer max-w-[92vw] sm:max-w-md w-auto"
    >
      {/* Toast Aurora Border & Ambient Glowing Halo (Adapts to Light & Dark Theme) */}
      <div className="toast-aurora shadow-lg dark:shadow-2xl" style={{ '--toast-c': glowColor }}>
        <div className="h-10 px-3.5 flex items-center gap-2.5 rounded-[13px] bg-white/95 dark:bg-[#0d0f14]/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-none">
          <Icon
            size={15}
            strokeWidth={2.5}
            className={`${textClass} ${isLoading ? 'animate-spin shrink-0' : 'shrink-0'}`}
          />
          <div className="text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate tracking-tight pr-1">
            {message}
          </div>
          <span
            className={`ml-2 text-[10px] font-mono-code font-bold uppercase tracking-wider shrink-0 ${textClass}`}
          >
            {statusText}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default NeumorphicToast;
