import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(path, "utf8");

test("FIX18 detects a real Games route and question flow", () => {
  const config = read(
    "src/config/r20GamesConfig.js",
  );

  assert.match(
    config,
    /R20_GAMES_PATH/,
  );

  assert.doesNotMatch(
    config,
    /R20_GAMES_PATH = ""/,
  );

  assert.match(
    config,
    /R20_GAMES_HAS_QUESTION_FLOW = true/,
  );
});

test("FIX18 is student-only at dashboard entry level", () => {
  const runtime = read(
    "src/services/r20GamesRuntime.js",
  );

  const dashboard = read(
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
    /data-r20-games-dashboard-entry/,
  );

  assert.match(
    runtime,
    /data-r20-dashboard-access/,
  );

  assert.match(
    dashboard,
    /"games"/,
  );
});

test("FIX18 Games hub is responsive and scrollable", () => {
  const css = read(
    "src/styles/r20-fix18-games.css",
  );

  assert.match(
    css,
    /data-r20-games-hub="true"/,
  );

  assert.match(
    css,
    /overflow-y:\s*auto\s*!important/,
  );

  assert.match(
    css,
    /repeat\(\s*auto-fit/,
  );

  assert.match(
    css,
    /max-width:\s*899px/,
  );

  assert.match(
    css,
    /max-width:\s*699px/,
  );
});

test("FIX18 observes real question-answer progression without generating questions", () => {
  const runtime = read(
    "src/services/r20GamesRuntime.js",
  );

  assert.match(
    runtime,
    /data-r20-game-current-question/,
  );

  assert.match(
    runtime,
    /data-r20-game-answer/,
  );

  assert.match(
    runtime,
    /data-r20-game-question-transition/,
  );

  assert.match(
    runtime,
    /questionSignature/,
  );

  assert.match(
    runtime,
    /scoreSignature/,
  );

  assert.doesNotMatch(
    runtime,
    /\bquestions\s*=\s*\[/i,
  );

  assert.doesNotMatch(
    runtime,
    /\bcorrectAnswer\s*=/i,
  );
});

test("FIX18 does not rewrite game engine state", () => {
  const runtime = read(
    "src/services/r20GamesRuntime.js",
  );

  assert.doesNotMatch(
    runtime,
    /\b(?:score|points|lives|timer|currentQuestion|questionIndex)\s*=/i,
  );

  assert.doesNotMatch(
    runtime,
    /localStorage\.setItem\([^)]*(?:score|game|question)/i,
  );
});

test("FIX18 retains prior Map Challenge and imports Games runtime", () => {
  const main = read(
    "src/main.jsx",
  );

  assert.match(
    main,
    /r20MapChallengeRuntime\.js/,
  );

  assert.match(
    main,
    /r20GamesRuntime\.js/,
  );

  assert.match(
    main,
    /r20-fix18-games\.css/,
  );
});
