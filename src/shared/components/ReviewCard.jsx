import React from 'react';
import { Star, ShieldCheck, Calendar, Quote } from 'lucide-react';

/**
 * Strips any legacy "[Service: X/5 | Comm: Y/5 | Punctual: Z/5]" prefix,
 * leaving only the respondent's authentic written feedback.
 */
export const cleanReviewText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/^\[Service:\s*[^\]]+\]\s*/i, '')
    .replace(/^\[Tags:\s*[^\]]+\]\s*/i, '')
    .trim();
};

const ReviewCard = ({
  review,
  variant = 'default', // 'default' | 'compact' | 'bordered'
  className = '',
}) => {
  if (!review) return null;

  const patientName = review.patient?.full_name || review.patientName || 'Verified Patient';
  const avatarUrl = review.patient?.avatar_url || review.patientAvatarUrl || '';
  const rating = Number(review.rating) || 5;
  const rawComment = review.review_text || review.comment || '';
  const cleanComment = cleanReviewText(rawComment);

  const formattedDate = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const getInitials = (name) => {
    return (name || 'P')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div
      className={`neu-flat p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-3 transition-all ${
        variant === 'bordered'
          ? 'border border-slate-200/60 dark:border-white/5 shadow-sm'
          : ''
      } ${className}`}
    >
      {/* Top Header: Patient identity, Verified badge, and Star rating */}
      <div className="flex items-start justify-between gap-3">
        {/* Patient Profile */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="neu-flat-sm w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden p-0.5 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={patientName}
                className="w-full h-full object-cover rounded-[10px] sm:rounded-xl"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-black text-xs sm:text-sm flex items-center justify-center rounded-[10px] sm:rounded-xl">
                {getInitials(patientName)}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
              {patientName}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-3xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                <span>Verified Visit</span>
              </span>
              {formattedDate && (
                <span className="text-3xs text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                  <Calendar className="w-2.5 h-2.5" />
                  {formattedDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating Score & Stars */}
        <div className="neu-inset px-2.5 py-1 rounded-xl flex items-center gap-1.5 shrink-0">
          <div className="flex text-amber-400">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                  star <= rating
                    ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                    : 'text-slate-300 dark:text-slate-600 fill-none'
                }`}
              />
            ))}
          </div>
          <span className="text-3xs sm:text-xs font-black text-amber-600 dark:text-amber-400">
            {rating.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Review Body */}
      {cleanComment ? (
        <div className="neu-inset p-3 sm:p-3.5 rounded-xl sm:rounded-2xl relative">
          <Quote className="w-3.5 h-3.5 text-primary/30 absolute top-2.5 right-3 pointer-events-none" />
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium italic pr-4">
            “{cleanComment}”
          </p>
        </div>
      ) : (
        <p className="text-3xs sm:text-xs text-slate-400 dark:text-slate-500 italic pl-1">
          Rated {rating} out of 5 stars with no additional comments.
        </p>
      )}
    </div>
  );
};

export default ReviewCard;
