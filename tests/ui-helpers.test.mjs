import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMapReward, shuffleMapItems } from '../src/utils/mapChallenge.js';
import { currentAcademicYear, mirrorCardsForDuplex } from '../src/utils/printLayout.js';

test('shuffleMapItems does not mutate the source list and preserves all items', () => {
  const source = ['a', 'b', 'c', 'd'];
  const shuffled = shuffleMapItems(source, () => 0);
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
  assert.deepEqual([...shuffled].sort(), [...source].sort());
  assert.notStrictEqual(shuffled, source);
});

test('map reward grows with remaining time and streak', () => {
  assert.ok(calculateMapReward({ seconds: 25, multiplier: 1, streak: 2 }) > calculateMapReward({ seconds: 5, multiplier: 1, streak: 0 }));
  assert.equal(calculateMapReward({ seconds: 0, multiplier: 0.1, streak: 0 }), 25);
});

test('duplex long-edge layout reverses every printed row', () => {
  assert.deepEqual(mirrorCardsForDuplex([1, 2, 3, 4, 5, 6], 3, 'flip-long-edge'), [3, 2, 1, 6, 5, 4]);
});

test('duplex short-edge layout reverses rows and columns', () => {
  assert.deepEqual(mirrorCardsForDuplex([1, 2, 3, 4, 5, 6], 3, 'flip-short-edge'), [6, 5, 4, 3, 2, 1]);
});

test('academic year changes in July', () => {
  assert.equal(currentAcademicYear(new Date('2026-06-30T12:00:00Z')), '2025 - 2026');
  assert.equal(currentAcademicYear(new Date('2026-07-01T12:00:00Z')), '2026 - 2027');
});
