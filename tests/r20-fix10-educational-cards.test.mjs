import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  cardTextClass,
  cardFontScale,
} from "../src/services/r20EducationalCards.js";

const read = (path) => fs.readFileSync(path, "utf8");

test("FIX10 text classification shrinks as definition grows", () => {
  assert.equal(cardTextClass("النيل", "نهر"), "short");
  assert.equal(
    cardTextClass(
      "الدولة",
      "هي مجموعة من السكان يعيشون بصورة دائمة فوق إقليم معين ويخضعون لسلطة سياسية منظمة ذات سيادة.",
    ),
    "medium",
  );
  assert.equal(cardTextClass("تعريف طويل", "أ".repeat(300)), "xlong");
  assert.equal(cardTextClass("تعريف طويل جدًا", "ب".repeat(450)), "xxlong");
  assert.ok(cardFontScale("أ", "ب".repeat(450)) < cardFontScale("أ", "ب"));
});

test("FIX10 unifies term and definition inside one coherent body", () => {
  const runtime = read("src/services/r20EducationalCards.js");
  assert.match(runtime, /data-r20-educational-card-body/);
  assert.match(runtime, /content\.appendChild\(title\)/);
  assert.match(runtime, /content\.appendChild\(body\)/);
  assert.match(runtime, /data-r20-educational-card-term/);
  assert.match(runtime, /data-r20-educational-card-definition/);
});

test("FIX10 auto-fit uses text length and actual overflow", () => {
  const runtime = read("src/services/r20EducationalCards.js");
  assert.match(runtime, /cardTextClass/);
  assert.match(runtime, /cardFontScale/);
  assert.match(runtime, /measureOverflow/);
  assert.match(runtime, /scrollHeight > card\.clientHeight/);
  assert.match(runtime, /--r20-card-font-scale/);
  assert.match(runtime, /scale - 0\.055/);
});

test("FIX10 flattens old strips without deleting content", () => {
  const runtime = read("src/services/r20EducationalCards.js");
  const css = read("src/styles/r20-fix10-educational-cards.css");
  assert.match(runtime, /data-r20-legacy-card-strip/);
  assert.match(css, /data-r20-legacy-card-strip="true"/);
  assert.match(css, /display:\s*contents\s*!important/);
  assert.doesNotMatch(runtime, /remove\(\).*term-strip/);
});

test("FIX10 explicitly excludes country cards", () => {
  const runtime = read("src/services/r20EducationalCards.js");
  const css = read("src/styles/r20-fix10-educational-cards.css");
  assert.match(runtime, /function isCountryCard/);
  assert.match(runtime, /if \(!card \|\| processed\.has\(card\) \|\| !isEducationalDefinitionCard\(card\)\)/);
  assert.match(css, /phase10-country-card-untouched/);
});

test("FIX10 preserves cards trigger beside whiteboard tools", () => {
  const runtime = read("src/services/r20EducationalCards.js");
  const whiteboardCss = read("src/styles/r20-fix09-whiteboard.css");
  assert.match(runtime, /data-r20-whiteboard-bottom-control="cards"/);
  assert.match(whiteboardCss, /data-r20-whiteboard-bottom-control="tools"/);
  assert.match(whiteboardCss, /data-r20-whiteboard-bottom-control="cards"/);
});

test("FIX10 imports after whiteboard phase", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r20WhiteboardRuntime\.js/);
  assert.match(main, /r20EducationalCards\.js/);
  assert.match(main, /r20-fix10-educational-cards\.css/);
});
