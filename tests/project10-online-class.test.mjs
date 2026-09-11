import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
const classMode = fs.readFileSync(new URL('../src/pages/ClassMode.jsx', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../src/components/live/TeacherLivePanel.jsx', import.meta.url), 'utf8');
const student = fs.readFileSync(new URL('../src/components/live/StudentLiveRoom.jsx', import.meta.url), 'utf8');
const live = fs.readFileSync(new URL('../src/services/liveClass.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../cloud-worker/worker.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/project10-online-class.css', import.meta.url), 'utf8');

test('online class is discoverable from the platform and class mode', () => {
  assert.match(shell, /\['onlineClass',\s*'الحصة الأونلاين'/);
  assert.match(shell, /active === 'onlineClass'/);
  assert.match(dashboard, /id:\s*'onlineClass'/);
  assert.match(dashboard, /title:\s*'الحصة الأونلاين'/);
  assert.match(app, /onlineClass:\s*\{[\s\S]*onlineEntry:\s*true/);
  assert.match(app, /onlineClass:\s*ClassMode/);
  assert.match(classMode, /project10-online-class-entry/);
  assert.match(classMode, /data-testid="online-class-entry"/);
  assert.match(classMode, /classmode-online-entry/);
});

test('online route opens the live panel directly', () => {
  assert.match(classMode, /onlineEntry\s*=\s*false/);
  assert.match(classMode, /onlineEntryHandledRef/);
  assert.match(classMode, /setManagementOpen\(true\)/);
  assert.match(classMode, /setLiveStartRequest\(Date\.now\(\)\)/);
  assert.match(classMode, /openOnlineClassPanel/);
});

test('board and point mutations always advance online synchronization revisions', () => {
  assert.match(classMode, /boardSyncRevision/);
  assert.match(classMode, /pointsSyncRevision/);
  assert.match(classMode, /\[boardActions\]/);
  assert.match(classMode, /\[points\]/);
  assert.match(classMode, /boardRevision:\s*boardSyncRevision/);
  assert.match(classMode, /pointsRevision:\s*pointsSyncRevision/);
});

test('teacher and student reconnect on disconnected WebRTC peers', () => {
  assert.match(teacher, /\['failed',\s*'disconnected',\s*'closed'\]/);
  assert.match(student, /\['failed',\s*'disconnected'\]/);
  assert.match(student, /student-ready/);
  assert.match(teacher, /approveMic/);
  assert.match(teacher, /startTeacherAudio/);
  assert.match(teacher, /startScreenShare/);
});

test('existing live room backend and student join contracts remain', () => {
  assert.match(live, /createLiveRoom/);
  assert.match(live, /joinLiveRoom/);
  assert.match(live, /defaultIceServers/);
  assert.match(worker, /\/live\/rooms/);
  assert.match(main, /project10-online-class\.css/);
  assert.match(css, /PROJECT10_ONLINE_CLASS_V1/);
});
