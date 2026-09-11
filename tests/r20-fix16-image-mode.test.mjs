import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(
    path,
    "utf8",
  );

test("FIX16 Image Mode has bounded 1x to 6x pinch", () => {
  const runtime =
    read(
      "src/services/r20ImageMode.js",
    );

  assert.match(
    runtime,
    /MIN_SCALE = 1/,
  );

  assert.match(
    runtime,
    /MAX_SCALE = 6/,
  );

  assert.match(
    runtime,
    /state\.pointers\.size ===\s*2/,
  );

  assert.match(
    runtime,
    /updatePinch/,
  );
});

test("FIX16 Image Mode supports pan and clamp", () => {
  const runtime =
    read(
      "src/services/r20ImageMode.js",
    );

  assert.match(
    runtime,
    /updatePan/,
  );

  assert.match(
    runtime,
    /clampPan/,
  );

  assert.match(
    runtime,
    /data-r20-image-pan-x/,
  );

  assert.match(
    runtime,
    /data-r20-image-pan-y/,
  );
});

test("FIX16 Image Mode keeps image contained at base scale", () => {
  const css =
    read(
      "src/styles/r20-fix16-image-mode.css",
    );

  assert.match(
    css,
    /object-fit:\s*contain\s*!important/,
  );

  assert.match(
    css,
    /max-width:\s*100%\s*!important/,
  );

  assert.match(
    css,
    /max-height:\s*100%\s*!important/,
  );

  assert.match(
    css,
    /place-items:\s*center\s*!important/,
  );
});

test("FIX16 Image Mode does not reparent or resize image pixels", () => {
  const runtime =
    read(
      "src/services/r20ImageMode.js",
    );

  assert.doesNotMatch(
    runtime,
    /appendChild\(image\)|prepend\(image\)|replaceChildren/,
  );

  assert.doesNotMatch(
    runtime,
    /naturalWidth\s*=|naturalHeight\s*=|\.width\s*=|\.height\s*=/,
  );
});

test("FIX16 Image Mode is scoped to ClassMode image resource", () => {
  const runtime =
    read(
      "src/services/r20ImageMode.js",
    );

  assert.match(
    runtime,
    /data-r20-classmode-root/,
  );

  assert.match(
    runtime,
    /data-r20-resource-kind="image"/,
  );

  const main =
    read(
      "src/main.jsx",
    );

  assert.match(
    main,
    /r20ImageMode\.js/,
  );

  assert.match(
    main,
    /r20-fix16-image-mode\.css/,
  );
});
