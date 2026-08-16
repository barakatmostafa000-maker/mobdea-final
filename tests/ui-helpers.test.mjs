import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMapReward, normalizeMapAnswer, shuffleMapItems } from '../src/utils/mapChallenge.js';
import { buildDuplexPagePairs, currentAcademicYear, mirrorCardsForDuplex, nativeDuplexMode } from '../src/utils/printLayout.js';

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

test('map written answers normalize Arabic spelling and diacritics', () => {
  assert.equal(normalizeMapAnswer('  القَاهِرَة '), normalizeMapAnswer('القاهره'));
  assert.equal(normalizeMapAnswer('إفريقيا'), normalizeMapAnswer('افريقيا'));
});

test('automatic duplex keeps every card in the same logical slot', () => {
  assert.deepEqual(mirrorCardsForDuplex([1, 2, 3, 4, 5, null], 3, 'driver-long-edge'), [1, 2, 3, 4, 5, null]);
  assert.deepEqual(mirrorCardsForDuplex([1, 2, 3, 4, 5, null], 3, 'driver-short-edge'), [1, 2, 3, 4, 5, null]);
});

test('manual duplex mirrors across the selected physical sheet edge', () => {
  assert.deepEqual(mirrorCardsForDuplex([1, 2, 3, 4, 5, null], 3, 'manual-long-edge'), [4, 5, null, 1, 2, 3]);
  assert.deepEqual(mirrorCardsForDuplex([1, 2, 3, 4, 5, null], 3, 'manual-short-edge'), [3, 2, 1, null, 5, 4]);
});

test('only automatic duplex modes are sent to the Android print driver', () => {
  assert.equal(nativeDuplexMode('driver-long-edge'), 'driver-long-edge');
  assert.equal(nativeDuplexMode('driver-short-edge'), 'driver-short-edge');
  assert.equal(nativeDuplexMode('manual-long-edge'), 'none');
});

test('duplex print pages keep one front immediately paired with its matching back', () => {
  const pairs = buildDuplexPagePairs(['a', 'b', 'c', 'd', 'e'], 4);
  assert.deepEqual(pairs, [
    { sheetIndex: 0, students: ['a', 'b', 'c', 'd'] },
    { sheetIndex: 1, students: ['e'] },
  ]);
});

test('academic year changes in July', () => {
  assert.equal(currentAcademicYear(new Date('2026-06-30T12:00:00Z')), '2025 - 2026');
  assert.equal(currentAcademicYear(new Date('2026-07-01T12:00:00Z')), '2026 - 2027');
});
