import { CheckCircle, Clock, XCircle } from '@phosphor-icons/react';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_STYLE_MAP = {
  completed: {
    Icon: CheckCircle,
    textClass: 'text-success dark:text-success-dark',
  },
  accepted: {
    Icon: CheckCircle,
    textClass: 'text-link',
  },
  pending: {
    Icon: Clock,
    textClass: 'text-warning dark:text-warning-dark',
  },
  cancelled: {
    Icon: XCircle,
    textClass: 'text-danger dark:text-danger-dark',
  },
  rejected: {
    Icon: XCircle,
    textClass: 'text-danger dark:text-danger-dark',
  },
};

const StatusBadge = ({ status, className = '' }) => {
  const { translateStatus } = useLanguage();
  const key = String(status || '').trim().toLowerCase();
  const { Icon, textClass } = STATUS_STYLE_MAP[key] || STATUS_STYLE_MAP.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold ${textClass} ${className}`.trim()}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {translateStatus(status)}
    </span>
  );
};

export default StatusBadge;
