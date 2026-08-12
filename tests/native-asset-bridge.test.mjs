import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ocrJs = fs.readFileSync(new URL('../src/services/pdfQuestionOcr.js', import.meta.url), 'utf8');
const pdfJs = fs.readFileSync(new URL('../src/services/pdfRenderer.js', import.meta.url), 'utf8');
const pptxJs = fs.readFileSync(new URL('../src/components/classmode/PptxPreview.jsx', import.meta.url), 'utf8');
const bridgeJs = fs.readFileSync(new URL('../src/services/nativeAssetBridge.js', import.meta.url), 'utf8');
const ocrJava = fs.readFileSync(new URL('../android/app/src/main/java/com/mobdea/education/ocr/MobdeaPdfOcrPlugin.java', import.meta.url), 'utf8');
const mainActivity = fs.readFileSync(new URL('../android/app/src/main/java/com/mobdea/education/MainActivity.java', import.meta.url), 'utf8');
const androidBuild = fs.readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');

test('large native documents are staged in bounded chunks instead of one full Base64 copy', () => {
  assert.match(bridgeJs, /CHUNK_BYTES = 384 \* 1024/);
  assert.match(bridgeJs, /blob\.slice\(uploaded, end\)/);
  assert.doesNotMatch(ocrJs, /blob\.arrayBuffer\(\)/);
  assert.doesNotMatch(pdfJs, /blob\.arrayBuffer\(\)/);
  assert.doesNotMatch(pptxJs, /arrayBufferToBase64/);
  assert.match(mainActivity, /registerPlugin\(MobdeaNativeAssetPlugin\.class\)/);
});

test('OCR uses a staged file, processes bounded page ranges and supports cancellation', () => {
  assert.match(ocrJs, /assetPath/);
  assert.match(ocrJs, /NativePdfOcr\.cancel/);
  assert.match(ocrJs, /OCR_BATCH_PAGES = 4/);
  assert.match(ocrJs, /batchStart \+= OCR_BATCH_PAGES/);
  assert.match(ocrJava, /MAX_PAGE_RANGE = 20/);
  assert.match(ocrJava, /Bitmap\.Config\.RGB_565/);
  assert.match(ocrJava, /resolveStagedAsset/);
  assert.match(ocrJava, /AtomicBoolean/);
  assert.match(ocrJava, /checkCancelled/);
  assert.doesNotMatch(ocrJava, /Base64\.decode/);
  assert.match(ocrJava, /copyBundledModel/);
  assert.match(androidBuild, /@tesseract\.js-data\/ara/);
  assert.match(androidBuild, /@tesseract\.js-data\/eng/);
});

test('native PDF rendering accepts the encrypted 200 MB asset limit and evicts staged files', () => {
  assert.match(pdfJs, /200 \* 1024 \* 1024/);
  assert.match(pdfJs, /MAX_CACHED_PDF_ASSETS = 3/);
  assert.match(pdfJs, /releaseNativeAsset/);
});
