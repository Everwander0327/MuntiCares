import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Star } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { markRequestRated } from '@/features/patient/utils/localState';

const RATING_LABELS = {
  1: 'Needs Improvement',
  2: 'Fair Experience',
  3: 'Good Experience',
  4: 'Very Good Care',
  5: 'Exceptional Care',
};

const POSITIVE_TAGS = [
  'Attentive & Caring',
  'Arrived On Time',
  'Clear Explanations',
  'Gentle Care',
  'Highly Recommended',
];

const CONSTRUCTIVE_TAGS = [
  'Arrived Late',
  'Felt Rushed',
  'Unclear Explanations',
  'Communication Issue',
  'Needs Follow-up',
];

const getInitials = (name) =>
  (name || 'Care Provider')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const ReviewModal = ({ isOpen, onClose, request, onReviewSubmitted }) => {
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [ratingTriggerCount, setRatingTriggerCount] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setRating(0);
    setHovered(0);
    setRatingTriggerCount(0);
    setSelectedTags([]);
    setComment('');
    onClose();
  }, [onClose]);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const activeRating = hovered || rating;
  const isLowMood = activeRating > 0 && activeRating <= 2;
  const moodKey = isLowMood ? 'constructive' : 'positive';
  const tags = isLowMood ? CONSTRUCTIVE_TAGS : POSITIVE_TAGS;

  const handleSelectStar = (star) => {
    const wasLow = rating > 0 && rating <= 2;
    const nextLow = star <= 2;
    if (wasLow !== nextLow) {
      setSelectedTags([]);
    }
    setRating(star);
    setRatingTriggerCount((prev) => prev + 1);
  };

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating.');
      return;
    }

    setSubmitting(true);

    const currentRatingVal = rating;
    const tagText = selectedTags.join('. ');
    const typedText = comment.trim();
    const cleanComment = [tagText, typedText].filter(Boolean).join('. ') || null;
    const submittedCb = onReviewSubmitted;

    try {
      const { error: reviewError } = await supabase
        .from('provider_reviews')
        .insert([
          {
            patient_id: request.patientId || null,
            provider_id: request.providerId,
            request_id: request.id,
            rating: currentRatingVal,
            review_text: cleanComment,
          },
        ]);

      // Nothing is announced until the row exists: report accurate state.
      if (reviewError) throw reviewError;

      const { data: allReviews } = await supabase
        .from('provider_reviews')
        .select('rating')
        .eq('provider_id', request.providerId);

      let updatedRating = currentRatingVal;
      if (allReviews && allReviews.length > 0) {
        const sum = allReviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
        updatedRating = Number((sum / allReviews.length).toFixed(2));
      } else {
        const { data: providerData } = await supabase
          .from('providers')
          .select('rating')
          .eq('user_id', request.providerId)
          .single();

        const currentRating = providerData?.rating || 0;
        updatedRating =
          currentRating === 0
            ? currentRatingVal
            : (currentRating * 4 + currentRatingVal) / 5;
      }

      const { error: updateError } = await supabase
        .from('providers')
        .update({ rating: updatedRating })
        .eq('user_id', request.providerId);

      if (updateError) {
        console.warn('Direct provider rating update failed:', updateError);
      }

      markRequestRated(user?.id, request.id);
      handleClose();
      toast.success('Thank you! Your review has been submitted.');
      if (!shouldReduceMotion) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      }
      if (submittedCb) submittedCb(request.id);
    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error('Your review could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  const providerName = request?.providerName || 'your healthcare provider';
  const serviceLabel = request?.service || 'Care Session';

  const sentimentColorClass =
    activeRating === 0
      ? 'text-tertiary'
      : isLowMood
      ? 'text-warning dark:text-warning-dark'
      : 'text-success dark:text-success-dark';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 md:backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 44 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 44 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            drag={shouldReduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 400) {
                handleClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="neu-flat bg-surface-shell w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border-t sm:border border-surface-border max-h-[92dvh] flex flex-col overflow-hidden transform-gpu will-change-transform"
          >
            {/* Mobile drag handle */}
            <div
              className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-surface-border sm:hidden shrink-0"
              aria-hidden="true"
            />

            {/* Provider-Anchored Header (Zero X button) */}
            <div className="px-5 pt-4 pb-3.5 border-b border-surface-border/70 flex items-center gap-3.5 shrink-0">
              <motion.div
                animate={
                  !shouldReduceMotion && activeRating >= 4
                    ? {
                        boxShadow: [
                          '0 0 0 0 rgba(44, 122, 85, 0.35)',
                          '0 0 0 7px rgba(44, 122, 85, 0)',
                        ],
                      }
                    : { boxShadow: '0 0 0 0 rgba(44, 122, 85, 0)' }
                }
                transition={
                  !shouldReduceMotion && activeRating >= 4
                    ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.2 }
                }
                className="neu-flat-sm w-12 h-12 rounded-2xl flex items-center justify-center text-link dark:text-primary-400 font-black text-sm shrink-0 overflow-hidden aspect-square"
              >
                {request?.providerAvatarUrl ? (
                  <img
                    src={request.providerAvatarUrl}
                    alt={providerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(providerName)
                )}
              </motion.div>

              <div className="min-w-0 flex-1">
                <h2
                  id="review-modal-title"
                  className="text-lg font-display font-extrabold text-ink dark:text-white tracking-tight truncate"
                >
                  Rate Your Care Session
                </h2>
                <p className="text-sm font-medium text-tertiary truncate mt-0.5">
                  {providerName} — {serviceLabel}
                </p>
              </div>
            </div>

            {/* Scrollable Body + Sticky Thumb-Zone Footer */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 space-y-5 overflow-y-auto flex-1 overscroll-contain no-scrollbar">
                {/* Tactile Bare Star Rating with Preset C Tilt-Burst & 5th-Star Halo */}
                <div className="text-center space-y-2 py-1">
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= activeRating;
                      const isTriggeredFill = star <= rating;
                      const showFifthRing =
                        !shouldReduceMotion && star === 5 && rating === 5 && ratingTriggerCount > 0;

                      return (
                        <motion.button
                          key={star}
                          type="button"
                          onClick={() => handleSelectStar(star)}
                          onMouseEnter={() => setHovered(star)}
                          onMouseLeave={() => setHovered(0)}
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.88 }}
                          className="relative min-w-[44px] min-h-[44px] p-1.5 rounded-2xl flex items-center justify-center cursor-pointer focus:outline-none text-surface-border"
                          aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        >
                          <motion.span
                            key={
                              isTriggeredFill && ratingTriggerCount > 0
                                ? `pop-${star}-${ratingTriggerCount}`
                                : `idle-${star}`
                            }
                            initial={
                              !shouldReduceMotion && isTriggeredFill && ratingTriggerCount > 0
                                ? { scale: 0.76, rotate: -14 }
                                : false
                            }
                            animate={
                              !shouldReduceMotion && isTriggeredFill && ratingTriggerCount > 0
                                ? { scale: [0.76, 1.26, 0.96, 1], rotate: [-14, 8, -3, 0] }
                                : { scale: hovered === star ? 1.1 : 1, rotate: 0 }
                            }
                            transition={{
                              duration: 0.42,
                              delay:
                                !shouldReduceMotion && isTriggeredFill && ratingTriggerCount > 0
                                  ? (star - 1) * 0.045
                                  : 0,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="inline-flex items-center justify-center"
                          >
                            <Star
                              className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors duration-150 ${
                                active
                                  ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                                  : 'fill-none text-tertiary/60 stroke-[1.8]'
                              }`}
                            />
                          </motion.span>

                          {showFifthRing && (
                            <motion.span
                              key={`ring-${ratingTriggerCount}`}
                              initial={{ opacity: 0.9, scale: 0.55 }}
                              animate={{ opacity: 0, scale: 1.75 }}
                              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                              className="absolute inset-1 rounded-full border-2 border-amber-400 pointer-events-none"
                              aria-hidden="true"
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Animated Sentiment Slot Transition */}
                  <div className="min-h-[24px] flex items-center justify-center overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={activeRating}
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className={`text-sm font-extrabold ${sentimentColorClass}`}
                      >
                        {activeRating > 0
                          ? `${activeRating} of 5 — ${RATING_LABELS[activeRating]}`
                          : 'Tap a star to rate'}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Adaptive Quick Highlights (Toggles ON/OFF, Zero Sparkle Icon) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                      {isLowMood ? 'What could have gone better?' : 'What went well?'}
                    </span>
                    <span className="text-xs font-semibold text-tertiary tabular-nums">
                      {selectedTags.length > 0 ? `${selectedTags.length} selected` : 'Optional'}
                    </span>
                  </div>

                  <motion.div key={moodKey} className="flex flex-wrap gap-2">
                    {tags.map((tag, idx) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <motion.button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          initial={
                            shouldReduceMotion
                              ? false
                              : { opacity: 0, y: 8, scale: 0.94 }
                          }
                          animate={{ opacity: 1, y: 0, scale: isSelected ? 1.02 : 1 }}
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                          transition={{
                            duration: 0.28,
                            delay: shouldReduceMotion ? 0 : idx * 0.035,
                            ease: [0.34, 1.56, 0.64, 1],
                          }}
                          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            isSelected
                              ? 'neu-btn-primary shadow-sm'
                              : 'neu-btn text-ink dark:text-slate-200 hover:text-link'
                          }`}
                        >
                          {tag}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </div>

                {/* Optional Written Feedback */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="review-comment-input"
                    className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block px-0.5"
                  >
                    Additional note
                  </label>
                  <div className="neu-inset rounded-2xl p-3 transition-all">
                    <textarea
                      id="review-comment-input"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share details about your consultation, care received, or provider bedside manner..."
                      rows={3}
                      className="w-full bg-transparent outline-none border-none text-sm text-ink dark:text-slate-100 placeholder:text-tertiary resize-none font-medium leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Sticky Thumb-Zone Footer (Full-Width CTA + Quiet Cancel Action) */}
              <div className="px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-surface-border/70 bg-surface-shell space-y-1.5 shrink-0">
                <button
                  type="submit"
                  disabled={submitting || rating === 0}
                  className={`relative overflow-hidden w-full min-h-[46px] px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center transition-all active:scale-[0.98] ${
                    rating === 0
                      ? 'neu-flat-sm text-tertiary opacity-60 cursor-not-allowed'
                      : 'neu-btn-primary shadow-md cursor-pointer'
                  }`}
                >
                  {!shouldReduceMotion && rating === 5 && !submitting && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ x: '-120%', skewX: -18 }}
                      animate={{ x: '220%', skewX: -18 }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        repeatDelay: 1.2,
                        ease: 'easeInOut',
                      }}
                      className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
                    />
                  )}
                  <span className="relative z-10">
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="w-full min-h-[38px] py-1.5 rounded-xl text-xs font-bold text-tertiary hover:text-ink dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ReviewModal;
