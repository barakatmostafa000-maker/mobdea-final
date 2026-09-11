import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(p,"utf8");

test("FIX08 native OCR uses ARGB_8888 and 17 bundled models", () => {
  const java = read("android/app/src/main/java/com/mobdea/education/ocr/R20PageOcrPlugin.java");
  assert.match(java,/Bitmap\.Config\.ARGB_8888/);
  assert.match(java,/getAssets\(\)\.list\("tess304"\)/);
  assert.match(java,/api\.init\(dataRoot\.getAbsolutePath\(\), lang\)/);
  for (const token of ["ara.traineddata","ara.cube.word-freq","eng.traineddata","eng.tesseract_cube.nn"]) {
    assert.match(java,new RegExp(token.replaceAll(".","\\.")));
  }
});

test("FIX08 safe native response never exposes model path", () => {
  const java = read("android/app/src/main/java/com/mobdea/education/ocr/R20PageOcrPlugin.java");
  assert.match(java,/rejectSafe/);
  assert.match(java,/OCR failed\. Please retry the page\./);
  const blocks = java.match(/JSObject out = new JSObject\(\);[\s\S]*?call\.resolve\(out\);/g) || [];
  for (const block of blocks) {
    assert.doesNotMatch(block,/getAbsolutePath|tess304|traineddata/);
  }
});

test("FIX08 JS calls native page OCR and retains page number", async () => {
  globalThis.Capacitor = {
    Plugins: {
      R20PageOcr: {
        recognizePdfPage: async ({pageNumber}) => ({
          text:`سؤال الصفحة ${pageNumber}؟`,
          pageNumber,
          engine:"native-test",
        }),
        healthCheck: async () => ({ok:true,ready:true,modelCount:17}),
      },
    },
  };
  const mod = await import(`../src/services/r20PageOcrPipeline.js?t=${Date.now()}`);
  const value = await mod.recognizePageForQuestions({
    resourceId:"book-1",
    pdfPath:"/private/example.pdf",
    pageNumber:4,
  });
  assert.equal(value.pageNumber,4);
  assert.equal(value.text,"سؤال الصفحة 4؟");
  const health = await mod.healthCheckR20PageOcr();
  assert.equal(health.modelCount,17);
});

test("FIX08 hides internal OCR paths", async () => {
  const mod = await import(`../src/services/r20PageOcrPipeline.js?s=${Date.now()}`);
  const safe = mod.sanitizeOcrUserMessage(
    "error /data/user/0/app/files/tess304/ara.traineddata"
  );
  assert.doesNotMatch(safe,/tess304|traineddata|\/data\/user\//i);
});

test("FIX08 is physically wired to ClassMode and page-question architecture", () => {
  const main = read("src/main.jsx");
  const cm = read("src/pages/ClassMode.jsx");
  assert.match(main,/r20PageOcrPipeline\.js/);
  assert.match(main,/r20OcrUiGuard\.js/);
  assert.match(cm,/R20PageOcr|recognizePageForQuestions|R20_FIX08_CLASSMODE_OCR_BRIDGE/);
  assert.match(cm,/relatedQuestions/);
  assert.match(cm,/project12QuestionScope/);
  assert.doesNotMatch(cm,/tess304[\\/]|(?:ara|eng)\.traineddata/i);
});
