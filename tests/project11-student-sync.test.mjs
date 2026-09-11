import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { drawRandomStudents } from '../src/services/project11StudentSelection.js';
import {
  buildProject11ClassState,
  compactBoardActions,
  project11ClassFingerprint,
  shouldApplyProject11State,
} from '../src/services/project11ClassSync.js';
import { mergeAppData } from '../src/services/dataMerge.js';

const students = [
  { id: 'a', name: 'أحمد' },
  { id: 'b', name: 'بسملة' },
  { id: 'c', name: 'سليم' },
  { id: 'd', name: 'نور' },
];

test('single random draw does not repeat before the class cycle is exhausted', () => {
  let used = [];
  const picked = [];
  for (let index = 0; index < students.length; index += 1) {
    const result = drawRandomStudents(students, 1, used, () => 0);
    assert.equal(result.selected.length, 1);
    picked.push(result.selected[0].id);
    used = result.usedIds;
  }
  assert.equal(new Set(picked).size, students.length);

  const nextCycle = drawRandomStudents(students, 1, used, () => 0);
  assert.equal(nextCycle.selected.length, 1);
  assert.equal(nextCycle.cycleReset, true);
});

test('multi random draw never duplicates a student inside the same result', () => {
  const result = drawRandomStudents(students, 3, [], () => .37);
  assert.equal(result.selected.length, 3);
  assert.equal(new Set(result.selected.map((student) => student.id)).size, 3);
});

test('class sync compacts board state and rejects same-device/stale session state', () => {
  const manyPoints = Array.from({ length: 1200 }, (_, index) => ({ x: index, y: index * 2 }));
  const compacted = compactBoardActions([{ id: 1, kind: 'stroke', points: manyPoints }]);
  assert.ok(compacted[0].points.length <= 650);

  const state = buildProject11ClassState({
    sessionId: 'session-1',
    contentMode: 'pdf',
    page: 7,
    boardActions: compacted,
    points: { a: 4, b: 2 },
  }, 'device-a');
  assert.equal(state.page, 7);
  assert.equal(state.contentMode, 'pdf');
  assert.ok(project11ClassFingerprint(state).includes('session-1'));
  assert.equal(shouldApplyProject11State(state, { deviceId: 'device-a', sessionId: 'session-1' }), false);
  assert.equal(shouldApplyProject11State(state, { deviceId: 'device-b', sessionId: 'session-other' }), false);
  assert.equal(shouldApplyProject11State(state, { deviceId: 'device-b', sessionId: 'session-1' }), true);
});

test('cloud merge preserves point-history records and chooses newest live class state', () => {
  const local = {
    classPointSessions: [{ id: 's2', updatedAt: '2026-08-22T10:02:00Z', points: { a: 4 } }],
    classLiveSync: { id: 'live', kind: 'mobdea-class-sync-v1', updatedAt: '2026-08-22T10:03:00Z', page: 5 },
  };
  const remote = {
    classPointSessions: [{ id: 's1', updatedAt: '2026-08-22T09:00:00Z', points: { a: 2 } }],
    classLiveSync: { id: 'live', kind: 'mobdea-class-sync-v1', updatedAt: '2026-08-22T10:04:00Z', page: 6 },
  };
  const merged = mergeAppData(local, remote);
  assert.equal(merged.classPointSessions.length, 2);
  assert.equal(merged.classLiveSync.page, 6);
});

test('student panels expose a real most-improved sort and random picker', () => {
  const component = fs.readFileSync(new URL('../src/components/classmode/Project03StudentPanels.jsx', import.meta.url), 'utf8');
  const classMode = fs.readFileSync(new URL('../src/pages/ClassMode.jsx', import.meta.url), 'utf8');
  assert.match(component, /value="improved">الأكثر تحسنًا/);
  assert.match(component, /studentProgress\?\.\[a\.id\]\?\.delta/);
  assert.match(component, /bDelta - aDelta/);
  assert.match(component, /data-testid="student-random-picker"/);
  assert.match(component, /random-one-student/);
  assert.match(component, /random-many-students/);
  assert.match(classMode, /studentProgress=\{studentProgress\}/);
  assert.match(classMode, /Project11ClassSyncBridge/);
  assert.match(classMode, /classPointSessions/);
  assert.match(classMode, /points:\s*Object\.fromEntries/);
});

test('App uses fast cross-device polling while teaching and reconnect triggers', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const dataMerge = fs.readFileSync(new URL('../src/services/dataMerge.js', import.meta.url), 'utf8');
  assert.match(app, /PROJECT11_FAST_CLASS_SYNC_V1/);
  assert.match(app, /\['classMode',\s*'onlineClass',\s*'whiteboard'\]/);
  assert.match(app, /fastClassSync\s*\?\s*5000/);
  assert.match(app, /addEventListener\?\.\('focus',\s*runAutoSync\)/);
  assert.match(dataMerge, /'classPointSessions'/);
  assert.match(dataMerge, /merged\.classLiveSync\s*=\s*richerRecord/);
});
