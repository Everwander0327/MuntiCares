import { Capacitor, registerPlugin } from '@capacitor/core';
import { ensureNotificationPermission } from './trackingNotifications';

/**
 * Unified location source.
 *  - Native (Capacitor Android/iOS): background geolocation with foreground-service notification,
 *    keeps working when the phone is locked.
 *  - Web: navigator.geolocation.watchPosition + Screen Wake Lock (tab must stay open).
 *
 * onFix receives { lat, lng, accuracy, heading, speed, timestamp }.
 * Returns an async stop() function.
 */
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

export const isNative = () => Capacitor.isNativePlatform();

export async function startLocationWatch(onFix, onError) {
  if (isNative()) return startNative(onFix, onError);
  return startWeb(onFix, onError);
}

async function startNative(onFix, onError) {
  await ensureNotificationPermission();
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'MuntiCares – On the way',
      backgroundMessage: 'Sharing your live location with the patient.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5,
    },
    (loc, err) => {
      if (err) {
        if (err.code === 'NOT_AUTHORIZED') {
          onError?.(new Error('Location permission denied. Enable "Allow all the time" in Settings.'));
          if (window.confirm('Location access is required for live tracking. Open settings?')) {
            BackgroundGeolocation.openSettings();
          }
        } else onError?.(err);
        return;
      }
      onFix({
        lat: loc.latitude,
        lng: loc.longitude,
        accuracy: loc.accuracy,
        heading: loc.bearing ?? null,
        speed: loc.speed ?? null,
        timestamp: loc.time || Date.now(),
      });
    }
  );
  return async () => {
    try { await BackgroundGeolocation.removeWatcher({ id }); } catch { /* ignore */ }
  };
}

async function startWeb(onFix, onError) {
  if (!('geolocation' in navigator)) {
    onError?.(new Error('Geolocation is not supported on this browser/device.'));
    return async () => {};
  }
  if (!window.isSecureContext) {
    onError?.(new Error('Live tracking requires HTTPS. If on phone/LAN, restart with "npm run dev:https" or use localhost.'));
    return async () => {};
  }

  let wakeLock = null;
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* not critical */ }
  };
  const onVisibility = () => { if (document.visibilityState === 'visible') acquireWakeLock(); };
  await acquireWakeLock();
  document.addEventListener('visibilitychange', onVisibility);

  const handlePos = (pos) => {
    onFix({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    });
  };

  // Immediate initial fix: try high accuracy first, then fallback to fast Wi-Fi/network fix
  navigator.geolocation.getCurrentPosition(
    handlePos,
    () => {
      navigator.geolocation.getCurrentPosition(
        handlePos,
        () => { /* watchPosition will handle persistent errors */ },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
      );
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
  );

  let watchId = null;
  let usingFallback = false;

  const startWatch = (highAccuracy) => {
    watchId = navigator.geolocation.watchPosition(
      handlePos,
      (err) => {
        // If high-accuracy GPS times out or fails indoors/on laptop, seamlessly fallback to Wi-Fi/Network positioning
        if (highAccuracy && !usingFallback && (err.code === 2 || err.code === 3)) {
          usingFallback = true;
          if (watchId != null) navigator.geolocation.clearWatch(watchId);
          startWatch(false);
          return;
        }
        let msg = err.message;
        if (err.code === 1) {
          msg = 'Location permission denied. Click the lock/tune icon beside the URL in your browser to Allow Location access, or check your OS Location settings.';
        } else if (err.code === 2) {
          msg = 'Location unavailable. Please make sure your device GPS / Windows Location service is turned ON.';
        } else if (err.code === 3) {
          msg = 'GPS fix timed out. Retrying…';
        }
        onError?.(new Error(msg));
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: highAccuracy ? 2000 : 10000,
        timeout: highAccuracy ? 12000 : 20000,
      }
    );
  };

  startWatch(true);

  return async () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    document.removeEventListener('visibilitychange', onVisibility);
    try { await wakeLock?.release(); } catch { /* ignore */ }
  };
}
