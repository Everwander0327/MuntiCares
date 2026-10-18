import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

const RATING_LABELS = {
  1: 'Needs Improvement',
  2: 'Fair Experience',
  3: 'Good & Satisfactory',
  4: 'Very Good Care',
  5: 'Exceptional & Caring',
};

const QUICK_TAGS = [
  'Attentive & Caring',
  'Arrived On Time',
  'Clear Explanations',
  'Gentle & Patient Care',
  'Highly Recommended',
];

const ReviewModal = ({ isOpen, onClose, request, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setRating(0);
    setHovered(0);
    setComment('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    if (isOpen) {
      document.body.classList.add('modal-open');
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const activeRating = hovered || rating;

  const handleTagClick = (tag) => {
    setComment((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return trimmed;
      return `${trimmed}. ${tag}`;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating.');
      return;
    }

    setSubmitting(true);

    const currentRatingVal = rating;
    const cleanComment = comment.trim() || null;
    const submittedCb = onReviewSubmitted;
    handleClose();
    toast.success('Thank you! Your review has been submitted.');
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    if (submittedCb) submittedCb(request.id);
    const rated = JSON.parse(localStorage.getItem('rated_requests') || '{}');
    rated[request.id] = true;
    localStorage.setItem('rated_requests', JSON.stringify(rated));

    try {
      const { error: reviewError } = await supabase
        .from('provider_reviews')
        .insert([{
          patient_id: request.patientId || null,
          provider_id: request.providerId,
          request_id: request.id,
          rating: currentRatingVal,
          review_text: cleanComment
        }]);

      if (reviewError) {
        console.warn('provider_reviews insert failed, falling back to direct provider rating update...', reviewError);
      }

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
        updatedRating = currentRating === 0 ? currentRatingVal : ((currentRating * 4) + currentRatingVal) / 5;
      }

      const { error: updateError } = await supabase
        .from('providers')
        .update({ rating: updatedRating })
        .eq('user_id', request.providerId);

      if (updateError) {
        console.warn('Direct provider rating update failed:', updateError);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error('Your review is saved locally but failed to sync to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="neu-flat w-full max-w-lg rounded-t-[2.25rem] sm:rounded-[2.25rem] p-5 sm:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl border-t sm:border border-white/60 dark:border-white/10 max-h-[92dvh] overflow-y-auto no-scrollbar transform-gpu will-change-transform"
          >
            {/* Mobile handle indicator */}
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" aria-hidden="true" />

            {/* Header */}
            <div className="text-center space-y-1 pt-0 sm:pt-1 pb-1">
              <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                Rate Your Care Session
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                How was your experience with{' '}
                <span className="font-extrabold text-primary">
                  {request?.providerName || 'your healthcare provider'}
                </span>
                ?
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Single Unified Star Rating */}
              <div className="neu-flat-sm p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-2 text-center">
                <span className="text-3xs sm:text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Select Your Rating <span className="text-rose-500">*</span>
                </span>

                {/* Star Buttons */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= activeRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHovered(star)}
                        onMouseLeave={() => setHovered(0)}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                          active
                            ? 'neu-btn text-amber-500 scale-105'
                            : 'neu-flat-sm text-slate-300 dark:text-slate-600 hover:text-slate-400'
                        }`}
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-6 h-6 transition-all ${
                            active
                              ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                              : 'fill-none stroke-[1.8]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="h-6 flex items-center justify-center">
                  {activeRating > 0 ? (
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 neu-flat-sm px-3.5 py-1 rounded-full border border-amber-500/20">
                      {RATING_LABELS[activeRating]}
                    </span>
                  ) : (
                    <span className="text-3xs text-slate-400 dark:text-slate-500 font-medium">
                      Tap a star to rate
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Compliments / Feedback Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-3xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    Quick Highlights
                  </span>
                  <span className="text-3xs text-slate-400">Tap to add</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TAGS.map((tag) => {
                    const isSelected = comment.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagClick(tag)}
                        className={`px-2.5 py-1 rounded-xl text-3xs sm:text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'neu-btn-primary shadow-sm'
                            : 'neu-flat-sm text-slate-600 dark:text-slate-300 hover:text-primary'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Patient Written Comment */}
              <div className="space-y-1.5">
                <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
                  Your Feedback (Optional)
                </label>
                <div className="neu-inset rounded-2xl p-2.5 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share details about your consultation, care received, or provider bedside manner..."
                    rows={3}
                    className="w-full bg-transparent px-1.5 py-0.5 outline-none border-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none font-medium leading-relaxed"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="neu-btn px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || rating === 0}
                  className={`px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${
                    rating === 0
                      ? 'neu-flat-sm text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                      : 'neu-btn-primary shadow-md'
                  }`}
                >
                  {submitting ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Submit Review</span>
                    </>
                  )}
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
