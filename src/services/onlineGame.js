import { safeTrim } from '../utils/safety.js';

const MAX_ONLINE_QUESTIONS = 20;
const MAX_OPTIONS = 6;

export function normalizeOnlineQuestions(questions = [], limit = 10) {
  const safeLimit = Math.max(1, Math.min(MAX_ONLINE_QUESTIONS, Number(limit || 10)));
  const seen = new Set();
  const normalized = [];

  for (const question of Array.isArray(questions) ? questions : []) {
    if (!question || typeof question !== 'object') continue;
    const options = (Array.isArray(question.options) ? question.options : [])
      .slice(0, MAX_OPTIONS)
      .map((option) => safeTrim(option, 180))
      .filter(Boolean);
    const answerIndex = Number(question.answerIndex);
    const text = safeTrim(question.text, 600);
    if (!text || options.length < 2 || !Number.isInteger(answerIndex)) continue;
    if (answerIndex < 0 || answerIndex >= options.length) continue;

    const id = safeTrim(question.id || `online-${normalized.length + 1}`, 100);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      text,
      options,
      answerIndex,
      answer: safeTrim(question.answer || options[answerIndex], 180),
      unit: safeTrim(question.unit, 120),
      lesson: safeTrim(question.lesson, 160),
      topic: safeTrim(question.topic, 160),
      difficulty: safeTrim(question.difficulty || 'متوسط', 40),
    });
    if (normalized.length >= safeLimit) break;
  }

  return normalized;
}

export function onlineQuestionTiming(durationSec = 25, startedAtMs = Date.now()) {
  const safeDuration = Math.max(5, Math.min(120, Number(durationSec || 25)));
  const safeStart = Number.isFinite(Number(startedAtMs)) ? Number(startedAtMs) : Date.now();
  return {
    durationSec: safeDuration,
    startedAt: new Date(safeStart).toISOString(),
    endsAt: new Date(safeStart + safeDuration * 1000).toISOString(),
  };
}

export function onlineQuestionSecondsLeft(question = {}, nowMs = Date.now()) {
  const deadline = Date.parse(question.endsAt || '');
  if (!Number.isFinite(deadline)) {
    return Math.max(0, Math.ceil(Number(question.durationSec || 0)));
  }
  return Math.max(0, Math.ceil((deadline - Number(nowMs || Date.now())) / 1000));
}

export function publicOnlineQuestion(question, index, total, durationSec = 25, timing = null) {
  if (!question) return null;
  const synchronizedTiming = timing?.endsAt
    ? {
        durationSec: Math.max(5, Math.min(120, Number(timing.durationSec || durationSec || 25))),
        startedAt: new Date(timing.startedAt || Date.now()).toISOString(),
        endsAt: new Date(timing.endsAt).toISOString(),
      }
    : onlineQuestionTiming(durationSec);
  return {
    id: question.id,
    text: question.text,
    options: [...question.options],
    unit: question.unit,
    lesson: question.lesson,
    topic: question.topic,
    difficulty: question.difficulty,
    index: Number(index || 0),
    total: Number(total || 0),
    ...synchronizedTiming,
  };
}

export function scoreOnlineAnswer(question, choiceIndex, elapsedMs = 0, durationSec = 25) {
  if (!question) return { correct: false, points: 0 };
  const correct = Number(choiceIndex) === Number(question.answerIndex);
  if (!correct) return { correct: false, points: 0 };
  const durationMs = Math.max(5000, Number(durationSec || 25) * 1000);
  const elapsed = Math.max(0, Math.min(durationMs, Number(elapsedMs || 0)));
  const speedBonus = Math.round(50 * (1 - elapsed / durationMs));
  return { correct: true, points: 100 + Math.max(0, speedBonus) };
}

export function sortedOnlineScoreboard(participants = [], scores = {}) {
  return (Array.isArray(participants) ? participants : [])
    .map((participant) => ({
      id: participant.id,
      name: participant.name || 'طالب',
      studentCode: participant.studentCode || '',
      score: Math.max(0, Number(scores[participant.id] || 0)),
      status: participant.status || 'online',
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'ar'));
}
