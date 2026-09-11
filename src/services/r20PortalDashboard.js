import {
  getStoredR20PortalSession,
  getPortalSession,
} from "./r20PortalAuthClient.js";

export const R20_PORTAL_DASHBOARD_MARKER =
  "R20_FIX05_ROLE_DASHBOARD_V1";

const ROLE_CLASS_PREFIX = "r20-role-";
const ACCESS_ATTR = "data-r20-dashboard-access";
const FEATURE_ATTR = "data-r20-dashboard-feature";
const WELCOME_ATTR = "data-r20-welcome-banner";

const STUDENT_FEATURES = new Set([
  "games",
  "map-challenge",
  "reports",
  "grades",
  "weaknesses",
  "exams",
  "assistant",
]);

const PARENT_FEATURES = new Set([
  "reports",
  "grades",
  "weaknesses",
  "progress",
]);

const TEACHER_ONLY = new Set([
  "student-management",
  "add-student",
  "attendance-management",
  "exam-monitoring",
  "content-management",
  "class-mode",
  "online-lesson-management",
  "settings-admin",
  "printing-admin",
]);

const FEATURE_PATTERNS = [
  ["map-challenge", /تحدي الخرائط|map challenge/i],
  ["games", /الألعاب|العاب|games?/i],
  ["weaknesses", /نقاط الضعف|نقاط ضعف|weakness/i],
  ["reports", /التقارير|تقارير|reports?/i],
  ["grades", /الدرجات|النتائج|نتائجي|grades?|results?/i],
  ["exams", /الامتحانات|امتحاناتي|اختباراتي|exams?|tests?/i],
  ["assistant", /مساعد المبدع|المساعد|assistant/i],
  ["progress", /التقدم|المستوى|progress/i],

  ["student-management", /إدارة الطلاب|قائمة الطلاب|students management/i],
  ["add-student", /إضافة طالب|اضافة طالب|طالب جديد|add student/i],
  ["attendance-management", /إدارة الحضور|رصد الحضور|attendance management/i],
  ["exam-monitoring", /رصد الامتحانات|إدارة الامتحانات|exam monitoring/i],
  ["content-management", /إدارة المحتوى|إضافة محتوى|المكتبة.*إضافة|content management/i],
  ["class-mode", /وضع الحصة|class mode/i],
  ["online-lesson-management", /إدارة الحصة الأونلاين|بدء حصة أونلاين|online lesson management/i],
  ["settings-admin", /إعدادات الإدارة|إعدادات المنصة|admin settings/i],
  ["printing-admin", /طباعة الكروت|طباعة الطلاب|printing/i],
];

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeRole(value) {
  const role = clean(value).toLowerCase();
  return role === "student" || role === "parent" ? role : "teacher";
}

export function portalWelcomeText(session = {}) {
  const name = clean(session.displayName || session.name);
  if (!name) {
    return "مرحبًا بك في منصة المُبدع مصطفى بركات، نتمنى لك تعلّمًا ممتعًا";
  }
  return `مرحبًا بك يا ${name} في منصة المُبدع مصطفى بركات، نتمنى لك تعلّمًا ممتعًا`;
}

export function allowedPortalFeatures(role) {
  const normalized = normalizeRole(role);
  if (normalized === "student") return new Set(STUDENT_FEATURES);
  if (normalized === "parent") return new Set(PARENT_FEATURES);
  return null;
}

export function classifyDashboardFeature(label = "") {
  const text = clean(label);
  for (const [feature, pattern] of FEATURE_PATTERNS) {
    if (pattern.test(text)) return feature;
  }
  return null;
}

export function canRoleUseDashboardFeature(role, feature) {
  const normalized = normalizeRole(role);
  if (normalized === "teacher") return true;
  if (!feature) return false;
  if (TEACHER_ONLY.has(feature)) return false;
  const allowed = allowedPortalFeatures(normalized);
  return allowed?.has(feature) || false;
}

function getDashboardRoot() {
  return (
    document.querySelector(".dashboard-v103") ||
    document.querySelector("[data-dashboard]") ||
    document.querySelector(".dashboard-page") ||
    document.querySelector("main")
  );
}

function featureCandidateElements(root) {
  const selectors = [
    "[data-dashboard-card]",
    "[data-feature-card]",
    ".dashboard-card",
    ".feature-card",
    ".quick-action-card",
    ".dashboard-action",
    ".dashboard-tile",
    ".stat-card a",
    ".dashboard-grid > *",
    ".dashboard-feature-grid > *",
  ];

  const found = new Set();
  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((element) => found.add(element));
  });

  if (!found.size) {
    root.querySelectorAll("a[href], button").forEach((element) => {
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width < 100 || rect.height < 42) return;
      found.add(element);
    });
  }

  return [...found];
}

