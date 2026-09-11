export const R20_TEACHER_DASHBOARD_MARKER =
  "R20_FIX06_TEACHER_TABLET_DASHBOARD_V1";

const ROOT_SELECTORS = [
  ".dashboard-v103",
  ".dashboard-page",
  "[data-dashboard]",
  "main",
];

const HERO_SELECTORS = [
  ".dashboard-reference-hero",
  ".dashboard-hero",
  ".hero-section",
  "[data-dashboard-hero]",
  "[class*='dashboard'][class*='hero']",
];

const GRID_SELECTORS = [
  ".dashboard-feature-grid",
  ".dashboard-grid",
  ".features-grid",
  ".quick-actions-grid",
  "[data-dashboard-grid]",
];

const CARD_SELECTORS = [
  ".dashboard-card",
  ".feature-card",
  ".quick-action-card",
  ".dashboard-action",
  ".dashboard-tile",
  "[data-dashboard-card]",
  "[data-feature-card]",
];

function visible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function first(root, selectors) {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function dashboardRoot() {
  for (const selector of ROOT_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function isTeacherDashboard(root) {
  const explicit = root?.getAttribute("data-r20-dashboard-role");
  if (explicit === "teacher") return true;
  if (explicit === "student" || explicit === "parent") return false;

  try {
    const raw = sessionStorage.getItem("mobdea-r20-portal-session");
    const session = raw ? JSON.parse(raw) : null;
    if (session?.role === "student" || session?.role === "parent") return false;
  } catch {
    // If portal session cannot be read, keep legacy teacher dashboard behavior.
  }

  return true;
}

function markHero(root) {
  const hero = first(root, HERO_SELECTORS);
  if (!hero) return;

  hero.setAttribute("data-r20-teacher-hero", "true");

  const mediaCandidates = hero.querySelectorAll(
    "img, video, picture, canvas, svg, [class*='image'], [class*='media']",
  );
  mediaCandidates.forEach((element) => {
    element.setAttribute("data-r20-teacher-hero-media", "true");
  });

  const textCandidates = hero.querySelectorAll(
    "h1, h2, h3, p, .dashboard-reference-copy, [class*='copy'], [class*='text']",
  );
  textCandidates.forEach((element) => {
    element.setAttribute("data-r20-teacher-hero-copy", "true");
  });
}

function markGridsAndCards(root) {
  let grids = [];
  for (const selector of GRID_SELECTORS) {
    grids.push(...root.querySelectorAll(selector));
  }
  grids = [...new Set(grids)];

  if (!grids.length) {
    const candidates = [...root.querySelectorAll("section, div")].filter((node) => {
      const children = [...node.children];
      if (children.length < 3) return false;
      const sizeable = children.filter((child) => {
        const rect = child.getBoundingClientRect?.();
        return rect && rect.width >= 120 && rect.height >= 60;
      });
      return sizeable.length >= 3;
    });
    if (candidates.length) grids = [candidates[0]];
  }

  grids.forEach((grid) => {
    grid.setAttribute("data-r20-teacher-grid", "true");
  });

  const cards = new Set();
  for (const selector of CARD_SELECTORS) {
    root.querySelectorAll(selector).forEach((card) => cards.add(card));
  }

  grids.forEach((grid) => {
    [...grid.children].forEach((child) => {
      if (visible(child)) cards.add(child);
    });
  });

  cards.forEach((card) => {
    if (card.closest('[data-r20-welcome-banner="true"]')) return;
    card.setAttribute("data-r20-teacher-card", "true");
  });
}

function removeBadInlineSizing(root) {
  const candidates = root.querySelectorAll(
    "[data-r20-teacher-hero='true'], [data-r20-teacher-grid='true'], [data-r20-teacher-card='true']",
  );

  candidates.forEach((element) => {
    const style = element.style;
    if (!style) return;

    const minWidth = parseFloat(style.minWidth || "");
    const width = parseFloat(style.width || "");
    const left = parseFloat(style.left || "");
    const right = parseFloat(style.right || "");

    if (Number.isFinite(minWidth) && minWidth > 1400) {
      style.removeProperty("min-width");
    }

    if (
      style.width?.endsWith("px") &&
      Number.isFinite(width) &&
      width > 1800
    ) {
      style.removeProperty("width");
    }

    if (style.position === "relative" || style.position === "absolute") {
      if (Number.isFinite(left) && Math.abs(left) > 500) {
        style.removeProperty("left");
      }
      if (Number.isFinite(right) && Math.abs(right) > 500) {
        style.removeProperty("right");
      }
    }
  });
}

export function applyR20TeacherTabletDashboard() {
  if (typeof document === "undefined") return;

  const root = dashboardRoot();
  if (!root || !isTeacherDashboard(root)) return;

  root.setAttribute("data-r20-teacher-dashboard", "true");
  root.setAttribute("data-r20-dashboard-role", "teacher");

  markHero(root);
  markGridsAndCards(root);
  removeBadInlineSizing(root);
}

export function installR20TeacherTabletDashboard() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_TEACHER_DASHBOARD__) return;

  window.__MOBDEA_R20_TEACHER_DASHBOARD__ =
    R20_TEACHER_DASHBOARD_MARKER;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyR20TeacherTabletDashboard();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "data-r20-dashboard-role"],
  });

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  window.addEventListener("hashchange", schedule, { passive: true });
  window.addEventListener("popstate", schedule, { passive: true });

  applyR20TeacherTabletDashboard();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20TeacherTabletDashboard,
      { once: true },
    );
  } else {
    installR20TeacherTabletDashboard();
  }
}
