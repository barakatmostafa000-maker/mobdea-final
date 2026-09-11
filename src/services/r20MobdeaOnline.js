import {
  R20_MOBDEA_YOUTUBE_URL,
  R20_MOBDEA_FACEBOOK_URL,
  R20_MOBDEA_TIKTOK_URL,
  R20_MOBDEA_SOCIAL_LINKS_COMPLETE,
} from "../config/r20MobdeaOnlineConfig.js";

export const R20_MOBDEA_ONLINE_MARKER =
  "R20_FIX24_MOBDEA_ONLINE_V1";

const clean = (v) => String(v ?? "").trim();
const DIALOG_ID = "r20-mobdea-online-dialog";

export const R20_MOBDEA_SOCIALS = Object.freeze([
  {
    id: "youtube",
    label: "YouTube",
    title: "قناة المُبدع على YouTube",
    url: clean(R20_MOBDEA_YOUTUBE_URL),
    icon: "▶",
  },
  {
    id: "facebook",
    label: "Facebook",
    title: "صفحة المُبدع على Facebook",
    url: clean(R20_MOBDEA_FACEBOOK_URL),
    icon: "f",
  },
  {
    id: "tiktok",
    label: "TikTok",
    title: "المُبدع على TikTok",
    url: clean(R20_MOBDEA_TIKTOK_URL),
    icon: "♪",
  },
]);

export function socialLinksReady() {
  return Boolean(
    R20_MOBDEA_SOCIAL_LINKS_COMPLETE &&
    R20_MOBDEA_SOCIALS.every((item) => /^https?:\/\//i.test(item.url)),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function ensureDialog() {
  let dialog = document.getElementById(DIALOG_ID);
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "r20-mobdea-online-dialog";
  dialog.setAttribute("data-r20-mobdea-online-dialog","true");

  dialog.innerHTML = `
    <div class="r20-mobdea-online-dialog__shell">
      <button type="button" class="r20-mobdea-online-dialog__close" data-r20-online-close aria-label="إغلاق">×</button>
      <header class="r20-mobdea-online-dialog__header">
        <span class="r20-mobdea-online-dialog__brand">المُبدع</span>
        <h2>المبدع أونلاين</h2>
        <p>تابع الشرح والمحتوى وكل جديد على منصات المُبدع الرسمية</p>
      </header>
      <div class="r20-mobdea-online-dialog__links">
        ${R20_MOBDEA_SOCIALS.map((item) => `
          <a
            href="${escapeHtml(item.url)}"
            target="_blank"
            rel="noopener noreferrer"
            class="r20-mobdea-social-link r20-mobdea-social-link--${item.id}"
            data-r20-social="${item.id}"
            aria-label="${escapeHtml(item.title)}"
          >
            <span class="r20-mobdea-social-link__icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
            <span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.title)}</small>
            </span>
            <b aria-hidden="true">↗</b>
          </a>
        `).join("")}
      </div>
    </div>
  `;

  dialog.querySelector("[data-r20-online-close]")
    .addEventListener("click", () => dialog.close());

  document.body.appendChild(dialog);
  return dialog;
}

export function openMobdeaOnline() {
  if (!socialLinksReady()) {
    throw new Error("R20 Mobdea Online requires exact YouTube, Facebook and TikTok links.");
  }

  const dialog = ensureDialog();

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open","");
  }

  return R20_MOBDEA_SOCIALS.map((item) => ({...item}));
}

function dashboardRoots() {
  const roots = new Set();

  document.querySelectorAll(
    "[data-r20-dashboard-role], [data-r20-teacher-dashboard], .teacher-dashboard, .dashboard"
  ).forEach((node) => roots.add(node));

  return [...roots];
}

function dashboardGrid(root) {
  return root.querySelector(
    ".dashboard-grid, .dashboard-feature-grid, [data-dashboard-grid], [class*='dashboard-grid']"
  ) || root;
}

function ensureDashboardCard(root) {
  if (root.querySelector("[data-r20-mobdea-online-card]")) return;

  const grid = dashboardGrid(root);
  const card = document.createElement("button");
  card.type = "button";
  card.className = "r20-mobdea-online-card";
  card.setAttribute("data-r20-mobdea-online-card","true");
  card.setAttribute("data-r20-dashboard-feature","mobdea-online");
  card.setAttribute("data-r20-dashboard-access","allowed");
  card.setAttribute("aria-label","المبدع أونلاين");

  card.innerHTML = `
    <span class="r20-mobdea-online-card__icon" aria-hidden="true">
      <i>▶</i><i>f</i><i>♪</i>
    </span>
    <span>
      <strong>المبدع أونلاين</strong>
      <small>YouTube · Facebook · TikTok</small>
    </span>
  `;

  card.addEventListener("click", () => {
    try {
      openMobdeaOnline();
    } catch (error) {
      console.error("R20 Mobdea Online could not open", error);
    }
  });

  grid.appendChild(card);
}

function refreshCards() {
  if (!socialLinksReady()) return;
  dashboardRoots().forEach(ensureDashboardCard);
}

export function installR20MobdeaOnline() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_MOBDEA_ONLINE__) return;

  window.__MOBDEA_R20_MOBDEA_ONLINE__ = R20_MOBDEA_ONLINE_MARKER;

  window.mobdeaR20Online = Object.freeze({
    marker: R20_MOBDEA_ONLINE_MARKER,
    links: () => R20_MOBDEA_SOCIALS.map((item) => ({...item})),
    ready: socialLinksReady,
    open: openMobdeaOnline,
    refresh: refreshCards,
  });

  refreshCards();

  new MutationObserver(refreshCards).observe(
    document.documentElement,
    {childList:true, subtree:true},
  );
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installR20MobdeaOnline, {once:true});
  } else {
    installR20MobdeaOnline();
  }
}
