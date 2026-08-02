import { Capacitor } from '@capacitor/core';
import { release } from '../config/release';

let waitingWorker = null;
let onReadyCallback = null;
let registrationTimer = null;


/* MOBDEA R3 DEV SW CLEANUP START */
async function cleanupDevelopmentServiceWorker() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Development cleanup is best-effort.
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('mobdea-shell-'))
          .map((key) => caches.delete(key)),
      );
    }
  } catch {
    // Development cleanup is best-effort.
  }
}
/* MOBDEA R3 DEV SW CLEANUP END */
export function isServiceWorkerSupported() {
  
  if (import.meta.env.DEV) return false;if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  // Capacitor's Android WebView must never register the PWA worker. A worker
  // cached inside the native app can serve chunks from an older release and
  // produce a completely white screen before React starts.
  if (Capacitor.isNativePlatform()) return false;
  const protocol = globalThis.location?.protocol || '';
  return !['capacitor:', 'file:'].includes(protocol);
}


export function registerServiceWorker(onReady) {
  
  if (import.meta.env.DEV) {
    void cleanupDevelopmentServiceWorker();
    return () => {};
  }if (!isServiceWorkerSupported()) return () => {};
  onReadyCallback = onReady;
  const base = new URL(import.meta.env.BASE_URL || './', document.baseURI);
  const scriptUrl = new URL('sw.js', base);
  scriptUrl.searchParams.set('v', release.appVersion);

  navigator.serviceWorker.register(scriptUrl.toString(), { scope: base.pathname }).then((registration) => {
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      onReadyCallback?.();
    }
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = installing;
          onReadyCallback?.();
        }
      });
    });
    clearInterval(registrationTimer);
    registrationTimer = setInterval(() => registration.update().catch(() => null), 15 * 60 * 1000);
  }).catch(() => null);

  let refreshing = false;
  const onControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  return () => {
    clearInterval(registrationTimer);
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}

export function applyServiceWorkerUpdate() {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  waitingWorker.postMessage('SKIP_WAITING');
}
