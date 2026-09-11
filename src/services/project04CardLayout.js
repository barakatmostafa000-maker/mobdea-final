// PROJECT04_EDUCATIONAL_CARD_LAYOUT_V1
const KIND_ATTR = 'data-r19-edu-card';
const ROLE_ATTR = 'data-r19-card-role';

const labels = {
  definition: ['المصطلح', 'التعريف', 'تعريف'],
  country: ['الدولة', 'العاصمة', 'القارة', 'الموقع', 'المساحة', 'السكان', 'العملة', 'اللغة', 'اللغات', 'العلم', 'معلومة', 'معلومة سريعة'],
  event: ['الحدث', 'التاريخ', 'المكان', 'الأسباب', 'السبب', 'النتائج', 'النتيجة', 'الأهمية', 'الشخصيات', 'الأطراف'],
};

function normalizeArabic(value = '') {
  return String(value).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}

function classText(node) {
  const value = node?.className;
  if (typeof value === 'string') return value;
  return value?.baseVal ? String(value.baseVal) : '';
}

function directText(node) {
  return Array.from(node?.childNodes || []).filter((item) => item.nodeType === Node.TEXT_NODE).map((item) => item.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
}

function detectKind(card) {
  const classes = classText(card).toLowerCase();
  const text = normalizeArabic(card?.textContent || '');
  if (/definition|term|concept/i.test(classes)) return 'definition';
  if (/country|nation|state-card/i.test(classes)) return 'country';
  if (/event|history-card/i.test(classes)) return 'event';
  if (text.includes(normalizeArabic('المصطلح')) && text.includes(normalizeArabic('التعريف'))) return 'definition';
  const countrySignals = ['العاصمة','العملة','القارة','المساحة','السكان','اللغة'].filter((word) => text.includes(normalizeArabic(word))).length;
  if (countrySignals >= 2) return 'country';
  const eventSignals = ['التاريخ','الأسباب','النتائج','الأهمية','الشخصيات'].filter((word) => text.includes(normalizeArabic(word))).length;
  if (text.includes(normalizeArabic('الحدث')) || eventSignals >= 2) return 'event';
  return '';
}

function candidates(root = document) {
  const selector = '[class*="definition-card" i],[class*="card-definition" i],[class*="term-card" i],[class*="concept-card" i],[class*="country-card" i],[class*="card-country" i],[class*="nation-card" i],[class*="event-card" i],[class*="card-event" i],[class*="history-card" i],[class*="flashcard" i],[class*="flash-card" i],[class*="edu-card" i],[class*="info-card" i],article[class*="card" i]';
  const set = new Set();
  if (root?.matches?.(selector)) set.add(root);
  root?.querySelectorAll?.(selector)?.forEach((node) => set.add(node));
  root?.querySelectorAll?.('[class*="card" i]')?.forEach((node) => {
    const text = normalizeArabic(node.textContent || '');
    if ((text.includes(normalizeArabic('المصطلح')) && text.includes(normalizeArabic('التعريف'))) || text.includes(normalizeArabic('العاصمة')) || text.includes(normalizeArabic('الأسباب')) || text.includes(normalizeArabic('النتائج'))) set.add(node);
  });
  return [...set];
}

function markRoles(card, kind) {
  const list = [...card.querySelectorAll('*')];
  for (const node of list) {
    if (node.children.length > 2) continue;
    const raw = (directText(node) || node.textContent || '').trim().replace(/[:：]/g, '');
    if (!raw || raw.length > 34) continue;
    const normalized = normalizeArabic(raw);
    if (labels[kind].some((label) => normalizeArabic(label) === normalized)) {
      node.setAttribute(ROLE_ATTR, 'label');
      if (kind === 'definition') node.setAttribute('data-r19-definition-helper', 'true');
      const value = node.nextElementSibling || node.parentElement?.nextElementSibling;
      if (value && String(value.textContent || '').trim()) value.setAttribute(ROLE_ATTR, 'value');
    }
  }

  const title = card.querySelector('[class*="title" i],[class*="name" i],[class*="term" i]:not([class*="label" i]),h1,h2,h3,h4,h5,h6') || [...card.querySelectorAll('strong,b')].find((node) => String(node.textContent || '').trim().length <= 60 && node.getAttribute(ROLE_ATTR) !== 'label');
  if (title) title.setAttribute(ROLE_ATTR, 'title');
  const body = kind === 'definition' ? (card.querySelector('[class*="description" i],[class*="body" i],p') || card.querySelector('[data-r19-card-role="value"]')) : card.querySelector('[class*="body" i],[class*="details" i],[class*="content" i]');
  if (body && body !== title) body.setAttribute(ROLE_ATTR, 'body');
  const media = card.querySelector('img,svg,[class*="flag" i],[class*="image" i],[class*="icon" i]');
  if (media && !media.closest('button')) media.setAttribute(ROLE_ATTR, 'media');
}

function scaleFor(card) {
  const rect = card.getBoundingClientRect();
  const width = Math.max(1, rect.width || card.clientWidth || 320);
  const height = Math.max(1, rect.height || card.clientHeight || 220);
  const chars = normalizeArabic(card.textContent || '').length;
  const density = chars > 420 ? .72 : chars > 320 ? .78 : chars > 240 ? .84 : chars > 170 ? .90 : chars > 110 ? .95 : 1;
  return Math.max(.64, Math.min(1, Math.max(.67, width / 340), Math.max(.70, height / 230), density));
}

function applyScale(card, scale) {
  card.style.setProperty('--r19-card-scale', scale.toFixed(3));
  card.style.setProperty('--r19-card-title-size', `${Math.max(13, Math.min(27, 24 * scale)).toFixed(2)}px`);
  card.style.setProperty('--r19-card-body-size', `${Math.max(10.5, Math.min(18, 15.5 * scale)).toFixed(2)}px`);
  card.style.setProperty('--r19-card-label-size', `${Math.max(9, Math.min(13, 11.5 * scale)).toFixed(2)}px`);
  card.style.setProperty('--r19-card-gap', `${Math.max(4, Math.min(12, 9 * scale)).toFixed(2)}px`);
  card.style.setProperty('--r19-card-pad', `${Math.max(7, Math.min(18, 14 * scale)).toFixed(2)}px`);
}

function overflows(card) { return card.scrollHeight > card.clientHeight + 2 || card.scrollWidth > card.clientWidth + 2; }

function fitCard(card) {
  if (!card?.isConnected) return;
  let scale = scaleFor(card);
  card.removeAttribute('data-r19-card-overflow');
  applyScale(card, scale);
  for (let i = 0; i < 8 && overflows(card); i += 1) { scale = Math.max(.58, scale - .045); applyScale(card, scale); }
  if (overflows(card)) card.setAttribute('data-r19-card-overflow', 'true');
}

const watched = new WeakSet();
function watch(card) {
  if (watched.has(card) || typeof ResizeObserver === 'undefined') return;
  watched.add(card);
  new ResizeObserver(() => requestAnimationFrame(() => fitCard(card))).observe(card);
}

function enhanceCard(card) {
  if (!(card instanceof HTMLElement)) return;
  const kind = detectKind(card);
  if (!kind) return;
  card.setAttribute(KIND_ATTR, kind);
  card.setAttribute('data-r19-card-enhanced', 'true');
  card.setAttribute('dir', 'rtl');
  markRoles(card, kind);
  fitCard(card);
  watch(card);
}

function scanCards(root = document) { candidates(root).forEach(enhanceCard); }
function install() {
  if (typeof document === 'undefined') return;
  const run = () => {
    scanCards(document);
    const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => { if (node instanceof HTMLElement) requestAnimationFrame(() => scanCards(node)); })));
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run, { once: true }) : run();
}
install();
export { detectKind, enhanceCard, fitCard, normalizeArabic, scanCards };
