import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(
    path,
    "utf8",
  );

test("FIX17 capability detector must find Video Audio PowerPoint and PPT navigation", () => {
  const config =
    read(
      "src/config/r20MediaCapabilities.js",
    );

  for (const capability of [
    "video",
    "audio",
    "powerpoint",
    "powerpointNavigation",
  ]) {
    assert.match(
      config,
      new RegExp(
        `"${capability}"\\s*:\\s*true`,
      ),
    );
  }
});

test("FIX17 Video and Audio use one unified control implementation", () => {
  const runtime =
    read(
      "src/services/r20MediaControls.js",
    );

  for (const action of [
    "play",
    "back-10",
    "forward-10",
    "seek",
    "mute",
    "volume",
  ]) {
    assert.match(
      runtime,
      new RegExp(action),
    );
  }

  assert.match(
    runtime,
    /fullscreen/,
  );

  assert.match(
    runtime,
    /media\.play\(\)/,
  );

  assert.match(
    runtime,
    /media\.pause\(\)/,
  );

  assert.match(
    runtime,
    /media\.currentTime/,
  );
});

test("FIX17 custom controls preserve native controls until fully built", () => {
  const runtime =
    read(
      "src/services/r20MediaControls.js",
    );

  assert.match(
    runtime,
    /state\.controls &&/,
  );

  assert.match(
    runtime,
    /media\.controls =\s*false/,
  );

  assert.match(
    runtime,
    /media\.controls =\s*true/,
  );
});

test("FIX17 media is contained and controls stay inside ClassMode", () => {
  const css =
    read(
      "src/styles/r20-fix17-media.css",
    );

  assert.match(
    css,
    /data-r20-media-surface="video"/,
  );

  assert.match(
    css,
    /object-fit:\s*contain\s*!important/,
  );

  assert.match(
    css,
    /data-r20-media-controls/,
  );

  assert.match(
    css,
    /safe-area-inset-bottom/,
  );
});

test("FIX17 PowerPoint proxies existing Previous and Next controls", () => {
  const runtime =
    read(
      "src/services/r20PowerPointMode.js",
    );

  assert.match(
    runtime,
    /data-r20-ppt-action/,
  );

  assert.match(
    runtime,
    /"previous"/,
  );

  assert.match(
    runtime,
    /"next"/,
  );

  assert.match(
    runtime,
    /source\.click\(\)/,
  );

  assert.match(
    runtime,
    /data-r20-ppt-navigation-status/,
  );
});

test("FIX17 PowerPoint preserves the existing rendering engine", () => {
  const runtime =
    read(
      "src/services/r20PowerPointMode.js",
    );

  assert.doesNotMatch(
    runtime,
    /replaceChildren|innerHTML\s*=\s*.*slide/i,
  );

  assert.doesNotMatch(
    runtime,
    /new\s+JSZip|pptxgen|pdfjs/i,
  );

  assert.doesNotMatch(
    runtime,
    /appendChild\(\s*(?:canvas|img|iframe|embed|object)/i,
  );
});

test("FIX17 is wired after Image Mode and keeps prior media tests discoverable", () => {
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
    /r20MediaControls\.js/,
  );

  assert.match(
    main,
    /r20PowerPointMode\.js/,
  );

  assert.match(
    main,
    /r20-fix17-media\.css/,
  );
});
