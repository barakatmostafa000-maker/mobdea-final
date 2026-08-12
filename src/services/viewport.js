import { Capacitor } from '@capacitor/core';

let cleanupViewport = null;

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function viewportMeasurements() {
  const visual = globalThis.visualViewport;
  const screenObject = globalThis.screen;
  const innerWidth = finitePositive(globalThis.innerWidth);
  const innerHeight = finitePositive(globalThis.innerHeight);
  const clientWidth = finitePositive(globalThis.document?.documentElement?.clientWidth);
  const clientHeight = finitePositive(globalThis.document?.documentElement?.clientHeight);
  const visualWidth = finitePositive(visual?.width);
  const visualHeight = finitePositive(visual?.height);
  const screenWidth = finitePositive(screenObject?.width);
  const screenHeight = finitePositive(screenObject?.height);

  const native = Capacitor.isNativePlatform();
  const landscape = Math.max(innerWidth, visualWidth, clientWidth) >= Math.max(innerHeight, visualHeight, clientHeight);

  let width = Math.max(innerWidth, visualWidth, clientWidth);
  let height = Math.max(innerHeight, visualHeight, clientHeight);

  // A few older Samsung WebViews report a visual viewport close to half the
  // real landscape height after orientation restoration. screen.* is expressed
  // in CSS pixels too, so it is a dependable native-only fallback.
  if (native && screenWidth && screenHeight) {
    const expectedWidth = landscape ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight);
    const expectedHeight = landscape ? Math.min(screenWidth, screenHeight) : Math.max(screenWidth, screenHeight);
    if (width < expectedWidth * 0.78) width = expectedWidth;
    if (height < expectedHeight * 0.78) height = expectedHeight;
  }

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    native,
  };
}

export function applyViewportMetrics() {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  const { width, height, native } = viewportMeasurements();
  root.style.setProperty('--mobdea-app-width', `${width}px`);
  root.style.setProperty('--mobdea-app-height', `${height}px`);
  root.style.setProperty('--mobdea-app-vh', `${height / 100}px`);
  root.classList.toggle('mobdea-native', native);
}

export function installViewportMetrics() {
  if (cleanupViewport) return cleanupViewport;
  let frame = 0;
  let timer = 0;
  const schedule = () => {
    globalThis.cancelAnimationFrame?.(frame);
    globalThis.clearTimeout?.(timer);
    frame = globalThis.requestAnimationFrame?.(applyViewportMetrics) || 0;
    timer = globalThis.setTimeout?.(applyViewportMetrics, 180) || 0;
  };

  applyViewportMetrics();
  globalThis.addEventListener?.('resize', schedule, { passive: true });
  globalThis.addEventListener?.('orientationchange', schedule, { passive: true });
  globalThis.visualViewport?.addEventListener?.('resize', schedule, { passive: true });
  globalThis.document?.addEventListener?.('visibilitychange', schedule);

  cleanupViewport = () => {
    globalThis.cancelAnimationFrame?.(frame);
    globalThis.clearTimeout?.(timer);
    globalThis.removeEventListener?.('resize', schedule);
    globalThis.removeEventListener?.('orientationchange', schedule);
    globalThis.visualViewport?.removeEventListener?.('resize', schedule);
    globalThis.document?.removeEventListener?.('visibilitychange', schedule);
    cleanupViewport = null;
  };
  return cleanupViewport;
}
