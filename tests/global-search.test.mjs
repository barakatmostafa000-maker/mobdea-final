import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGlobalSearchIndex,
  normalizeSearchText,
  searchGlobalIndex,
} from '../src/services/globalSearch.js';

test('Arabic search normalization handles common letter variants', () => {
  assert.equal(normalizeSearchText('إِبْرَاهِيم'), 'ابراهيم');
  assert.equal(normalizeSearchText('مدرسة'), 'مدرسه');
});

test('global search finds lessons and students', () => {
  const data = {
    students: [{ id: 1, name: 'أحمد محمد', code: '25', grade: 'الصف السادس', group: 'أ' }],
    contentLibrary: [{ id: 9, title: 'كتاب الدراسات', lesson: 'الحملة الفرنسية', grade: 'الصف السادس', unit: 'الوحدة الأولى', type: 'pdf' }],
  };
  const index = buildGlobalSearchIndex(data, { role: 'teacher' });
  assert.equal(searchGlobalIndex(index, 'احمد')[0].page, 'students');
  assert.equal(searchGlobalIndex(index, 'الحمله الفرنسيه')[0].page, 'contentLibrary');
});

test('student search scope does not expose other students or payments', () => {
  const data = {
    students: [
      { id: 1, name: 'أحمد محمد', code: '25' },
      { id: 2, name: 'محمود علي', code: '26' },
    ],
    payments: [{ id: 1, studentId: 2, amount: 500, type: 'due' }],
  };
  const index = buildGlobalSearchIndex(data, { role: 'student', studentId: 1 });
  assert.equal(index.some((item) => item.title === 'محمود علي'), false);
  assert.equal(index.some((item) => item.type === 'payment'), false);
});
