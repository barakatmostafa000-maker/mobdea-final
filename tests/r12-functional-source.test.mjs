import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('class mode contains the verified media, map, board, point and in-class game paths', async () => {
  const text = await source('src/pages/ClassMode.jsx');
  assert.match(text, /useAssetSource\(selectedResource\?\.assetId/);
  assert.match(text, /<MediaRenderer/);
  const renderer = await source('src/components/classmode/MediaRenderer.jsx');
  assert.match(renderer, /<PptxPreview/);
  assert.match(text, /<LessonMapStudio/);
  assert.match(text, /contentMode === 'games'/);
  assert.match(text, /<ClassroomGamePanel/);
  assert.match(text, /<OnlineGameHostPanel/);
  assert.match(text, /switchContentMode\('audio'\)/);
  assert.match(text, /title="إضافة نقطة واحدة"/);
  assert.match(text, /visibleToStudents:\s*true/);
  assert.match(text, /studentIds:\s*students\.map/);
  assert.match(text, /setTextStyle\('plain'\)/);
  assert.match(text, /setTool\('select'\)/);
});

test('sidebar logout is part of the scrollable navigation and student cloud routes exist', async () => {
  const shell = await source('src/components/AppShell.jsx');
  const navStart = shell.indexOf('<nav');
  const logout = shell.indexOf('sidebar-logout-nav');
  const navEnd = shell.indexOf('</nav>', navStart);
  assert.ok(navStart >= 0 && logout > navStart && logout < navEnd);

  const worker = await source('cloud-worker/worker.js');
  assert.match(worker, /\/student\/login/);
  assert.match(worker, /\/student\/snapshot/);
  assert.match(worker, /studentAssetMatch/);
  assert.match(worker, /\/live\/rooms/);
  assert.match(worker, /\/game\/rooms/);
});

test('native Android renderers and recorder are registered and the one-step live-link action is present', async () => {
  const mainActivity = await source('android/app/src/main/java/com/mobdea/education/MainActivity.java');
  assert.match(mainActivity, /registerPlugin\(MobdeaPdfRendererPlugin\.class\)/);
  assert.match(mainActivity, /registerPlugin\(MobdeaPptxRendererPlugin\.class\)/);
  assert.match(mainActivity, /registerPlugin\(MobdeaScreenRecorderPlugin\.class\)/);

  const live = await source('src/components/live/TeacherLivePanel.jsx');
  assert.match(live, /testCloudConnection\(candidate\)/);
  assert.match(live, /startRoom\(\{ copyAfterCreate: true, configOverride: candidate, throwOnError: true, skipHealthCheck: true \}\)/);
  assert.match(live, /تحقق وأنشئ الرابط/);
  assert.match(live, /shareRoomLink/);

  const onlineGame = await source('src/components/live/OnlineGameHostPanel.jsx');
  assert.match(onlineGame, /shareGameLink/);

  const styles = await source('src/styles/v107.css');
  assert.match(styles, /student-point-btn:not\(\.student-point-minus\)/);
  assert.match(styles, /classmode-board-lesson-ribbon/);
  assert.match(styles, /classmode-map-embed/);
});

test('live classroom combines teacher media tracks and recording persistence is atomic', async () => {
  const studentLive = await source('src/components/live/StudentLiveRoom.jsx');
  const teacherLive = await source('src/components/live/TeacherLivePanel.jsx');
  const classMode = await source('src/pages/ClassMode.jsx');
  const recordingService = await source('src/services/screenRecording.js');
  const recordingPlugin = await source('android/app/src/main/java/com/mobdea/education/recording/MobdeaScreenRecorderPlugin.java');

  assert.match(studentLive, /remoteMediaStreamRef/);
  assert.match(studentLive, /combined\.addTrack\(event\.track\)/);
  assert.match(studentLive, /type: 'participant-left'/);
  assert.match(studentLive, /reconnect: true/);
  assert.match(teacherLive, /sender\.track\?\.id === track\.id/);
  assert.match(teacherLive, /screenStreamRef\.current \|\| teacherMicStreamRef\.current/);
  assert.match(classMode, /await updateData\(\(latest\) => \{/);
  assert.match(classMode, /releaseNativeScreenRecording\(nativePath\)/);
  assert.match(recordingService, /NativeScreenRecorder\.release/);
  assert.match(recordingService, /export async function readNativeScreenRecording/);
  assert.match(recordingPlugin, /public void release\(PluginCall call\)/);
  assert.match(classMode, /pendingNativeRecordingRef/);
  assert.match(classMode, /إعادة حفظ الفيديو/);
  assert.match(classMode, /readNativeScreenRecording\(pending\)/);
});

test('student portal exposes synchronization state and recording playback from cloud assets', async () => {
  const portal = await source('src/pages/PortalPreview.jsx');
  const recording = await source('src/components/classmode/LessonRecordingItem.jsx');
  const storage = await source('src/services/storage.js');
  assert.match(portal, /portal-sync-status/);
  assert.match(portal, /lastPullAt/);
  assert.match(portal, /lastError/);
  assert.match(portal, /تسجيلات الحصص/);
  assert.match(recording, /useAssetSource\(recording\.videoAssetId/);
  assert.match(storage, /normalizeMultilineText/);
  assert.match(storage, /questionPageStart/);
  assert.match(storage, /studentPortalSession\?\.lastError/);
});
