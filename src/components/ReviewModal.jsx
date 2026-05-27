import { useState } from 'react';
import { Star, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

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

  const setRating = (key, val) => setRatings(prev => ({ ...prev, [key]: val }));
  const setHover = (key, val) => setHovered(prev => ({ ...prev, [key]: val }));

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

        if (updateError) throw updateError;
      } else {
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-8">
        <DialogHeader>
          <div className="text-center">
            <span className="text-3xl">🎉</span>
            <DialogTitle className="mt-2">Rate Your Visit</DialogTitle>
            <DialogDescription className="mt-1">
              How was your care session with <span className="font-bold text-primary">{request?.providerName}</span>?
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                        className="p-0.5 hover:scale-110 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
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

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : (
                <><Check className="w-4 h-4" /> Submit Review</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewModal;
