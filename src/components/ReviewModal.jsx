import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

const CATEGORIES = [
  { key: 'overall', label: 'Overall Experience', required: true },
  { key: 'service', label: 'Service Quality' },
  { key: 'communication', label: 'Communication' },
  { key: 'punctuality', label: 'Punctuality' },
];

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

  if (!isOpen || !request) return null;

  const setRating = (key, val) => setRatings(prev => ({ ...prev, [key]: val }));
  const setHover = (key, val) => setHovered(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (ratings.overall === 0) {
      toast.error('Please select an overall star rating.');
      return;
    }

    setSubmitting(true);

    // Optimistic: close immediately
    const close = onClose;
    const submittedCb = onReviewSubmitted;
    close();
    toast.success('Thank you! Your review has been submitted.');
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    if (submittedCb) submittedCb(request.id);
    const rated = JSON.parse(localStorage.getItem('rated_requests') || '{}');
    rated[request.id] = true;
    localStorage.setItem('rated_requests', JSON.stringify(rated));

    // Background: persist to DB
    try {
      // 1. Try to insert into provider_reviews
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

        // Fallback: Directly update the provider rating in providers table using moving average
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

        if (updateError) throw updateError;
      } else {
        // Successful insert in provider_reviews! Now let's update providers average rating
        const { data: allReviews } = await supabase
          .from('provider_reviews')
          .select('rating')
          .eq('provider_id', request.providerId);

        if (allReviews && allReviews.length > 0) {
          const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
          await supabase
            .from('providers')
            .update({ rating: avg })
            .eq('user_id', request.providerId);
        }
      }

    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error('Your review is saved locally but failed to sync to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 shadow-2xl relative"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={onClose} 
            className="absolute right-6 top-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <span className="text-3xl">🎉</span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">Rate Your Visit</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">How was your care session with <span className="font-bold text-primary">{request.providerName}</span>?</p>
            </div>

            {/* Category Ratings */}
            <div className="space-y-4">
              {CATEGORIES.map(cat => (
                <div key={cat.key} className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{cat.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => {
                      const active = star <= (hovered[cat.key] || ratings[cat.key]);
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(cat.key, star)}
                          onMouseEnter={() => setHover(cat.key, star)}
                          onMouseLeave={() => setHover(cat.key, 0)}
                          className="p-0.5 hover:scale-110 active:scale-95 transition-transform"
                        >
                          <Star className={`w-5 h-5 transition-colors ${
                            active ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-600 fill-none'
                          }`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Comment Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Share your feedback (Optional)</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Write about the provider's professionalism, care, or anything else..."
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl font-bold text-slate-600 dark:text-slate-300 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm"
              >
                {submitting ? 'Submitting...' : (
                  <>
                    <Check className="w-4 h-4" />
                    Submit Review
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReviewModal;
