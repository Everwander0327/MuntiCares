/**
 * Pure formatting and analytics helpers for the Admin Platform Analytics Bento dashboard.
 */
import { DEFAULT_LANGUAGE, formatLocalizedDate, translate } from '@/i18n';

export function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'MC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function computeUserShares(patients = 0, providers = 0) {
  const safePatients = Math.max(0, Number(patients) || 0);
  const safeProviders = Math.max(0, Number(providers) || 0);
  const total = safePatients + safeProviders;

  if (total === 0) {
    return { total: 0, patientShare: '0%', providerShare: '0%' };
  }

  const patPct = ((safePatients / total) * 100).toFixed(1);
  const proPct = (100 - Number(patPct)).toFixed(1);
  return {
    total,
    patientShare: `${patPct}%`,
    providerShare: `${proPct}%`,
  };
}

export function buildSparklinePoints(values = [], width = 64, height = 22, padding = 2) {
  if (!Array.isArray(values) || values.length === 0) return '';

  const nums = values.map((v) => Math.max(0, Number(v) || 0));
  const bottomY = height - padding;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  if (nums.length === 1) {
    const y = nums[0] > 0 ? padding : bottomY;
    return `${padding},${y} ${width - padding},${y}`;
  }

  const max = Math.max(...nums);
  if (max === 0) {
    return nums
      .map((_, idx) => {
        const x = padding + (idx / (nums.length - 1)) * usableW;
        return `${Number(x.toFixed(1))},${bottomY}`;
      })
      .join(' ');
  }

  return nums
    .map((val, idx) => {
      const x = padding + (idx / (nums.length - 1)) * usableW;
      const y = bottomY - (val / max) * usableH;
      return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
    })
    .join(' ');
}

export function computeBookingMomentum(monthlyBars = [], language = DEFAULT_LANGUAGE) {
  if (!Array.isArray(monthlyBars) || monthlyBars.length === 0) {
    return translate(language, 'admin.dashboard.metrics.zeroRecent');
  }

  const latest = monthlyBars[monthlyBars.length - 1] || {};
  const prev = monthlyBars.length > 1 ? monthlyBars[monthlyBars.length - 2] : null;
  const latestVal = Math.max(0, Number(latest.requests) || 0);
  const prevVal = Math.max(0, Number(prev?.requests) || 0);
  const monthLabel = latest.month || translate(language, 'admin.dashboard.metrics.now');

  if (prevVal > 0 && latestVal >= prevVal * 2) {
    const multiplier = Number((latestVal / prevVal).toFixed(1));
    return `${multiplier}x ${monthLabel}`;
  }

  if (latestVal > 0) {
    return `+${latestVal} ${monthLabel}`;
  }

  return `0 ${monthLabel}`;
}

export function getPeakBookingMonth(monthlyBars = [], language = DEFAULT_LANGUAGE) {
  if (!Array.isArray(monthlyBars) || monthlyBars.length === 0) {
    return translate(language, 'admin.dashboard.metrics.noBookings');
  }

  let peak = null;
  for (const item of monthlyBars) {
    const count = Math.max(0, Number(item?.requests) || 0);
    if (count > 0 && (!peak || count > peak.count)) {
      peak = { month: item.month, count };
    }
  }

  return peak
    ? translate(language, 'admin.dashboard.metrics.peakBooking', { month: peak.month, count: peak.count })
    : translate(language, 'admin.dashboard.metrics.noBookings');
}

const STATUS_BADGE_MAP = {
  completed: 'bg-success-soft/80 dark:bg-success-darkSoft text-success dark:text-success-dark border border-success/25 dark:border-success-dark/25',
  accepted: 'bg-primary-soft/90 dark:bg-primary-800/80 text-link border border-primary/25 dark:border-primary-400/25',
  pending: 'bg-warning-soft/90 dark:bg-warning-darkSoft text-warning dark:text-warning-dark border border-warning/25 dark:border-warning-dark/25',
  cancelled: 'bg-danger-soft/90 dark:bg-danger-darkSoft text-danger dark:text-danger-dark border border-danger/25 dark:border-danger-dark/25',
  rejected: 'bg-danger-soft/90 dark:bg-danger-darkSoft text-danger dark:text-danger-dark border border-danger/25 dark:border-danger-dark/25',
};

export function getStatusBadgeClass(status) {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_BADGE_MAP[key] || STATUS_BADGE_MAP.pending;
}

export function formatRangeSubtitle(startDate, endDate, activePreset = 'ALL', language = DEFAULT_LANGUAGE) {
  if (!startDate && !endDate) return translate(language, 'admin.dashboard.metrics.allTimeOverview');
  if (activePreset === '30D') return translate(language, 'admin.dashboard.metrics.last30Overview');
  if (activePreset === '6M') return translate(language, 'admin.dashboard.metrics.last6mOverview');
  return translate(language, 'admin.dashboard.metrics.rangeOverview', {
    start: startDate || '...',
    end: endDate || '...',
  });
}

export function formatScheduledSlot(dateStr, timeStr, language = DEFAULT_LANGUAGE) {
  let formattedDate = '';
  if (dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim());
    if (match) {
      const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      formattedDate = formatLocalizedDate(d, language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } else {
      formattedDate = String(dateStr).trim();
    }
  }

  let formattedTime = '';
  if (timeStr) {
    const rawTime = String(timeStr).trim();
    const hmsMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(rawTime);
    if (hmsMatch) {
      const hours24 = Number(hmsMatch[1]);
      const minutes = hmsMatch[2];
      const period = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      formattedTime = `${hours12}:${minutes} ${period}`;
    } else {
      formattedTime = rawTime;
    }
  }

  const parts = [formattedDate, formattedTime].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}
