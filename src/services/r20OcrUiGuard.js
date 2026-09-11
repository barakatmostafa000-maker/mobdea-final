import {
  healthCheckR20PageOcr,
  sanitizeOcrUserMessage,
} from "./r20PageOcrPipeline.js";

export const R20_OCR_UI_GUARD_MARKER = "R20_FIX08_OCR_UI_GUARD_V1";

function scrub() {
  if (!document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const value = String(node.nodeValue || "");
    if (/tess304[\\/]|traineddata|\/data\/user\/|\/storage\/emulated\//i.test(value)) {
      node.nodeValue = sanitizeOcrUserMessage(value);
    }
  }

  document.querySelectorAll(
    "[class*='question'],[data-page-questions],[data-question-scope]",
  ).forEach((element) => {
    const text = String(element.textContent || "").replace(/\s+/g," ").trim();
    if (/أسئلة الصفحة|اسئلة الصفحة|page questions|سؤال الصفحة/i.test(text)) {
      element.setAttribute("data-r20-page-question-area","true");
    }
  });
}

export function installR20OcrUiGuard() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__MOBDEA_R20_OCR_UI_GUARD__) return;
  window.__MOBDEA_R20_OCR_UI_GUARD__ = R20_OCR_UI_GUARD_MARKER;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scrub(); });
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList:true,subtree:true,characterData:true,
  });

  scrub();

  void healthCheckR20PageOcr().then((health) => {
    document.documentElement.setAttribute(
      "data-r20-native-ocr",
      health.ready ? "ready" : "unavailable",
    );
    document.documentElement.setAttribute(
      "data-r20-native-ocr-models",
      String(health.modelCount || 0),
    );
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installR20OcrUiGuard, {once:true});
  } else {
    installR20OcrUiGuard();
  }
}
