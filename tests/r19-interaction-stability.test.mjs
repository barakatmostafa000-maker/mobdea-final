import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/services/r19InteractionFixes.js", import.meta.url),
  "utf8",
);
const classMode = fs.readFileSync(
  new URL("../src/pages/ClassMode.jsx", import.meta.url),
  "utf8",
);

test("student panel runtime does not re-append React-owned rows on every sync", () => {
  assert.doesNotMatch(
    source,
    /rows\.forEach\(\s*\([^)]*\)\s*=>\s*list\.appendChild/,
  );
  assert.match(source, /row\.style\.order\s*=\s*String\(index\)/);
  assert.match(source, /r19RosterSignature/);
  assert.match(source, /leftList\.dataset\.r19RosterSignature\s*!==\s*signature/);
});

test("observer ignores the mirror UI it owns", () => {
  assert.match(source, /shouldIgnoreMutation/);
  assert.match(source, /r19-students-left-panel/);
  assert.match(source, /mutations\.every\(shouldIgnoreMutation\)/);
});

test("floating student UI is created only while Class Mode exists", () => {
  assert.match(source, /if\s*\(!classModeRoot\(\)\)\s*return null/);
  assert.match(source, /cleanupFloatingUi/);
  assert.match(source, /findStudentToggle\(\)/);
});

test("student roster keeps draggable controls, split view and save shortcut", () => {
  assert.match(source, /makeDraggable\(original,\s*"students-right"\)/);
  assert.match(source, /makeDraggable\(mirror,\s*"students-left"\)/);
  assert.match(source, /r19-second-half/);
  assert.match(source, /r19-quick-board-save/);
  assert.match(source, /localeCompare/);
});

test("left-side proxy actions always resolve the current React student row", () => {
  assert.match(classMode, /data-student-id=\{String\(student\.id\)\}/);
  assert.match(source, /function rowIdentity/);
  assert.match(source, /const sourceIdentity = rowIdentity\(source\)/);
  assert.match(source, /liveRows\.find/);
  assert.doesNotMatch(
    source,
    /const sourceButtons = \[\.\.\.source\.querySelectorAll/,
  );
});
