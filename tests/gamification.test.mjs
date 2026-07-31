import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStudentGamification, rewardCatalogFor } from '../src/services/gamification.js';

test('gamification combines games, attendance, grades and achievements', () => {
  const student = { id: 1, code: 10, points: 50 };
  const data = {
    gameResults: [{ studentId: 1, xp: 100 }],
    grades: [{ studentId: 1, score: 9, total: 10 }, { studentId: 1, score: 8, total: 10 }],
    attendance: Array.from({ length: 5 }, (_, index) => ({ id: index, studentId: 1, status: 'present' })),
    achievements: [{ studentId: 1, key: 'star', title: 'نجم' }],
  };
  const result = calculateStudentGamification(data, student);
  assert.ok(result.xp >= 600);
  assert.ok(result.level >= 2);
  assert.equal(result.badges.some((item) => item.id === 'attendance-5'), true);
});

test('reward redemptions reduce spendable XP', () => {
  const student = { id: 1, points: 1000 };
  const result = calculateStudentGamification({ rewardRedemptions: [{ studentId: 1, cost: 400, status: 'pending' }] }, student);
  assert.equal(result.spendableXp, 600);
});

test('default reward catalog is available', () => {
  assert.ok(rewardCatalogFor({}).length >= 3);
});
