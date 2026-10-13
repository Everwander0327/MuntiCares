import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast, resolveValue } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { playToastSound } from '@/lib/audio';

const NeumorphicToast = ({ t }) => {
  const isSuccess = t.type === 'success';
  const isError = t.type === 'error';
  const isLoading = t.type === 'loading';

  const message = resolveValue(t.message, t);
  const isCurrentVisible = t.visible !== false;

  // Measure actual text width dynamically
  const textRef = useRef(null);
  const [textWidth, setTextWidth] = useState(160);

  // Play audio chime once when toast mounts
  useEffect(() => {
    playToastSound(t.type);
  }, [t.type]);

  useEffect(() => {
    if (textRef.current) {
      const measured = textRef.current.scrollWidth;
      if (measured > 0) setTextWidth(measured);
    }
  }, [message]);

  const travelDist = textWidth + 12; // distance roller travels across

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, scale: 0.75 }}
      animate={
        isCurrentVisible
          ? {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 360, damping: 24, mass: 0.8 },
            }
          : {
              opacity: 0,
              y: -24,
              scale: 0.65,
              transition: { duration: 0.28, delay: 0.38, ease: [0.32, 0.72, 0, 1] },
            }
      }
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.8, bottom: 0.1 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -25 || info.velocity.y < -250) {
          toast.dismiss(t.id);
        }
      }}
      onClick={() => toast.dismiss(t.id)}
      whileTap={{ scale: 0.98 }}
      className="pointer-events-auto select-none cursor-grab active:cursor-grabbing max-w-[92vw] sm:max-w-md w-auto"
    >
      <motion.div
        initial={{ width: 44 }}
        animate={
          isCurrentVisible
            ? {
                width: 44 + travelDist,
                transition: {
                  duration: 0.55,
                  delay: 0.3,
                  ease: [0.16, 1, 0.3, 1],
                },
              }
            : {
                width: 44,
                transition: {
                  duration: 0.35,
                  ease: [0.32, 0.72, 0, 1],
                },
              }
        }
        className="neu-flat bg-[#ebf1f8]/95 dark:bg-[#172236]/95 backdrop-blur-md rounded-full shadow-2xl border border-white/80 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5 overflow-hidden relative flex items-center h-11 sm:h-12 px-1"
      >
        {/* The Unrolled Mat (Text Layer) */}
        <motion.div
          initial={{ clipPath: 'inset(0% 100% 0% 0%)', opacity: 0 }}
          animate={
            isCurrentVisible
              ? {
                  clipPath: 'inset(0% 0% 0% 0%)',
                  opacity: 1,
                  transition: {
                    duration: 0.55,
                    delay: 0.3,
                    ease: [0.16, 1, 0.3, 1],
                  },
                }
              : {
                  clipPath: 'inset(0% 100% 0% 0%)',
                  opacity: 0,
                  transition: {
                    duration: 0.35,
                    ease: [0.32, 0.72, 0, 1],
                  },
                }
          }
          className="absolute left-3.5 pr-12 flex items-center whitespace-nowrap overflow-hidden select-text pointer-events-none"
        >
          <p
            ref={textRef}
            className="text-xs sm:text-[13px] font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none"
          >
            {message}
          </p>
        </motion.div>

        {/* The Rolling Sushi Wheel (The Disc) */}
        <motion.div
          initial={{ x: 0, rotate: -270, scale: 0.8 }}
          animate={
            isCurrentVisible
              ? {
                  x: travelDist,
                  rotate: 360,
                  scale: 1,
                  transition: {
                    rotate: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
                    scale: { duration: 0.3, ease: 'easeOut' },
                    x: {
                      duration: 0.55,
                      delay: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  },
                }
              : {
                  x: 0,
                  rotate: -270,
                  scale: 0.8,
                  transition: {
                    x: { duration: 0.35, ease: [0.32, 0.72, 0, 1] },
                    rotate: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
                    scale: { duration: 0.25, delay: 0.2, ease: 'easeIn' },
                  },
                }
          }
          className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0 z-20 ${
            isSuccess
              ? 'text-emerald-500'
              : isError
              ? 'text-rose-500'
              : isLoading
              ? 'text-primary'
              : 'text-primary'
          }`}
        >
          {isSuccess ? (
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 overflow-visible"
              viewBox="0 0 24 24"
              fill="none"
            >
              <motion.path
                d="M5 13l5 5L19 7"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, scale: 0.6 }}
                animate={
                  isCurrentVisible
                    ? {
                        pathLength: 1,
                        scale: [0.6, 1.15, 1],
                        transition: {
                          pathLength: { duration: 0.28, delay: 0.82, ease: 'easeInOut' },
                          scale: { duration: 0.3, delay: 0.95, type: 'spring', stiffness: 450, damping: 14 },
                        },
                      }
                    : {
                        pathLength: 0,
                        scale: 0.6,
                        transition: { duration: 0.15, ease: 'easeIn' },
                      }
                }
              />
            </svg>
          ) : isError ? (
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 overflow-visible"
              viewBox="0 0 24 24"
              fill="none"
            >
              <motion.path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, scale: 0.6 }}
                animate={
                  isCurrentVisible
                    ? {
                        pathLength: 1,
                        scale: [0.6, 1.15, 1],
                        transition: {
                          pathLength: { duration: 0.28, delay: 0.82, ease: 'easeInOut' },
                          scale: { duration: 0.3, delay: 0.95, type: 'spring', stiffness: 450, damping: 14 },
                        },
                      }
                    : { pathLength: 0, scale: 0.6, transition: { duration: 0.15, ease: 'easeIn' } }
                }
              />
            </svg>
          ) : isLoading ? (
            <Loader2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 animate-spin" />
          ) : (
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 overflow-visible"
              viewBox="0 0 24 24"
              fill="none"
            >
              <motion.path
                d="M12 16v-4M12 8h.01"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, scale: 0.6 }}
                animate={
                  isCurrentVisible
                    ? {
                        pathLength: 1,
                        scale: [0.6, 1.15, 1],
                        transition: {
                          pathLength: { duration: 0.28, delay: 0.82, ease: 'easeInOut' },
                          scale: { duration: 0.3, delay: 0.95, type: 'spring', stiffness: 450, damping: 14 },
                        },
                      }
                    : { pathLength: 0, scale: 0.6, transition: { duration: 0.15, ease: 'easeIn' } }
                }
              />
            </svg>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default NeumorphicToast;
