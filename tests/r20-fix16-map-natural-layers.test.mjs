import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(
    path,
    "utf8",
  );

test("FIX16 adds five requested top-level natural layers", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeNaturalLayers.js",
    );

  for (const layer of [
    "terrain",
    "minerals",
    "forests",
    "grasslands",
    "deserts",
  ]) {
    assert.match(
      runtime,
      new RegExp(layer),
    );
  }

  assert.match(
    runtime,
    /التضاريس/,
  );

  assert.match(
    runtime,
    /الثروات المعدنية/,
  );

  assert.match(
    runtime,
    /الغابات/,
  );

  assert.match(
    runtime,
    /الحشائش/,
  );

  assert.match(
    runtime,
    /الصحاري/,
  );
});

test("FIX16 terrain contains mountains plateaus plains islands", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeNaturalLayers.js",
    );

  for (const token of [
    "mountains",
    "plateaus",
    "plains",
    "islands",
  ]) {
    assert.match(
      runtime,
      new RegExp(token),
    );
  }

  for (const token of [
    "جبال",
    "هضاب",
    "سهول",
    "جزر",
  ]) {
    assert.match(
      runtime,
      new RegExp(token),
    );
  }
});

test("FIX16 natural layer controls hide existing elements only", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeNaturalLayers.js",
    );

  const css =
    read(
      "src/styles/r20-fix16-map-natural-layers.css",
    );

  assert.match(
    runtime,
    /data-r20-natural-layer/,
  );

  assert.match(
    css,
    /data-r20-natural-layer-terrain="off"/,
  );

  assert.match(
    css,
    /opacity:\s*0\s*!important/,
  );

  assert.doesNotMatch(
    runtime,
    /setAttribute\(["'](?:d|points|x1|x2|y1|y2|cx|cy|lat|lng|longitude|latitude)["']/,
  );
});

test("FIX16 detector must require real source availability", () => {
  const config =
    read(
      "src/config/r20MapChallengeNaturalLayersConfig.js",
    );

  assert.match(
    config,
    /R20_NATURAL_LAYER_AVAILABILITY/,
  );

  for (const layer of [
    "terrain",
    "minerals",
    "forests",
    "grasslands",
    "deserts",
  ]) {
    assert.match(
      config,
      new RegExp(
        `"${layer}"\\s*:\\s*true`,
      ),
    );
  }
});

test("FIX16 retains original four Map Challenge layers", () => {
  const prior =
    read(
      "src/services/r20MapChallengeRuntime.js",
    );

  for (const layer of [
    "boundaries",
    "names",
    "rivers",
    "references",
  ]) {
    assert.match(
      prior,
      new RegExp(layer),
    );
  }
});
