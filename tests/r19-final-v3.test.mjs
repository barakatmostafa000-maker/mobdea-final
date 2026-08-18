import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { mergeAppData } from "../src/services/dataMerge.js";

const read = (path) => fs.readFileSync(path, "utf8");

test("phone and tablet records merge without losing unique data", () => {
  const phone = {
    students: [
      {
        id: "s1",
        name: "Phone newest",
        grade: "1",
        group: "A",
        updatedAt: "2026-08-17T08:00:00.000Z",
      },
      {
        id: "s2",
        name: "Phone only",
        grade: "1",
        group: "A",
        updatedAt: "2026-08-17T07:00:00.000Z",
      },
    ],
    sessions: [],
    settings: { cloudSync: {} },
  };
  const tablet = {
    students: [
      {
        id: "s1",
        name: "Tablet older",
        grade: "1",
        group: "A",
        updatedAt: "2026-08-17T06:00:00.000Z",
      },
      {
        id: "s3",
        name: "Tablet only",
        grade: "1",
        group: "A",
        updatedAt: "2026-08-17T09:00:00.000Z",
      },
    ],
    sessions: [],
    settings: { cloudSync: {} },
  };

  const merged = mergeAppData(phone, tablet);
  assert.equal(merged.students.length, 3);
  assert.equal(
    merged.students.find((item) => item.id === "s1").name,
    "Phone newest",
  );
  assert.ok(merged.students.some((item) => item.id === "s2"));
  assert.ok(merged.students.some((item) => item.id === "s3"));
});

test("app uses the actual pull merge push cloud flow", () => {
  const source = read("src/App.jsx");
  assert.match(source, /pullCloudDataIfExists/);
  assert.match(source, /mergeAppData\(source, remote\.data\)/);
  assert.match(source, /pushCloudData\(merged\)/);
});

test("cloud client keeps real routes and 500 MB asset contract", () => {
  const source = read("src/services/cloudSync.js");
  const worker = read("cloud-worker/worker.js");
  assert.match(source, /\/sync/);
  assert.match(source, /\/assets/);
  assert.doesNotMatch(source, /\/api\/sync/);
  assert.match(source, /MAX_ASSET_BYTES = 500 \* 1024 \* 1024/);
  assert.match(worker, /MAX_ASSET_BYTES = 500 \* 1024 \* 1024/);
});

test("student portal remains portable to a fresh phone", () => {
  assert.ok(fs.existsSync("tests/student-portal-sync.test.mjs"));
  const worker = read("cloud-worker/worker.js");
  assert.match(worker, /student-session:/);
  assert.match(worker, /studentPinHash/);
  assert.match(worker, /studentPinSalt/);
});

test("live class captures server TURN without mutating teacher or student components", () => {
  const live = read("src/services/liveClass.js");
  const teacher = read("src/components/live/TeacherLivePanel.jsx");
  const student = read("src/components/live/StudentLiveRoom.jsx");
  const worker = read("cloud-worker/worker.js");

  assert.match(live, /MOBDEA_RUNTIME_ICE/);
  assert.match(live, /rememberLiveIceServers\(created\)/);
  assert.match(live, /rememberLiveIceServers\(joined\)/);
  assert.match(live, /defaultIceServers\(configLike = \{\}\)/);
  assert.match(live, /\^\(stun\|turn\|turns\):/);
  assert.match(live, /stun:stun\.l\.google\.com:19302/);
  assert.match(teacher, /defaultIceServers\(\)/);
  assert.match(student, /defaultIceServers\(\)/);
  assert.match(worker, /MOBDEA_TURN_URLS/);
  assert.match(worker, /MOBDEA_TURN_USERNAME/);
  assert.match(worker, /MOBDEA_TURN_CREDENTIAL/);
  assert.ok(
    (worker.match(/iceServers: buildLiveIceServers\(env\)/g) || []).length >= 2,
  );
});

test("selected student controls are exactly praise warning and one plus", () => {
  const source = read("src/pages/ClassMode.jsx");
  assert.equal(
    (source.match(/data-testid="selected-student-praise"/g) || []).length,
    1,
  );
  assert.equal(
    (source.match(/data-testid="selected-student-warning"/g) || []).length,
    1,
  );
  assert.equal(
    (source.match(/data-testid="selected-student-point-plus"/g) || []).length,
    1,
  );
  assert.doesNotMatch(source, /student-point-minus/);
  assert.doesNotMatch(source, /<span>تشجيع<\/span>/);
  assert.doesNotMatch(source, /<span>تنبيه<\/span>/);
});

test("spoken phrase includes the selected student name", () => {
  const source = read("src/pages/ClassMode.jsx");
  assert.match(source, /يا \$\{selectedStudent\.name\}/);
  assert.match(source, /speakArabic\(text, data\.settings, tone\)/);
});

test("lesson recordings are persisted into app data", () => {
  const source = read("src/pages/ClassMode.jsx");
  assert.match(source, /lessonRecordings/);
  assert.match(source, /allRecordings/);
});

test("tablet roster is fixed right and mobile landscape remains drawer based", () => {
  const css = read("src/styles/r18-classmode-viewport-fix.css");
  assert.match(css, /min-width:\s*961px/);
  assert.match(
    css,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*clamp\(168px,\s*19vw,\s*230px\)/,
  );
  assert.match(css, /classmode-viewport-students/);
});

test("historical board artwork uses contain rather than stretch", () => {
  const css = read("src/styles/r19-master-repairs.css");
  const marker = css.slice(css.lastIndexOf("MOBDEA_R19_FINAL"));
  assert.match(marker, /classmode-board-reference-image/);
  assert.match(marker, /object-fit:\s*contain\s*!important/);
});

test("R19 final release identity is consistent everywhere", () => {
  const pkg = JSON.parse(read("package.json"));
  const gradle = read("android/app/build.gradle");
  const version = read("src/config/version.js");
  const release = read("src/config/release.js");
  assert.equal(pkg.version, "10.14.0");
  assert.equal(Number(pkg.mobdea?.versionCode), 117);
  assert.match(gradle, /versionCode\s+117/);
  assert.match(gradle, /versionName\s+"10\.14\.0"/);
  assert.match(version, /APP_VERSION = '10\.14\.0'/);
  assert.match(version, /APP_VERSION_CODE = 117/);
  const syncVersion = read("scripts/sync-version.mjs");
  assert.match(version, /RELEASE_TAG = 'R19'/);
  assert.match(syncVersion, /RELEASE_TAG = 'R19'/);
  assert.doesNotMatch(syncVersion, /RELEASE_TAG = 'R18'/);
  assert.match(release, /releaseTag:\s*RELEASE_TAG/);
});
