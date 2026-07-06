import { useState } from 'react';
import { X, Star, Check, Info } from 'lucide-react';

const CATEGORIES = [
  { key: 'overall', label: 'Overall Experience' },
  { key: 'service', label: 'Service Quality' },
  { key: 'communication', label: 'Communication' },
  { key: 'punctuality', label: 'Punctuality' },
];

const ReviewModal = ({ isOpen, onClose, request }) => {
  const [ratings, setRatings] = useState({ overall: 0, service: 0, communication: 0, punctuality: 0 });
  const [comment, setComment] = useState('');
  const [comingSoon, setComingSoon] = useState(false);

  if (!isOpen) return null;

  const setRating = (key, val) => setRatings(prev => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    setComingSoon(true);
    setTimeout(() => { setComingSoon(false); onClose(); }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">Rate Your Experience</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          {comingSoon && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700 font-semibold">
              <Info className="w-4 h-4" /> Reviews are coming soon.
            </div>
          )}

          <p className="text-sm text-slate-600">
            How was your experience with <span className="font-bold">{request?.provider || 'Provider'}</span>?
          </p>

          {CATEGORIES.map(cat => (
            <div key={cat.key}>
              <p className="text-sm font-semibold text-slate-700 mb-2">{ratings[cat.key] > 0 ? cat.label : `${cat.label} (tap to rate)`}</p>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setRating(cat.key, star)} className="p-0.5">
                    <Star className={`w-7 h-7 ${star <= ratings[cat.key] ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Write a comment (optional)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Share your experience..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary resize-none" />
          </div>

          <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Submit Review
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
