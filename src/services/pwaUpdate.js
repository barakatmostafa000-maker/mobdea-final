import { release } from '../config/release';

let waitingWorker = null;
let onReadyCallback = null;
let registrationTimer = null;

export function isServiceWorkerSupported() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.();
}

export function registerServiceWorker(onReady) {
  if (!isServiceWorkerSupported()) return () => {};
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
