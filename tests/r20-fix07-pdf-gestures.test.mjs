import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runtime = fs.readFileSync(
  "src/services/r20PdfGestures.js",
  "utf8",
);
const css = fs.readFileSync(
  "src/styles/r20-fix07-pdf-gestures.css",
  "utf8",
);
const main = fs.readFileSync("src/main.jsx", "utf8");

test("FIX07 supports true two-pointer pinch zoom from 1x to 6x", () => {
  assert.match(runtime, /MIN_SCALE = 1/);
  assert.match(runtime, /MAX_SCALE = 6/);
  assert.match(runtime, /state\.pointers\.size === 2/);
  assert.match(runtime, /gestureStartDistance/);
  assert.match(runtime, /currentDistance/);
  assert.match(runtime, /nextScale/);
});

test("FIX07 supports one-finger pan after zoom", () => {
  assert.match(runtime, /state\.scale > 1/);
  assert.match(runtime, /beginPan/);
  assert.match(runtime, /updatePan/);
  assert.match(runtime, /panStartPoint/);
  assert.match(runtime, /pointermove/);
});

test("FIX07 clamps panning and resets to 1x", () => {
  assert.match(runtime, /clampPan/);
  assert.match(runtime, /resetR20PdfTransform/);
  assert.match(runtime, /state\.scale = 1/);
  assert.match(runtime, /state\.x = 0/);
  assert.match(runtime, /state\.y = 0/);
});

test("FIX07 keeps PDF visible when board tools are activated", () => {
  assert.match(runtime, /wireBoardOverlayGuard/);
  assert.match(runtime, /protectPdfVisibility/);
  assert.match(runtime, /markBoardOverlay/);
  assert.match(runtime, /data-r20-pdf-board-mode/);
  assert.match(css, /data-r20-pdf-page-visible="true"/);
  assert.match(css, /visibility:\s*visible\s*!important/);
  assert.match(css, /background:\s*transparent\s*!important/);
});

test("FIX07 pager is smaller and translucent", () => {
  assert.match(css, /data-r20-pdf-pager="true"/);
  assert.match(css, /scale\(\.74\)/);
  assert.match(css, /opacity:\s*\.5\s*!important/);
  assert.match(css, /scale\(\.68\)/);
});

test("FIX07 does not replace or re-parent React PDF DOM", () => {
  assert.doesNotMatch(runtime, /replaceChildren/);
  assert.doesNotMatch(runtime, /appendChild\(.*react-pdf/i);
  assert.doesNotMatch(runtime, /remove\(\).*react-pdf/i);
});

test("FIX07 runtime and stylesheet are imported", () => {
  assert.match(main, /r20PdfGestures\.js/);
  assert.match(main, /r20-fix07-pdf-gestures\.css/);
  assert.match(runtime, /R20_FIX07_PDF_PINCH_PAN_BOARD_OVERLAY_V2_AUDITED/);
});