function textFor(element) {
  return clean([
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
    element.getAttribute?.("href"),
    element.textContent,
  ].filter(Boolean).join(" "));
}

function markFeatureCards(root, role) {
  for (const element of featureCandidateElements(root)) {
    if (element.closest(`[${WELCOME_ATTR}]`)) continue;

    const feature = classifyDashboardFeature(textFor(element));
    if (!feature) {
      if (role === "student" || role === "parent") {
        element.setAttribute(ACCESS_ATTR, "hidden-unknown");
      } else {
        element.removeAttribute(ACCESS_ATTR);
      }
      continue;
    }

    element.setAttribute(FEATURE_ATTR, feature);
    element.setAttribute(
      ACCESS_ATTR,
      canRoleUseDashboardFeature(role, feature) ? "allowed" : "denied",
    );
  }
}

function ensureWelcome(root, session) {
  let banner = root.querySelector(`[${WELCOME_ATTR}="true"]`);
  if (!banner) {
    banner = document.createElement("section");
    banner.setAttribute(WELCOME_ATTR, "true");
    banner.className = "r20-dashboard-welcome";
    banner.innerHTML = `
      <div class="r20-dashboard-welcome__icon">✨</div>
      <div class="r20-dashboard-welcome__copy">
        <h2></h2>
        <p></p>
      </div>
    `;
    root.insertAdjacentElement("afterbegin", banner);
  }

  const role = normalizeRole(session?.role);
  const h2 = banner.querySelector("h2");
  const p = banner.querySelector("p");

  h2.textContent = portalWelcomeText(session);
  p.textContent =
    role === "student"
      ? "كل الأدوات الظاهرة هنا متاحة لك أنت فقط، ونتائجك وتقاريرك خاصة بحسابك."
      : role === "parent"
        ? "هذه الصفحة تعرض لك فقط متابعة الأبناء المرتبطين بحسابك."
        : "لوحة التحكم الرئيسية.";

  banner.dataset.role = role;
}

function applyRoleClass(root, role) {
  [...root.classList]
    .filter((name) => name.startsWith(ROLE_CLASS_PREFIX))
    .forEach((name) => root.classList.remove(name));
  root.classList.add(`${ROLE_CLASS_PREFIX}${role}`);
  root.setAttribute("data-r20-dashboard-role", role);
}

function currentSession() {
  return getStoredR20PortalSession();
}

export function applyR20PortalDashboard(session = currentSession()) {
  if (typeof document === "undefined") return;

  const root = getDashboardRoot();
  if (!root) return;

  const role = normalizeRole(session?.role);
  applyRoleClass(root, role);

  if (role === "teacher") {
    root
      .querySelectorAll(`[${ACCESS_ATTR}]`)
      .forEach((element) => element.removeAttribute(ACCESS_ATTR));
    root
      .querySelectorAll(`[${FEATURE_ATTR}]`)
      .forEach((element) => element.removeAttribute(FEATURE_ATTR));

    const oldBanner = root.querySelector(`[${WELCOME_ATTR}="true"]`);
    oldBanner?.remove();
    return;
  }

  if (session?.mustChangePassword || session?.canAccessPortal === false) {
    root.setAttribute("data-r20-dashboard-locked", "true");
    return;
  }

  root.removeAttribute("data-r20-dashboard-locked");
  ensureWelcome(root, session);
  markFeatureCards(root, role);
}

async function refreshSessionAndDashboard() {
  const stored = currentSession();
  if (!stored?.sessionToken) {
    applyR20PortalDashboard(stored);
    return;
  }

  try {
    const fresh = await getPortalSession({
      sessionToken: stored.sessionToken,
    });
    sessionStorage.setItem(
      "mobdea-r20-portal-session",
      JSON.stringify(fresh),
    );
    applyR20PortalDashboard(fresh);
  } catch {
    applyR20PortalDashboard(stored);
  }
}

export function installR20PortalDashboardRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_PORTAL_DASHBOARD__) return;

  window.__MOBDEA_R20_PORTAL_DASHBOARD__ = R20_PORTAL_DASHBOARD_MARKER;
  window.mobdeaR20ApplyPortalDashboard = applyR20PortalDashboard;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyR20PortalDashboard();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "href", "aria-label", "title"],
  });

  for (const eventName of [
    "mobdea:r20-portal-login",
    "mobdea:r20-password-changed",
    "popstate",
    "hashchange",
  ]) {
    window.addEventListener(eventName, () => {
      void refreshSessionAndDashboard();
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key?.includes("portal")) {
      void refreshSessionAndDashboard();
    }
  });

  void refreshSessionAndDashboard();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installR20PortalDashboardRuntime,
      { once: true },
    );
  } else {
    installR20PortalDashboardRuntime();
  }
}
