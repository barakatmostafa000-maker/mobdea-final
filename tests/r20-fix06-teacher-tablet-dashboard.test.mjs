import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runtime = fs.readFileSync(
  "src/services/r20TeacherTabletDashboard.js",
  "utf8",
);
const css = fs.readFileSync(
  "src/styles/r20-fix06-teacher-tablet-dashboard.css",
  "utf8",
);
const main = fs.readFileSync("src/main.jsx", "utf8");

test("FIX06 is teacher-dashboard only and keeps student/parent role logic intact", () => {
  assert.match(runtime, /R20_FIX06_TEACHER_TABLET_DASHBOARD_V1/);
  assert.match(runtime, /explicit === "student"/);
  assert.match(runtime, /explicit === "parent"/);
  assert.match(runtime, /data-r20-dashboard-role/);
  assert.match(runtime, /"teacher"/);
});

test("FIX06 marks hero grid cards without re-parenting dashboard DOM", () => {
  assert.match(runtime, /data-r20-teacher-hero/);
  assert.match(runtime, /data-r20-teacher-grid/);
  assert.match(runtime, /data-r20-teacher-card/);

  assert.doesNotMatch(runtime, /appendChild\(.*hero/i);
  assert.doesNotMatch(runtime, /prepend\(.*hero/i);
  assert.doesNotMatch(runtime, /replaceChildren/);
});

test("FIX06 prevents tablet clipping and fixed oversized dashboard widths", () => {
  assert.match(css, /data-r20-teacher-dashboard="true"/);
  assert.match(css, /min-width:\s*0\s*!important/);
  assert.match(css, /max-width:\s*100%\s*!important/);
  assert.match(css, /overflow-x:\s*clip\s*!important/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /max-width:\s*1400px/);
  assert.match(css, /max-width:\s*1024px/);
});

test("FIX06 hero content remains completely visible", () => {
  assert.match(css, /data-r20-teacher-hero="true"/);
  assert.match(css, /overflow:\s*visible\s*!important/);
  assert.match(css, /max-height:\s*none\s*!important/);
  assert.match(css, /object-fit:\s*contain\s*!important/);
  assert.match(css, /overflow-wrap:\s*anywhere\s*!important/);
});

test("FIX06 imports runtime and stylesheet after prior cumulative repairs", () => {
  assert.match(main, /r20TeacherTabletDashboard\.js/);
  assert.match(main, /r20-fix06-teacher-tablet-dashboard\.css/);
  assert.match(main, /r20PortalDashboard\.js/);
});
