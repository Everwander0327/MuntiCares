import { Star, ShieldCheck, Calendar, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  onContact,
}) => {
  if (!review) return null;

  const patientName = review.patient?.full_name || review.patientName || 'Verified Patient';
  const avatarUrl = review.patient?.avatar_url || review.patientAvatarUrl || '';
  const rating = Number(review.rating) || 5;
  const rawComment = review.review_text || review.comment || '';
  const cleanComment = cleanReviewText(rawComment);
  const service = review.service || review.request?.service || '';
  const patientId = review.patient_id || review.patientId || '';
  const contactUrl = review.contactUrl || (patientId ? `/provider/messages?partner=${patientId}&name=${encodeURIComponent(patientName)}` : '');

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
      <div className="flex items-start gap-3">
        {/* Patient Profile Avatar */}
        <div className="neu-flat-sm w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden p-0.5 flex items-center justify-center shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={patientName}
              className="w-full h-full object-cover rounded-[10px] sm:rounded-xl"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 text-link font-black text-xs sm:text-sm flex items-center justify-center rounded-[10px] sm:rounded-xl">
              {getInitials(patientName)}
            </div>
          )}
        </div>

        {/* Patient Info & Star Rating */}
        <div className="min-w-0 flex-1">
          {/* Top Line: Patient Name & Rating */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
              {patientName}
            </h4>

            {/* Rating Score & Stars */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                      star <= rating
                        ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                        : 'text-tertiary/40 fill-none'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs sm:text-xs font-black text-amber-500 dark:text-amber-400">
                {rating.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Subtitle: Verified Badge & Date */}
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-2xs sm:text-xs font-bold text-success dark:text-success-dark shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Verified Visit</span>
            </span>
            {formattedDate && (
              <span className="inline-flex items-center gap-1.5 text-2xs sm:text-xs text-tertiary dark:text-tertiary shrink-0">
                <span className="text-tertiary/60">&bull;</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{formattedDate}</span>
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Review Body (Clean quote with left border, no giant chunky inset box) */}
      {cleanComment ? (
        <div className="pl-3.5 border-l-2 border-slate-300 dark:border-slate-700 py-1">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
            &ldquo;{cleanComment}&rdquo;
          </p>
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-tertiary dark:text-tertiary italic pl-1">
          Rated {rating} out of 5 stars with no additional comments.
        </p>
      )}

      {/* Clinician Follow-up Action Bar (Service + Contact Patient) */}
      {(service || contactUrl || onContact) && (
        <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-2xs sm:text-xs text-tertiary truncate">
            {service ? `Service: ${service}` : 'Home Visit Service'}
          </span>
          {contactUrl ? (
            <Link
              to={contactUrl}
              className="neu-btn px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold text-tertiary hover:text-link hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1.5 shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5 text-link" />
              <span>Contact Patient</span>
            </Link>
          ) : onContact ? (
            <button
              type="button"
              onClick={onContact}
              className="neu-btn px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold text-tertiary hover:text-link hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-link" />
              <span>Contact Patient</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ReviewCard;
