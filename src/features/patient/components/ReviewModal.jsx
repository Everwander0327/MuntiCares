import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

const CATEGORIES = [
  { key: 'overall', label: 'Overall Experience', desc: 'General impression & satisfaction', required: true },
  { key: 'service', label: 'Service Quality', desc: 'Clinical care & medical procedure' },
  { key: 'communication', label: 'Communication', desc: 'Clarity, listening & friendliness' },
  { key: 'punctuality', label: 'Punctuality', desc: 'Timeliness of visit arrival' },
];

const RATING_LABELS = {
  1: 'Needs Improvement',
  2: 'Fair Experience',
  3: 'Good & Satisfactory',
  4: 'Very Good Care',
  5: 'Exceptional & Caring',
};

const ReviewModal = ({ isOpen, onClose, request, onReviewSubmitted }) => {
  const [ratings, setRatings] = useState({
    overall: 0,
    service: 0,
    communication: 0,
    punctuality: 0,
  });
  const [hovered, setHovered] = useState({ overall: 0, service: 0, communication: 0, punctuality: 0 });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
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

  const setRating = (key, val) => setRatings(prev => ({ ...prev, [key]: val }));
  const setHover = (key, val) => setHovered(prev => ({ ...prev, [key]: val }));

  const activeOverall = hovered.overall || ratings.overall;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (ratings.overall === 0) {
      toast.error('Please select an overall star rating.');
      return;
    }

    setSubmitting(true);

    const submittedCb = onReviewSubmitted;
    onClose();
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
          rating: ratings.overall,
          review_text: `[Service: ${ratings.service || 0}/5 | Comm: ${ratings.communication || 0}/5 | Punctual: ${ratings.punctuality || 0}/5] ${comment}`
        }]);

      if (reviewError) {
        console.warn('provider_reviews insert failed, falling back to direct provider rating update...', reviewError);
        const { data: providerData } = await supabase
          .from('providers')
          .select('rating')
          .eq('user_id', request.providerId)
          .single();

        const currentRating = providerData?.rating || 0;
        const updatedRating = currentRating === 0 ? ratings.overall : ((currentRating * 4) + ratings.overall) / 5;

        const { error: updateError } = await supabase
          .from('providers')
          .update({ rating: updatedRating })
          .eq('user_id', request.providerId);

        if (updateError) {
          console.warn('Direct provider rating update failed:', updateError);
        }
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
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
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
                  {request?.providerName || 'your provider'}
                </span>
                ?
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Overall Experience */}
              <div className="neu-flat-sm p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-center">
                  <span className="text-3xs sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Overall Experience <span className="text-rose-500">*</span>
                  </span>
                </div>

                {/* Star Rating Buttons */}
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 py-0.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= activeOverall;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating('overall', star)}
                        onMouseEnter={() => setHover('overall', star)}
                        onMouseLeave={() => setHover('overall', 0)}
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          active
                            ? 'neu-btn text-amber-500 scale-105'
                            : 'neu-flat-sm text-slate-300 dark:text-slate-600 hover:text-slate-400'
                        }`}
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-5 h-5 transition-all ${
                            active
                              ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                              : 'fill-none'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="h-5 flex items-center justify-center">
                  {activeOverall > 0 ? (
                    <span className="text-3xs font-black text-amber-600 dark:text-amber-400 neu-flat-sm px-2.5 py-0.5 rounded-full">
                      {RATING_LABELS[activeOverall]}
                    </span>
                  ) : (
                    <span className="text-3xs text-slate-400 dark:text-slate-500 font-medium">
                      Select 1 to 5 stars
                    </span>
                  )}
                </div>
              </div>

              {/* Detailed Categories Breakdown */}
              <div className="space-y-1.5">
                <p className="text-3xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
                  Detailed Feedback (Optional)
                </p>

                <div className="space-y-1.5">
                  {CATEGORIES.filter(c => c.key !== 'overall').map((cat) => (
                    <div
                      key={cat.key}
                      className="neu-flat-sm px-3 py-2 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                          {cat.label}
                        </p>
                        <p className="text-3xs text-slate-400 dark:text-slate-500 hidden sm:block truncate leading-tight">
                          {cat.desc}
                        </p>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = star <= (hovered[cat.key] || ratings[cat.key]);
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(cat.key, star)}
                              onMouseEnter={() => setHover(cat.key, star)}
                              onMouseLeave={() => setHover(cat.key, 0)}
                              className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer rounded-lg"
                              aria-label={`${cat.label} ${star} star`}
                            >
                              <Star
                                className={`w-3.5 h-3.5 transition-colors ${
                                  active
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-300 dark:text-slate-600 fill-none'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comment / Review Box */}
              <div className="space-y-1">
                <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
                  Share More Feedback
                </label>
                <div className="neu-inset rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comments or notes (optional)..."
                    rows={2}
                    className="w-full bg-transparent px-1.5 py-0.5 outline-none border-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="neu-btn px-4 py-2.5 sm:py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || ratings.overall === 0}
                  className={`px-4 py-2.5 sm:py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${
                    ratings.overall === 0
                      ? 'neu-flat-sm text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                      : 'neu-btn-primary shadow-md'
                  }`}
                >
                  {submitting ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
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
