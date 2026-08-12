import test from 'node:test';
import assert from 'node:assert/strict';
import { rankStudentsByPoints } from '../src/services/studentRanking.js';

test('students rank immediately by live points from highest to lowest', () => {
  const students = [
    { id: 1, name: 'محمد', points: 15 },
    { id: 2, name: 'أحمد', points: 12 },
    { id: 3, name: 'سارة', points: 9 },
    { id: 4, name: 'علي', points: 3 },
  ];
  assert.deepEqual(rankStudentsByPoints(students, { 4: 20 }).map((student) => student.name), ['علي', 'محمد', 'أحمد', 'سارة']);
});

test('equal scores keep the previous roster order and never jump randomly', () => {
  const students = [{ id: 'b', name: 'ب' }, { id: 'a', name: 'أ' }, { id: 'c', name: 'ج' }];
  assert.deepEqual(rankStudentsByPoints(students, { a: 10, b: 10, c: 10 }).map((student) => student.id), ['b', 'a', 'c']);
});
