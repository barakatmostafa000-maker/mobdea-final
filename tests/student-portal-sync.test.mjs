import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchStudentAsset, mergeStudentPortalSnapshot } from '../src/services/studentPortalCloud.js';

test('fresh student device merges synchronized identity, points, grades, attendance, dues and recordings', () => {
  const local = {
    students: [], attendance: [], grades: [], payments: [], achievements: [], gameResults: [], mapResults: [],
    contentLibrary: [], lessonRecordings: [], customQuestionBank: [], settings: { cloudSync: {} },
  };
  const payload = {
    student: { id: 7, code: 7007, name: 'مريم', grade: 'الصف السادس', points: 31 },
    studentToken: 'student-token', endpoint: 'https://sync.example.com', workspaceId: 'school_one',
    data: {
      attendance: [{ id: 'a7', studentId: 7, status: 'present' }],
      grades: [{ id: 'g7', studentId: 7, score: 19 }],
      payments: [{ id: 'p7', studentId: 7, amount: 100 }],
      achievements: [], gameResults: [], mapResults: [], customQuestionBank: [],
      contentLibrary: [{ id: 'book-7', grade: 'الصف السادس' }],
      lessonRecordings: [{ id: 'r7', studentIds: [7], videoAssetId: 'video-7' }],
      settings: { cloudSync: { publicAppUrl: 'https://students.example.com' } },
    },
  };

  const merged = mergeStudentPortalSnapshot(local, payload);
  assert.equal(merged.students[0].points, 31);
  assert.deepEqual(merged.attendance.map((item) => item.id), ['a7']);
  assert.deepEqual(merged.grades.map((item) => item.id), ['g7']);
  assert.deepEqual(merged.payments.map((item) => item.id), ['p7']);
  assert.deepEqual(merged.lessonRecordings.map((item) => item.id), ['r7']);
  assert.equal(merged.settings.studentPortalSession.studentToken, 'student-token');
  assert.ok(merged.settings.studentPortalSession.lastPullAt);
});

test('student cloud assets require matching exposed SHA-256 and size before local import', async () => {
  const bytes = new TextEncoder().encode('verified student recording');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'video/webm',
        'X-Mobdea-Asset-Sha256': sha256,
        'X-Mobdea-Asset-Size': String(bytes.byteLength),
        'X-Mobdea-Asset-Name': encodeURIComponent('حصة.webm'),
        'X-Mobdea-Asset-Kind': 'lesson-recording',
      },
    });
    const downloaded = await fetchStudentAsset({
      endpoint: 'https://sync.example.com', workspaceId: 'school_one', studentToken: 'x'.repeat(24),
    }, 'video-7');
    assert.equal(downloaded.metadata.sha256, sha256);
    assert.equal(downloaded.metadata.name, 'حصة.webm');

    globalThis.fetch = async () => new Response(bytes, {
      status: 200,
      headers: {
        'X-Mobdea-Asset-Sha256': '0'.repeat(64),
        'X-Mobdea-Asset-Size': String(bytes.byteLength),
      },
    });
    await assert.rejects(() => fetchStudentAsset({
      endpoint: 'https://sync.example.com', workspaceId: 'school_one', studentToken: 'x'.repeat(24),
    }, 'video-7'), /سلامة ملف الطالب/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
