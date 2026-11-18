import { Link } from 'react-router-dom';
import { Clock, ShieldWarning, ArrowRight } from '@phosphor-icons/react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ProviderVerificationBanner({
  loading = false,
  isApproved = false,
  isProfileComplete = false,
  professionalIdStatus = 'none',
  className = '',
}) {
  const { t } = useLanguage();

  if (loading || isApproved) return null;

  const isRejected = professionalIdStatus === 'rejected';
  const isIncomplete = !isProfileComplete;

  let toneClasses =
    'border-amber-500/35 bg-amber-500/5 text-amber-900 dark:text-amber-100';
  let iconTone = 'text-warning';
  let Icon = Clock;
  let title = t('provider.verification.pendingTitle');
  let body = t('provider.verification.pendingBody');
  let ctaLabel = t('provider.verification.viewProfileBtn');
  let ctaTo = '/provider/profile';

  if (isIncomplete) {
    title = t('provider.verification.incompleteTitle');
    body = t('provider.verification.incompleteBody');
    ctaLabel = t('provider.verification.completeOnboardingBtn');
    ctaTo = '/provider/onboarding';
  } else if (isRejected) {
    toneClasses = 'border-danger/35 bg-danger/5 text-slate-900 dark:text-slate-100';
    iconTone = 'text-danger dark:text-danger-dark';
    Icon = ShieldWarning;
    title = t('provider.verification.rejectedTitle');
    body = t('provider.verification.rejectedBody');
    ctaLabel = t('provider.verification.reuploadIdBtn');
    ctaTo = '/provider/onboarding?step=4';
  }

  return (
    <div
      role="status"
      className={`neu-flat rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${toneClasses} ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className={`neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconTone}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-snug">{title}</p>
          <p className="text-xs text-tertiary dark:text-slate-300 mt-0.5 leading-relaxed">
            {body}
          </p>
        </div>
      </div>

      <Link
        to={ctaTo}
        className="neu-btn min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-extrabold text-link inline-flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center"
      >
        <span>{ctaLabel}</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
