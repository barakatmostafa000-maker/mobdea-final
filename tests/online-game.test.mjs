import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOnlineQuestions,
  publicOnlineQuestion,
  scoreOnlineAnswer,
  sortedOnlineScoreboard,
} from '../src/services/onlineGame.js';

test('online game normalizes safe multiple-choice questions', () => {
  const result = normalizeOnlineQuestions([
    { id: 'q1', text: 'ما العاصمة؟', options: ['القاهرة', 'الإسكندرية'], answerIndex: 0, answer: 'القاهرة' },
    { id: 'bad', text: 'غير صالح', options: ['واحد'], answerIndex: 0 },
    { id: 'q1', text: 'مكرر', options: ['أ', 'ب'], answerIndex: 1 },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'q1');
  assert.equal(result[0].answerIndex, 0);
});

test('public online question never exposes the answer', () => {
  const [question] = normalizeOnlineQuestions([
    { id: 'q1', text: 'سؤال', options: ['صح', 'خطأ'], answerIndex: 1, answer: 'خطأ' },
  ]);
  const shared = publicOnlineQuestion(question, 0, 1, 25);
  assert.equal('answerIndex' in shared, false);
  assert.equal('answer' in shared, false);
  assert.deepEqual(shared.options, ['صح', 'خطأ']);
});

test('online scoring rewards correct and faster answers', () => {
  const question = { answerIndex: 1 };
  const fast = scoreOnlineAnswer(question, 1, 1000, 25);
  const slow = scoreOnlineAnswer(question, 1, 24000, 25);
  const wrong = scoreOnlineAnswer(question, 0, 1000, 25);
  assert.equal(fast.correct, true);
  assert.ok(fast.points > slow.points);
  assert.deepEqual(wrong, { correct: false, points: 0 });
});

test('scoreboard is sorted by score then Arabic name', () => {
  const board = sortedOnlineScoreboard([
    { id: 'a', name: 'محمد' },
    { id: 'b', name: 'أحمد' },
  ], { a: 100, b: 200 });
  assert.equal(board[0].id, 'b');
  assert.equal(board[1].score, 100);
});
