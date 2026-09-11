import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Fix7 visual and interaction repairs are still loaded", () => {
  const main = read("src/main.jsx");
  assert.match(main, /r19-user-fix7\.css/);
  assert.match(main, /r19InteractionFixes\.js/);
  const css = read("src/styles/r19-user-fix7.css");
  assert.match(css, /classmode-board-sidebar-left/);
  assert.match(css, /r19-students-left-panel/);
  assert.match(css, /duplex-back-page/);
  assert.match(css, /map-pro-reference-grid/);
});

test("all user-reported Fix7 device repairs remain present after Fix8", () => {
  const classMode = read("src/pages/ClassMode.jsx");
  const runtime = read("src/services/r19InteractionFixes.js");
  const cards = read("src/pages/StudentCards.jsx");
  const library = read("src/pages/ContentLibrary.jsx");
  const mapChallenge = read("src/pages/MapChallenge.jsx");
  const ocr = read(
    "android/app/src/main/java/com/mobdea/education/ocr/MobdeaPdfOcrPlugin.java",
  );
  const css = read("src/styles/r19-user-fix7.css");

  assert.match(css, /board-card-field-text/);
  assert.match(css, /country-card-field-text/);
  assert.match(css, /dashboard-reference-hero/);
  assert.match(css, /map-pro-coordinate-focus/);
  assert.match(css, /class-board-canvas-shell\.has-resource-head\.tool-move/);
  assert.match(runtime, /r19-students-toggle-mirror/);
  assert.match(runtime, /r19-students-left-panel/);
  assert.match(runtime, /r19-quick-board-save/);
  assert.match(runtime, /localeCompare/);
  assert.match(runtime, /['"]ar['"]/);
  assert.match(classMode, /student-row-phrase-btn positive/);
  assert.match(classMode, /student-row-phrase-btn corrective/);
  assert.match(classMode, /highlighter/);
  assert.match(cards, /DuplexPrintRun/);
  assert.match(cards, /window\.setTimeout\(finish, 60000\)/);
  assert.match(library, /approved: Boolean\(String\(item\.answer/);
  assert.match(mapChallenge, /setSilentMap/);
  assert.match(ocr, /Bitmap\.Config\.ARGB_8888/);
  assert.doesNotMatch(ocr, /Bitmap\.Config\.RGB_565/);
});

test("native Class Mode has stale-worker and lazy-chunk black-screen recovery", () => {
  const pwa = read("src/services/pwaUpdate.js");
  assert.match(pwa, /cleanupNativeServiceWorkerState/);
  assert.match(pwa, /getRegistrations\(\)/);
  assert.match(pwa, /caches\.keys\(\)/);
  assert.match(pwa, /mobdea_native_sw_cleanup_reload_v2/);
  const app = read("src/App.jsx");
  assert.match(app, /lazyWithNativeRecovery/);
  assert.match(app, /lazyWithNativeRecovery\(\s*[\"']class-mode[\"']/);
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /android:hardwareAccelerated="true"/);
  assert.match(manifest, /android:largeHeap="true"/);
});

test("PDF rendering is bounded while teacher zoom stays at 6x", () => {
  const pdf = read("src/components/classmode/PdfCanvasPreview.jsx");
  assert.match(pdf, /MAX_RASTER_PIXELS = 8_500_000/);
  assert.match(pdf, /MAX_RASTER_SIDE = 3840/);
  assert.match(pdf, /rasterLimiter/);
  assert.match(pdf, /maxZoom=\{6\}/);
  assert.doesNotMatch(pdf, /deviceRatio \* Math\.max\(1, Number\(zoom/);
  const hook = read("src/hooks/usePdfPage.js");
  assert.match(hook, /usePdfPage\(source,\s*page\s*=\s*1,\s*maxWidth\s*=\s*1600\)/);assert.match(hook, /renderNativePdfBlob\(blob,\s*page,\s*maxWidth,\s*cacheKey\)/);
});

test("cloud sync client and worker agree on 200MB and automatic sync triggers remain", () => {
  const cloud = read("src/services/cloudSync.js");
  const worker = read("cloud-worker/worker.js");
  const app = read("src/App.jsx");
  assert.match(cloud, /MAX_ASSET_BYTES = 200 \* 1024 \* 1024/);
  assert.match(worker, /MAX_ASSET_BYTES = 200 \* 1024 \* 1024/);
  assert.doesNotMatch(
    worker,
    /MAX_ASSET_BYTES = (?:300|400|500) \* 1024 \* 1024/,
  );
  assert.match(cloud, /\/assets\/status/);
  assert.match(cloud, /If-Match/);
  assert.match(app, /autoSyncRunningRef/);
  assert.match(app, /pullCloudDataIfExists/);
  assert.match(app, /localChangedAt/);
  assert.match(app, /addEventListener\?\.\([\"']online[\"'],\s*runAutoSync\)/);
  const verifier = read("scripts/verify-project.mjs");
  assert.match(verifier, /APP_VERSION = "\$\{pkg\.version\}"/);
});

test("online lesson route, health check, WebRTC signaling and public student link are wired", () => {
  const teacher = read("src/components/live/TeacherLivePanel.jsx");
  const live = read("src/services/liveClass.js");
  const worker = read("cloud-worker/worker.js");
  const publicUrl = read("src/services/publicAppUrl.js");
  assert.match(teacher, /testCloudConnection/);
  assert.match(teacher, /createLiveRoom/);
  assert.match(teacher, /RTCPeerConnection/);
  assert.match(live, /createLiveRoom/);
  assert.match(live, /joinLiveRoom/);
  assert.match(teacher, /webrtc-offer/);
  assert.match(teacher, /webrtc-answer/);
  assert.match(teacher, /webrtc-ice/);
  assert.match(worker, /webrtc-offer/);
  assert.match(worker, /webrtc-answer/);
  assert.match(worker, /webrtc-ice/);
  assert.match(worker, /handleCreateLiveRoom/);
  assert.match(worker, /handleLiveEvents/);
  assert.match(worker, /handleLiveParticipants/);
  assert.match(publicUrl, /mobdea-live-barakatmostafa000\.pages\.dev/);
});

test("Fix8 version is a real Android upgrade", () => {
  const pkg = JSON.parse(read("package.json"));
  const version = read("src/config/version.js");
  assert.equal(pkg.version, "10.14.1");
  assert.equal(Number(pkg.mobdea.versionCode), 118);
  assert.match(version, /APP_VERSION = "10\.14\.1"/);
  assert.match(version, /APP_VERSION_CODE = 118/);
  assert.match(read("src/config/r19Fix8.js"), /R19_FIX8/);
});
