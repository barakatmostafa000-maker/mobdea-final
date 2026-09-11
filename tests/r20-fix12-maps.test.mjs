import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("FIX12 provides bounded pinch and pan", () => {
  const runtime = read("src/services/r20MapsRuntime.js");
  assert.match(runtime, /MIN_SCALE = 1/);
  assert.match(runtime, /MAX_SCALE = 5/);
  assert.match(runtime, /state\.pointers\.size === 2/);
  assert.match(runtime, /updatePinch/);
  assert.match(runtime, /updatePan/);
  assert.match(runtime, /clampPan/);
});

test("FIX12 avoids double scaling in pan bounds", () => {
  const runtime = read("src/services/r20MapsRuntime.js");
  assert.match(runtime, /naturalSize\(content, scale\)/);
  assert.match(runtime, /rect\.width \/ safeScale/);
  assert.match(runtime, /size\.width \* state\.scale/);
});

test("FIX12 corrects only semantic black land", () => {
  const runtime = read("src/services/r20MapsRuntime.js");
  const css = read("src/styles/r20-fix12-maps.css");
  assert.match(runtime, /data-r20-map-land-black/);
  assert.match(runtime, /land\|country\|region\|continent/);
  assert.match(css, /data-r20-map-land-black="corrected"/);
  assert.doesNotMatch(runtime, /\.setAttribute\(["']fill["']/);
});

test("FIX12 improves river rendering without geometry rewrite", () => {
  const runtime = read("src/services/r20MapsRuntime.js");
  const css = read("src/styles/r20-fix12-maps.css");
  assert.match(runtime, /data-r20-map-river/);
  assert.match(css, /stroke-linecap:\s*round\s*!important/);
  assert.match(css, /vector-effect:\s*non-scaling-stroke\s*!important/);
  assert.doesNotMatch(runtime, /\.setAttribute\(["']d["']/);
});

test("FIX12 symbols click preserves transform", () => {
  const runtime = read("src/services/r20MapsRuntime.js");
  assert.match(runtime, /data-r20-map-symbols-control/);
  assert.match(runtime, /const before = \{/);
  assert.match(runtime, /state\.scale = before\.scale/);
  assert.match(runtime, /state\.x = before\.x/);
  assert.match(runtime, /state\.y = before\.y/);
});

test("FIX12 marks latitude and Greenwich controls without coordinate rewrite", () => {
  const runtime = read("src/services/r20MapsRuntime.js");
  const css = read("src/styles/r20-fix12-maps.css");
  assert.match(runtime, /خطوط العرض/);
  assert.match(runtime, /جرينتش/);
  assert.match(css, /data-r20-map-reference-control/);
  assert.doesNotMatch(
    runtime,
    /setAttribute\(["'](?:cx|cy|x1|x2|y1|y2|points|d)["']/,
  );
});

test("FIX12 remains connected to unified ClassMode", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r20MapsRuntime\.js/);
  assert.match(main, /r20-fix12-maps\.css/);
  assert.match(main, /r20UnifiedClassModeLayout\.js/);
});
