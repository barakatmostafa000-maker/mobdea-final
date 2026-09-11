import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  normalizeWhiteboardTool,
  normalizeWhiteboardWidth,
  normalizeWhiteboardLineStyle,
  whiteboardStrokeProfile,
} from "../src/services/r20WhiteboardRuntime.js";

const read = (path) => fs.readFileSync(path, "utf8");

test("FIX09 detects distinct whiteboard tools in Arabic and English", () => {
  assert.equal(normalizeWhiteboardTool("قلم"), "pen");
  assert.equal(normalizeWhiteboardTool("Pencil"), "pencil");
  assert.equal(normalizeWhiteboardTool("فرشاة"), "brush");
  assert.equal(normalizeWhiteboardTool("ماركر"), "marker");
  assert.equal(normalizeWhiteboardTool("ممحاة"), "eraser");
  assert.equal(normalizeWhiteboardTool("خط مستقيم"), "line");
});

test("FIX09 width controls are actually different", () => {
  assert.equal(normalizeWhiteboardWidth("رفيع"), "thin");
  assert.equal(normalizeWhiteboardWidth("متوسط"), "medium");
  assert.equal(normalizeWhiteboardWidth("عريض"), "wide");
  assert.equal(normalizeWhiteboardWidth("عريض جدًا"), "extra-wide");

  const widths = [
    whiteboardStrokeProfile("pen", "thin").lineWidth,
    whiteboardStrokeProfile("pen", "medium").lineWidth,
    whiteboardStrokeProfile("pen", "wide").lineWidth,
    whiteboardStrokeProfile("pen", "extra-wide").lineWidth,
  ];

  assert.deepEqual(
    [...widths].sort((a,b) => a-b),
    widths,
  );
  assert.equal(new Set(widths).size, 4);
});

test("FIX09 pen pencil brush marker are visually distinct rendering profiles", () => {
  const pen = whiteboardStrokeProfile("pen", "medium");
  const pencil = whiteboardStrokeProfile("pencil", "medium");
  const brush = whiteboardStrokeProfile("brush", "medium");
  const marker = whiteboardStrokeProfile("marker", "medium");

  const signatures = [pen,pencil,brush,marker].map((profile) =>
    JSON.stringify({
      lineWidth: profile.lineWidth,
      alpha: profile.globalAlpha,
      cap: profile.lineCap,
      shadowBlur: profile.shadowBlur,
    }),
  );

  assert.equal(new Set(signatures).size, 4);
  assert.ok(marker.globalAlpha < pen.globalAlpha);
  assert.ok(brush.lineWidth > pen.lineWidth);
  assert.ok(pencil.lineWidth < pen.lineWidth);
});

test("FIX09 dashed dotted solid are distinct", () => {
  assert.equal(normalizeWhiteboardLineStyle("متصل"), "solid");
  assert.equal(normalizeWhiteboardLineStyle("متقطع"), "dashed");
  assert.equal(normalizeWhiteboardLineStyle("منقط"), "dotted");

  const solid = whiteboardStrokeProfile("line","medium","solid");
  const dashed = whiteboardStrokeProfile("line","medium","dashed");
  const dotted = whiteboardStrokeProfile("line","medium","dotted");

  assert.deepEqual(solid.lineDash, []);
  assert.notDeepEqual(dashed.lineDash, dotted.lineDash);
  assert.ok(dashed.lineDash.length > 0);
  assert.ok(dotted.lineDash.length > 0);
});

test("FIX09 eraser uses destination-out", () => {
  const eraser = whiteboardStrokeProfile("eraser","wide");
  assert.equal(
    eraser.globalCompositeOperation,
    "destination-out",
  );
});

test("FIX09 patches real CanvasRenderingContext2D stroke", () => {
  const runtime = read("src/services/r20WhiteboardRuntime.js");
  assert.match(runtime, /CanvasRenderingContext2D/);
  assert.match(runtime, /proto\.stroke = function/);
  assert.match(runtime, /this\.lineWidth = profile\.lineWidth/);
  assert.match(runtime, /this\.globalAlpha = profile\.globalAlpha/);
  assert.match(runtime, /this\.setLineDash/);
});

test("FIX09 centers canvas and makes tools/cards compact at bottom", () => {
  const css = read("src/styles/r20-fix09-whiteboard.css");

  assert.match(css, /data-r20-whiteboard-canvas-host="true"/);
  assert.match(css, /place-items:\s*center\s*!important/);
  assert.match(css, /data-r20-whiteboard-bottom-control="tools"/);
  assert.match(css, /data-r20-whiteboard-bottom-control="cards"/);
  assert.match(css, /width:\s*40px\s*!important/);
  assert.match(css, /position:\s*fixed\s*!important/);
});

test("FIX09 neutralizes only board-related opaque black overlays, never canvas", () => {
  const runtime = read("src/services/r20WhiteboardRuntime.js");
  const css = read("src/styles/r20-fix09-whiteboard.css");

  assert.match(runtime, /removeBoardToolBlackCover/);
  assert.match(runtime, /if \(element\.matches\("canvas"\)\) return/);
  assert.match(css, /data-r20-whiteboard-black-cover="neutralized"/);
  assert.match(css, /background:\s*transparent\s*!important/);
});

test("FIX09 retains student management runtime globally", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r20StudentManagement\.js/);
  assert.match(main, /r20WhiteboardRuntime\.js/);
  assert.match(main, /r20-fix09-whiteboard\.css/);
});
