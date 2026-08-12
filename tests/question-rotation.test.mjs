import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendQuestionHistory,
  dedupeQuestions,
  selectQuestionRound,
} from '../src/services/questionRotation.js';

test('question rotation prioritizes textbook questions and removes Arabic-normalized duplicates', () => {
  const questions = [
    { id: 'auto', text: 'ما عاصمة مصر؟', questionOrigin: 'lesson-content' },
    { id: 'exam', text: 'اذكر عاصمة مصر', questionOrigin: 'official-exams' },
    { id: 'book', text: 'ما عاصمة مِصر ؟', questionOrigin: 'official-textbook' },
    { id: 'book-duplicate', text: 'ما عاصمه مصر؟', questionOrigin: 'official-textbook' },
  ];
  const unique = dedupeQuestions(questions);
  assert.equal(unique.length, 2);
  const round = selectQuestionRound(questions, [], 3, () => 0.5);
  assert.equal(round[0].id, 'book');
  assert.equal(round[1].id, 'exam');
});

test('question rotation does not repeat used questions until the available bank is exhausted', () => {
  const questions = [
    { id: 'q1', text: 'السؤال الأول', questionOrigin: 'official-textbook' },
    { id: 'q2', text: 'السؤال الثاني', questionOrigin: 'official-textbook' },
    { id: 'q3', text: 'السؤال الثالث', questionOrigin: 'official-exams' },
  ];
  const first = selectQuestionRound(questions, [], 2, () => 0.5);
  const history = appendQuestionHistory([], first.map((item) => item.id));
  const second = selectQuestionRound(questions, history, 2, () => 0.5);
  assert.deepEqual(second.map((item) => item.id), ['q3']);
  const exhausted = appendQuestionHistory(history, ['q3']);
  assert.equal(selectQuestionRound(questions, exhausted, 2, () => 0.5).length, 2);
});
