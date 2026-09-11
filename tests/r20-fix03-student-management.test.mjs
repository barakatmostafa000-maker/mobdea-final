import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  chooseRandomCandidate,
  normalizeStudentCredentialDigits,
} from "../src/services/r20StudentManagement.js";

const read = (path) => fs.readFileSync(path, "utf8");

test("FIX03 requires an exact selected candidate pool", () => {
  const none = chooseRandomCandidate([], [], () => 0);
  assert.equal(none.id, null);

  const first = chooseRandomCandidate(["a", "c"], [], () => 0);
  assert.equal(first.id, "a");
  assert.ok(!["b"].includes(first.id));

  const second = chooseRandomCandidate(
    ["a", "c"],
    first.nextDrawn,
    () => 0,
  );
  assert.equal(second.id, "c");

  const third = chooseRandomCandidate(
    ["a", "c"],
    second.nextDrawn,
    () => 0,
  );
  assert.equal(third.id, "a");
  assert.equal(third.cycleReset, true);
});

test("FIX03 normalizes Arabic and Persian digits for code and PIN login", () => {
  assert.equal(
    normalizeStudentCredentialDigits(" ١٢٣٤٥٦ "),
    "123456",
  );
  assert.equal(
    normalizeStudentCredentialDigits("۱۲۳۴۵۶"),
    "123456",
  );
});

test("FIX03 imports student management CSS and runtime", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r20-fix03-student-management\.css/);
  assert.match(main, /r20StudentManagement\.js/);
});

test("FIX03 student list is touch-scrollable and legacy random popup is hidden", () => {
  const css = read("src/styles/r20-fix03-student-management.css");
  assert.match(css, /overflow-y:\s*auto\s*!important/);
  assert.match(css, /touch-action:\s*pan-y\s*!important/);
  assert.match(css, /data-r20-legacy-random-modal="true"/);
  assert.match(css, /data-r20-student-modal="true"/);
});

test("FIX03 picker speaks the chosen student and does not re-parent React student rows", () => {
  const runtime = read("src/services/r20StudentManagement.js");
  assert.match(runtime, /mobdeaR20SpeakArabic/);
  assert.match(runtime, /selectedCandidateIds = new Set/);
  assert.match(runtime, /nextList\.insertBefore\(panel, nextList\.firstChild\)/);
  assert.doesNotMatch(runtime, /appendChild\(row\)/);
  assert.doesNotMatch(runtime, /prepend\(row\)/);
});

test("FIX03 keeps stable student row identifiers when available", () => {
  const source = read("src/pages/ClassMode.jsx");
  assert.match(source, /data-student-id=\{String\(student\.id\)\}/);
});
