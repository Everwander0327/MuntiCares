import {
  Warning,
  CheckCircle,
  Clock,
  SpinnerGap,
  WifiHigh,
  WifiSlash,
} from '@phosphor-icons/react';
import { translate } from '@/i18n';

/**
 * Presentation-only status model for the live tracker.
 * Groups the existing seven patient states into good / caution / problem.
 * The underlying freshness logic still lives in LiveVisitTrackerModal.
 */
export function getTrackingStatus({ arrived, approximate, live, stationary, session, provider, language = 'en' }) {
  if (arrived) {
    return { level: 'good', label: translate(language, 'tracking.status.arrived'), Icon: CheckCircle, pulse: false };
  }
  if (approximate) {
    return { level: 'caution', label: translate(language, 'tracking.status.approximate'), Icon: Warning, pulse: false };
  }
  if (live) {
    return { level: 'good', label: translate(language, 'tracking.status.liveGps'), Icon: WifiHigh, pulse: true };
  }
  if (stationary) {
    return { level: 'caution', label: translate(language, 'tracking.status.stationary'), Icon: Clock, pulse: false };
  }
  if (session && session.status !== 'active') {
    return { level: 'caution', label: translate(language, 'tracking.status.paused'), Icon: Clock, pulse: false };
  }
  if (provider) {
    return { level: 'problem', label: translate(language, 'tracking.status.signalLost'), Icon: WifiSlash, pulse: false };
  }
  return { level: 'caution', label: translate(language, 'tracking.status.waitingGps'), Icon: SpinnerGap, pulse: false, spin: true };
}

/** Provider-side status: same three visual levels, different copy. */
export function getProviderStatus({ fix, error, stale, language = 'en' }) {
  if (error) {
    return { level: 'problem', label: translate(language, 'tracking.status.locationIssue'), Icon: WifiSlash, pulse: false };
  }
  if (!fix) {
    return { level: 'caution', label: translate(language, 'tracking.status.acquiringGps'), Icon: SpinnerGap, pulse: false, spin: true };
  }
  if (stale) {
    return { level: 'caution', label: translate(language, 'tracking.status.gpsDelayed'), Icon: Clock, pulse: false };
  }
  if (fix.degraded) {
    return { level: 'caution', label: translate(language, 'tracking.status.approximate'), Icon: Warning, pulse: false };
  }
  return { level: 'good', label: translate(language, 'tracking.status.onRouteLive'), Icon: WifiHigh, pulse: true };
}

/** Keeps large accuracy values readable instead of printing ±1200m. */
export function formatAccuracy(metres) {
  if (!(metres > 0)) return null;
  if (metres >= 995) return `±${(metres / 1000).toFixed(1)}km`;
  return `±${Math.round(metres)}m`;
}

export function formatFreshness(ageS, language = 'en') {
  if (ageS == null) return translate(language, 'tracking.freshness.waiting');
  if (ageS < 5) return translate(language, 'tracking.freshness.now');
  if (ageS < 60) return translate(language, 'tracking.freshness.sec', { count: ageS });
  if (ageS < 3600) return translate(language, 'tracking.freshness.min', { count: Math.floor(ageS / 60) });
  return translate(language, 'tracking.freshness.hr', { count: Math.floor(ageS / 3600) });
}
