export const R20_COUNTRY_CARDS_MARKER = "R20_FIX11_COUNTRY_CARDS_V1";

const CARD_SELECTORS = [
  "[data-card-type='country']",
  "[data-country-card]",
  ".country-card",
  ".country-info-card",
  "[class*='country-card']",
  "[class*='country-info']",
];

const NAME_SELECTORS = [
  "[data-country-name]",
  ".country-name",
  ".card-title",
  "h1",
  "h2",
  "h3",
];

const MEDIA_SELECTORS = [
  "[data-country-flag]",
  ".country-flag",
  ".flag",
  "img",
  "svg",
  "picture",
];

const DETAILS_SELECTORS = [
  "[data-country-details]",
  ".country-details",
  ".country-meta",
  ".country-info",
  ".card-body",
  ".card-content",
  "dl",
  "ul",
];

const processed = new WeakSet();

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function signature(card) {
  return clean([
    card.getAttribute?.("data-card-type"),
    card.getAttribute?.("aria-label"),
    card.getAttribute?.("title"),
    card.className,
    card.textContent,
  ].filter(Boolean).join(" ")).toLowerCase();
}

export function isCountryCardElement(card) {
  if (!card) return false;

  if (card.matches?.(
    "[data-card-type='country'],[data-country-card],.country-card,.country-info-card,[class*='country-card']"
  )) {
    return true;
  }

  const text = signature(card);
  const signals = [
    /الدولة/, /العاصمة/, /القارة/, /العلم/, /المساحة/, /السكان/,
    /country/, /capital/, /continent/, /population/, /area/,
  ].filter((pattern) => pattern.test(text)).length;

  return signals >= 2;
}

export function countryCardTextClass(text = "") {
  const length = clean(text).length;
  if (length > 520) return "xxlong";
  if (length > 360) return "xlong";
  if (length > 230) return "long";
  if (length > 130) return "medium";
  return "short";
}

export function countryCardFontScale(text = "") {
  return {
    short: 1,
    medium: 0.94,
    long: 0.86,
    xlong: 0.78,
    xxlong: 0.69,
  }[countryCardTextClass(text)] || 1;
}

function first(root, selectors) {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function findCards() {
  const cards = new Set();
  for (const selector of CARD_SELECTORS) {
    document.querySelectorAll(selector).forEach((card) => {
      if (isCountryCardElement(card)) cards.add(card);
    });
  }

  document.querySelectorAll(
    "[data-cards-panel],.cards-panel,.country-cards-panel,[class*='cards-panel'],[class*='country-panel']"
  ).forEach((panel) => {
    [...panel.children].forEach((child) => {
      if (isCountryCardElement(child)) cards.add(child);
    });
  });

  return [...cards];
}

function findDetails(card, name, media) {
  const explicit = first(card, DETAILS_SELECTORS);
  if (
    explicit &&
    explicit !== name &&
    explicit !== media &&
    !explicit.contains(name) &&
    !explicit.contains(media)
  ) {
    return explicit;
  }

  return [...card.children].find((child) => {
    if (child === name || child === media) return false;
    if (name && child.contains(name)) return false;
    if (media && child.contains(media)) return false;
    return clean(child.textContent).length > 0;
  }) || null;
}

function markDetailRows(details) {
  if (!details) return;
  details.querySelectorAll("li,dt,dd,p,div,span,[data-country-field]").forEach((row) => {
    const text = clean(row.textContent);
    if (
      /العاصمة|القارة|المساحة|السكان|اللغة|العملة|capital|continent|area|population|language|currency/i.test(text)
    ) {
      row.setAttribute("data-r20-country-detail-row", "true");
    }
  });
}

function neutralizeUnsafeInlineSizing(card) {
  [card, ...card.querySelectorAll("*")].forEach((element) => {
    const style = element.style;
    if (!style) return;

    const width = parseFloat(style.width || "");
    const minWidth = parseFloat(style.minWidth || "");
    const height = parseFloat(style.height || "");
    const left = parseFloat(style.left || "");
    const right = parseFloat(style.right || "");

    if (style.width?.endsWith("px") && Number.isFinite(width) && width > 900) {
      style.removeProperty("width");
    }
    if (style.minWidth?.endsWith("px") && Number.isFinite(minWidth) && minWidth > 700) {
      style.removeProperty("min-width");
    }
    if (style.height?.endsWith("px") && Number.isFinite(height) && height > 900) {
      style.removeProperty("height");
    }
    if (
      (style.position === "absolute" || style.position === "relative") &&
      Number.isFinite(left) && Math.abs(left) > 300
    ) {
      style.removeProperty("left");
    }
    if (
      (style.position === "absolute" || style.position === "relative") &&
      Number.isFinite(right) && Math.abs(right) > 300
    ) {
      style.removeProperty("right");
    }
  });
}

function hasOverflow(card) {
  return (
    card.scrollWidth > card.clientWidth + 2 ||
    card.scrollHeight > card.clientHeight + 2
  );
}

function fitCard(card) {
  const text = clean(card.textContent);
  const textClass = countryCardTextClass(text);
  let scale = countryCardFontScale(text);

  card.setAttribute("data-r20-country-text-class", textClass);
  card.style.setProperty("--r20-country-font-scale", String(scale));

  requestAnimationFrame(() => {
    for (let i = 0; i < 7 && hasOverflow(card); i += 1) {
      scale = Math.max(0.58, Number((scale - 0.05).toFixed(3)));
      card.style.setProperty("--r20-country-font-scale", String(scale));
    }
    card.setAttribute("data-r20-country-fit-scale", scale.toFixed(3));
  });
}

function normalizeCard(card) {
  if (!card || processed.has(card) || !isCountryCardElement(card)) return;
  processed.add(card);

  card.setAttribute("data-r20-country-card", "true");

  const name = first(card, NAME_SELECTORS);
  const mediaCandidate = first(card, MEDIA_SELECTORS);
  const media = mediaCandidate?.matches?.("img,svg,picture")
    ? mediaCandidate
    : mediaCandidate?.querySelector?.("img,svg,picture") || mediaCandidate;
  const details = findDetails(card, name, media);

  if (name) name.setAttribute("data-r20-country-name", "true");
  if (media) media.setAttribute("data-r20-country-media", "true");
  if (details) {
    details.setAttribute("data-r20-country-details", "true");
    markDetailRows(details);
  }

  neutralizeUnsafeInlineSizing(card);
  fitCard(card);

  card.setAttribute("data-r20-country-normalization", "complete");
}

function keepEducationalCardsSeparate() {
  document.querySelectorAll("[data-r20-educational-card='true']").forEach((card) => {
    if (!isCountryCardElement(card)) {
      card.setAttribute("data-r20-country-phase", "excluded-educational-card");
    }
  });
}

function run() {
  findCards().forEach(normalizeCard);
  keepEducationalCardsSeparate();
}

export function installR20CountryCards() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_COUNTRY_CARDS__) return;

  window.__MOBDEA_R20_COUNTRY_CARDS__ = R20_COUNTRY_CARDS_MARKER;
  window.mobdeaR20CountryCards = Object.freeze({
    marker: R20_COUNTRY_CARDS_MARKER,
    isCountryCardElement,
    countryCardTextClass,
    countryCardFontScale,
  });

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "data-card-type"],
  });

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  run();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installR20CountryCards, { once: true });
  } else {
    installR20CountryCards();
  }
}
