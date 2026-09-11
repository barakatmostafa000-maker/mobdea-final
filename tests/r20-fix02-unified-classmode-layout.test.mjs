import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("FIX02 imports the unified ClassMode layout", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r20-fix02-unified-classmode-layout\.css/);
  assert.match(main, /r20UnifiedClassModeLayout\.js/);
});

test("FIX02 covers all required resource kinds", () => {
  const runtime = read("src/services/r20UnifiedClassModeLayout.js");
  for (const kind of [
    "pdf",
    "whiteboard",
    "image",
    "video",
    "audio",
    "powerpoint",
    "map",
    "game",
  ]) {
    assert.match(runtime, new RegExp(`"${kind}"`));
  }
});

test("FIX02 has one shared control contract", () => {
  const css = read("src/styles/r20-fix02-unified-classmode-layout.css");

  for (const control of [
    "back",
    "students",
    "save",
    "board-tools",
    "cards",
    "symbols",
  ]) {
    assert.match(css, new RegExp(`data-r20-control="${control}"`));
  }

  assert.match(css, /data-r20-control="online-floating"/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /data-r20-duplicate-control="true"/);
});

test("FIX02 back control is compact top-only and shared controls are compact bottom controls", () => {
  const css = read("src/styles/r20-fix02-unified-classmode-layout.css");

  assert.match(css, /--r20-class-control-size:\s*38px/);
  assert.match(css, /data-r20-control="back"/);
  assert.match(css, /top:\s*var\(--r20-class-top-gap\)/);
  assert.match(css, /data-r20-control="students"/);
  assert.match(css, /bottom:\s*var\(--r20-class-bottom-gap\)/);
  assert.match(css, /data-r20-pager="true"/);
});
