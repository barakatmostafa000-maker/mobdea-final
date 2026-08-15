import { Capacitor } from '@capacitor/core';

let cleanupViewport = null;

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function stableViewportValue(...values) {
  const valid = values
    .map(finitePositive)
    .filter(Boolean)
    .sort((left, right) => left - right);
  if (!valid.length) return 0;
  return valid[Math.floor(valid.length / 2)];
}

function keyboardLikelyOpen() {
  const active = globalThis.document?.activeElement;
  if (!active) return false;
  const tag = String(active.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable === true;
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

  // Use the median of the three live CSS viewport measurements. This rejects
  // both known Android failure modes: a stale oversized client/screen value
  // that clips the footer, and a transient half-height visualViewport value
  // after orientation restoration.
  let width = stableViewportValue(visualWidth, innerWidth, clientWidth);
  let height = stableViewportValue(visualHeight, innerHeight, clientHeight);

  // The on-screen keyboard intentionally shrinks visualViewport. Respect that
  // only while a text control is focused; otherwise one bad visualViewport
  // sample must never collapse the classroom.
  if (keyboardLikelyOpen() && visualHeight) height = Math.min(height || visualHeight, visualHeight);

  // screen.* is a last-resort fallback only. It must never enlarge a valid
  // WebView viewport because that was the source of the hidden bottom area.
  if (!width) width = screenWidth || 1;
  if (!height) height = screenHeight || 1;

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
  root.dataset.mobdeaViewport = `${width}x${height}`;
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
  globalThis.visualViewport?.addEventListener?.('scroll', schedule, { passive: true });
  globalThis.document?.addEventListener?.('visibilitychange', schedule);
  globalThis.document?.addEventListener?.('focusin', schedule);
  globalThis.document?.addEventListener?.('focusout', schedule);

  cleanupViewport = () => {
    globalThis.cancelAnimationFrame?.(frame);
    globalThis.clearTimeout?.(timer);
    globalThis.removeEventListener?.('resize', schedule);
    globalThis.removeEventListener?.('orientationchange', schedule);
    globalThis.visualViewport?.removeEventListener?.('resize', schedule);
    globalThis.visualViewport?.removeEventListener?.('scroll', schedule);
    globalThis.document?.removeEventListener?.('visibilitychange', schedule);
    globalThis.document?.removeEventListener?.('focusin', schedule);
    globalThis.document?.removeEventListener?.('focusout', schedule);
    cleanupViewport = null;
  };
  return cleanupViewport;
}
