import { AlertTriangle, CheckCircle2, Clock, Loader2, Wifi, WifiOff } from 'lucide-react';

/**
 * Presentation-only status model for the live tracker.
 * Groups the existing seven patient states into good / caution / problem.
 * The underlying freshness logic still lives in LiveVisitTrackerModal.
 */
export function getTrackingStatus({ arrived, approximate, live, stationary, session, provider }) {
  if (arrived) {
    return { level: 'good', label: 'Arrived', Icon: CheckCircle2, pulse: false };
  }
  if (approximate) {
    return { level: 'caution', label: 'Approximate location', Icon: AlertTriangle, pulse: false };
  }
  if (live) {
    return { level: 'good', label: 'Live GPS', Icon: Wifi, pulse: true };
  }
  if (stationary) {
    return { level: 'caution', label: 'Provider stationary', Icon: Clock, pulse: false };
  }
  if (session && session.status !== 'active') {
    return { level: 'caution', label: 'Tracking paused', Icon: Clock, pulse: false };
  }
  if (provider) {
    return { level: 'problem', label: 'Signal lost', Icon: WifiOff, pulse: false };
  }
  return { level: 'caution', label: 'Waiting for GPS', Icon: Loader2, pulse: false, spin: true };
}

/** Provider-side status: same three visual levels, different copy. */
export function getProviderStatus({ fix, error, stale }) {
  if (error) {
    return { level: 'problem', label: 'Location issue', Icon: WifiOff, pulse: false };
  }
  if (!fix) {
    return { level: 'caution', label: 'Acquiring GPS', Icon: Loader2, pulse: false, spin: true };
  }
  if (stale) {
    return { level: 'caution', label: 'GPS signal delayed', Icon: Clock, pulse: false };
  }
  if (fix.degraded) {
    return { level: 'caution', label: 'Approximate location', Icon: AlertTriangle, pulse: false };
  }
  return { level: 'good', label: 'On route · Live GPS', Icon: Wifi, pulse: true };
}

/** Keeps large accuracy values readable instead of printing ±1200m. */
export function formatAccuracy(metres) {
  if (!(metres > 0)) return null;
  if (metres >= 995) return `±${(metres / 1000).toFixed(1)}km`;
  return `±${Math.round(metres)}m`;
}

export function formatFreshness(ageS) {
  if (ageS == null) return 'waiting for signal';
  if (ageS < 5) return 'updated now';
  if (ageS < 60) return `updated ${ageS}s ago`;
  if (ageS < 3600) return `updated ${Math.floor(ageS / 60)}m ago`;
  return `updated ${Math.floor(ageS / 3600)}h ago`;
}
