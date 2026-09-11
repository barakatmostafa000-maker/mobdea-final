import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(path, "utf8");

test("FIX15 detector must produce a concrete Map Challenge route", () => {
  const config =
    read(
      "src/config/r20MapChallengeConfig.js",
    );

  assert.match(
    config,
    /R20_MAP_CHALLENGE_PATH/,
  );

  assert.doesNotMatch(
    config,
    /R20_MAP_CHALLENGE_PATH = ""/,
  );
});

test("FIX15 student dashboard entry is student-only and allowed", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeRuntime.js",
    );

  const dashboard =
    read(
      "src/services/r20PortalDashboard.js",
    );

  assert.match(
    runtime,
    /data-r20-dashboard-role="student"/,
  );

  assert.doesNotMatch(
    runtime,
    /data-r20-dashboard-role="parent"/,
  );

  assert.match(
    runtime,
    /data-r20-dashboard-feature/,
  );

  assert.match(
    runtime,
    /map-challenge/,
  );

  assert.match(
    runtime,
    /data-r20-dashboard-access/,
  );

  assert.match(
    runtime,
    /"allowed"/,
  );

  assert.match(
    dashboard,
    /"map-challenge"/,
  );
});

test("FIX15 challenge layout makes map primary and panels scroll", () => {
  const css =
    read(
      "src/styles/r20-fix15-map-challenge.css",
    );

  assert.match(
    css,
    /data-r20-map-challenge-root="true"/,
  );

  assert.match(
    css,
    /grid-template-columns:\s*[\s\S]*minmax\(0,\s*1fr\)/,
  );

  assert.match(
    css,
    /data-r20-map-challenge-map="true"/,
  );

  assert.match(
    css,
    /data-r20-map-challenge-panel="true"/,
  );

  assert.match(
    css,
    /overflow-y:\s*auto\s*!important/,
  );

  assert.match(
    css,
    /max-width:\s*899px/,
  );
});

test("FIX15 exposes four independent visual layer toggles", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeRuntime.js",
    );

  for (const kind of [
    "boundaries",
    "names",
    "rivers",
    "references",
  ]) {
    assert.match(
      runtime,
      new RegExp(kind),
    );
  }

  assert.match(
    runtime,
    /data-r20-map-challenge-layer-toggle/,
  );

  assert.match(
    runtime,
    /applyLayerState/,
  );
});

test("FIX15 reuses Phase13 map gestures when challenge has no native gestures", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeRuntime.js",
    );

  assert.match(
    runtime,
    /R20_MAP_CHALLENGE_HAS_NATIVE_GESTURES/,
  );

  assert.match(
    runtime,
    /data-r20-resource-kind/,
  );

  assert.match(
    runtime,
    /"map"/,
  );

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
    /r20MapChallengeRuntime\.js/,
  );
});

test("FIX15 does not rewrite challenge scoring lives timer results or geometry", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeRuntime.js",
    );

  assert.doesNotMatch(
    runtime,
    /(?:score|lives|timer|result)\s*=/i,
  );

  assert.doesNotMatch(
    runtime,
    /setAttribute\(["'](?:d|points|x1|x2|y1|y2|cx|cy|lat|lng|longitude|latitude)["']/,
  );
});

test("FIX15 hides challenge student-card area only inside challenge root", () => {
  const runtime =
    read(
      "src/services/r20MapChallengeRuntime.js",
    );

  const css =
    read(
      "src/styles/r20-fix15-map-challenge.css",
    );

  assert.match(
    runtime,
    /markStudentCardInsideChallenge/,
  );

  assert.match(
    css,
    /data-r20-map-challenge-student-card="hidden"/,
  );
});

test("FIX15 detector is conservative and never edits Map Challenge source", () => {
  const detector =
    read(
      "scripts/r20-fix15-detect-map-challenge.py",
    );

  assert.match(
    detector,
    /REPORT\.write_text/,
  );

  assert.match(
    detector,
    /R20_MAP_CHALLENGE_PATH/,
  );

  assert.doesNotMatch(
    detector,
    /write_text\([^)]*path/i,
  );
});
