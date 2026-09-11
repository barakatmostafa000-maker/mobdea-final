export const R20_PAGE_OCR_MARKER = "R20_FIX08_PAGE_OCR_QUESTIONS_V1";
const cache = new Map();
const METHODS = ["recognizePdfPage","recognizePage","ocrPage","extractText","recognize"];

function clean(value) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeOcrUserMessage(value) {
  let text = clean(value);
  text = text.replace(/(?:[\w.-]+[\\/])*tess304[\\/][\w.+-]+/gi, "OCR العربي");
  text = text.replace(/\b(?:ara|eng)\.traineddata\b/gi, "OCR العربي");
  text = text.replace(/(?:\/data\/user\/\d+|\/data\/data|\/storage\/emulated\/\d+|file:\/\/)[^\s"'<>]+/gi, "ملف الصفحة");
  return text || "تعذر قراءة الصفحة. حاول مرة أخرى.";
}

export function normalizeOcrText(value) {
  return clean(value);
}

function plugins() {
  const p = globalThis.Capacitor?.Plugins || {};
  return [p.R20PageOcr,p.MobdeaPdfOcr,p.MobdeaPdfOcrPlugin,p.PdfOcr,p.OCR].filter(Boolean);
}

function keyOf(request) {
  const page = Number.isInteger(request.pageIndex)
    ? request.pageIndex + 1
    : Math.max(1, Number(request.pageNumber || 1));
  return [
    String(request.resourceId || request.assetId || request.pdfPath || request.path || "pdf"),
    page,
    request.language || "ara+eng",
  ].join("::");
}

function textFrom(result) {
  if (typeof result === "string") return clean(result);
  for (const key of ["text","recognizedText","ocrText","content","result"]) {
    if (typeof result?.[key] === "string" && result[key].trim()) return clean(result[key]);
  }
  return "";
}

async function nativeCall(request) {
  let last = null;

  for (const plugin of plugins()) {
    for (const method of METHODS) {
      if (typeof plugin?.[method] !== "function") continue;
      try {
        const pageNumber = request.pageNumber ??
          (Number.isInteger(request.pageIndex) ? request.pageIndex + 1 : 1);
        const pageIndex = Number.isInteger(request.pageIndex)
          ? request.pageIndex
          : Math.max(0, Number(pageNumber) - 1);

        const result = await plugin[method]({
          pdfPath: request.pdfPath || request.filePath || request.path || request.uri,
          filePath: request.filePath || request.pdfPath || request.path,
          path: request.path || request.pdfPath || request.filePath,
          uri: request.uri,
          imageBase64: request.imageBase64,
          pageNumber,
          pageIndex,
          language: request.language || "ara+eng",
          lang: request.language || "ara+eng",
        });

        const text = textFrom(result);
        if (!text) throw new Error("OCR returned no readable text.");
        return {...result, text, recognizedText:text, ocrText:text, content:text};
      } catch (error) {
        last = error;
      }
    }
  }

  throw last || new Error("Native OCR is unavailable.");
}

export async function healthCheckR20PageOcr() {
  for (const plugin of plugins()) {
    if (typeof plugin?.healthCheck !== "function") continue;
    try {
      const result = await plugin.healthCheck();
      if (result?.ready || result?.ok) {
        return {
          ok: true,
          ready: true,
          modelCount: Number(result.modelCount || 0),
          engine: result.engine || "native",
        };
      }
    } catch {}
  }
  return {ok:false,ready:false,modelCount:0,engine:"unavailable"};
}

export async function recognizePageForQuestions(request = {}, {force=false} = {}) {
  const key = keyOf(request);
  if (!force && cache.has(key)) return cache.get(key);

  const promise = nativeCall(request)
    .then((result) => {
      const pageNumber = Number(result.pageNumber) ||
        Number(request.pageNumber) ||
        (Number.isInteger(request.pageIndex) ? request.pageIndex + 1 : 1);

      const payload = {
        ok: true,
        pageNumber,
        pageIndex: Math.max(0, pageNumber - 1),
        text: clean(result.text),
        engine: result.engine || "native",
        marker: R20_PAGE_OCR_MARKER,
      };

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mobdea:r20-page-ocr-ready", {
          detail: {
            ...payload,
            resourceId: request.resourceId || request.assetId || "",
          },
        }));
      }
      return payload;
    })
    .catch((error) => {
      cache.delete(key);
      const safe = new Error(sanitizeOcrUserMessage(error?.message || error));
      safe.code = "R20_OCR_FAILED";
      throw safe;
    });

  cache.set(key, promise);
  return promise;
}

export function clearR20PageOcrCache(resourceId = "") {
  if (!resourceId) return cache.clear();
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${resourceId}::`)) cache.delete(key);
  }
}

if (typeof window !== "undefined") {
  window.mobdeaR20PageOcr = Object.freeze({
    marker: R20_PAGE_OCR_MARKER,
    recognizePageForQuestions,
    healthCheckR20PageOcr,
    sanitizeOcrUserMessage,
    clearR20PageOcrCache,
  });
}
