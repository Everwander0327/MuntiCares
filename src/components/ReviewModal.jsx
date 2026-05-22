import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

const ReviewModal = ({ isOpen, onClose, request, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !request) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Try to insert into provider_reviews
      const { error: reviewError } = await supabase
        .from('provider_reviews')
        .insert([{
          patient_id: request.patientId || null,
          provider_id: request.providerId,
          request_id: request.id,
          rating: rating,
          review_text: comment
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
        const updatedRating = currentRating === 0 ? rating : ((currentRating * 4) + rating) / 5;

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

      toast.success('Thank you! Your review has been submitted.');
      
      // Store in localStorage that this request has been rated
      const rated = JSON.parse(localStorage.getItem('rated_requests') || '{}');
      rated[request.id] = true;
      localStorage.setItem('rated_requests', JSON.stringify(rated));

      if (onReviewSubmitted) onReviewSubmitted(request.id);
      onClose();
    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="bg-white rounded-[2.5rem] p-8 max-w-md w-full border border-slate-100 shadow-2xl relative"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={onClose} 
            className="absolute right-6 top-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <span className="text-3xl">🎉</span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">Rate Your Visit</h2>
              <p className="text-sm text-slate-500 mt-1">How was your care session with <span className="font-bold text-primary">{request.providerName}</span>?</p>
            </div>

            {/* Stars Selector */}
            <div className="flex justify-center gap-2 py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star 
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoverRating || rating) 
                        ? 'fill-amber-400 text-amber-400' 
                        : 'text-slate-200 fill-none'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Comment Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Share your feedback (Optional)</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Write about the provider's professionalism, care, or anything else..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm resize-none text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 border border-slate-100 hover:bg-slate-50 rounded-2xl font-bold text-slate-600 transition-all text-sm"
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
