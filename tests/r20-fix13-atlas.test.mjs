import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(path, "utf8");

test("FIX13 has independent boundaries and names toggles", () => {
  const runtime =
    read(
      "src/services/r20AtlasRuntime.js",
    );

  assert.match(
    runtime,
    /data-r20-atlas-toggle/,
  );

  assert.match(
    runtime,
    /"boundaries"/,
  );

  assert.match(
    runtime,
    /"names"/,
  );

  assert.match(
    runtime,
    /حدود الدول/,
  );

  assert.match(
    runtime,
    /أسماء الدول/,
  );
});

test("FIX13 keeps independent atlas layer state", () => {
  const runtime =
    read(
      "src/services/r20AtlasRuntime.js",
    );

  assert.match(
    runtime,
    /boundariesVisible:\s*true/,
  );

  assert.match(
    runtime,
    /namesVisible:\s*true/,
  );

  assert.match(
    runtime,
    /state\.boundariesVisible\s*=\s*!state\.boundariesVisible/,
  );

  assert.match(
    runtime,
    /state\.namesVisible\s*=\s*!state\.namesVisible/,
  );
});

test("FIX13 boundaries toggle only affects stroke visibility", () => {
  const css =
    read(
      "src/styles/r20-fix13-atlas.css",
    );

  assert.match(
    css,
    /data-r20-atlas-boundaries-visible="false"/,
  );

  assert.match(
    css,
    /stroke-opacity:\s*0\s*!important/,
  );
});

test("FIX13 names toggle hides labels without geometry rewrite", () => {
  const runtime =
    read(
      "src/services/r20AtlasRuntime.js",
    );

  const css =
    read(
      "src/styles/r20-fix13-atlas.css",
    );

  assert.match(
    runtime,
    /data-r20-atlas-label/,
  );

  assert.match(
    css,
    /data-r20-atlas-names-visible="false"/,
  );

  assert.match(
    css,
    /display:\s*none\s*!important/,
  );

  assert.doesNotMatch(
    runtime,
    /setAttribute\(["'](?:d|points|x1|x2|y1|y2|cx|cy|transform)["']/,
  );
});

test("FIX13 excludes rivers and reference lines from boundaries", () => {
  const runtime =
    read(
      "src/services/r20AtlasRuntime.js",
    );

  assert.match(
    runtime,
    /data-r20-map-river/,
  );

  assert.match(
    runtime,
    /greenwich/,
  );

  assert.match(
    runtime,
    /graticule/,
  );

  assert.match(
    runtime,
    /جرينتش/,
  );
});

test("FIX13 atlas controls isolate pointer/click from map gestures", () => {
  const runtime =
    read(
      "src/services/r20AtlasRuntime.js",
    );

  assert.match(
    runtime,
    /pointerdown/,
  );

  assert.match(
    runtime,
    /event\.stopPropagation\(\)/,
  );

  assert.match(
    runtime,
    /event\.preventDefault\(\)/,
  );
});

test("FIX13 keeps Phase 13 maps installed", () => {
  const main =
    read(
      "src/main.jsx",
    );

  assert.match(
    main,
    /r20MapsRuntime\.js/,
  );

  assert.match(
    main,
    /r20AtlasRuntime\.js/,
  );

  assert.match(
    main,
    /r20-fix13-atlas\.css/,
  );
});
