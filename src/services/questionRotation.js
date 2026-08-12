const normalize = (value = '') => String(value || '')
  .normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase();

export function questionFingerprint(question = {}) {
  return normalize(question.fingerprint || question.text || question.question || question.id || '');
}

export function questionPriority(question = {}) {
  const origin = String(question.questionOrigin || '').toLowerCase();
  const kind = String(question.sourceKind || '').toLowerCase();
  const source = String(question.source || '').toLowerCase();
  if (origin === 'official-textbook' || kind === 'textbook') return 0;
  if (origin === 'official-exams' || kind === 'exams') return 1;
  if (source === 'manual' || source === 'custom') return 2;
  return 3;
}

export function dedupeQuestions(items = []) {
  const unique = new Map();
  for (const question of Array.isArray(items) ? items : []) {
    if (!question?.id && !question?.text) continue;
    const key = questionFingerprint(question) || String(question.id || '');
    if (!key) continue;
    const current = unique.get(key);
    if (!current || questionPriority(question) < questionPriority(current)) unique.set(key, question);
  }
  return [...unique.values()];
}

function shuffled(items, random = Math.random) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export function selectQuestionRound(items = [], history = [], count = 10, random = Math.random) {
  const unique = dedupeQuestions(items);
  const preferred = unique.filter((question) => questionPriority(question) < 3);
  // Generated questions are a fallback only. Never mix them into a round while
  // reviewed textbook/exam questions or teacher-authored questions exist.
  const eligible = preferred.length ? preferred : unique;
  const used = new Set((Array.isArray(history) ? history : []).map(String));
  const unseen = eligible.filter((question) => !used.has(String(question.id)));
  const source = unseen.length ? unseen : eligible;
  const tiers = [0, 1, 2, 3].flatMap((priority) => shuffled(
    source.filter((question) => questionPriority(question) === priority),
    random,
  ));
  return tiers.slice(0, Math.max(1, Number(count || 1)));
}

export function appendQuestionHistory(history = [], questionIds = [], maxItems = 500) {
  const incoming = (Array.isArray(questionIds) ? questionIds : [questionIds]).map(String).filter(Boolean);
  const incomingSet = new Set(incoming);
  return [
    ...(Array.isArray(history) ? history : []).map(String).filter((id) => !incomingSet.has(id)),
    ...incoming,
  ].slice(-Math.max(30, Number(maxItems || 500)));
}
