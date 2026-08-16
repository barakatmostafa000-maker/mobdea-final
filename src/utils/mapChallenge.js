export function shuffleMapItems(items, random = Math.random) {
  const result = [...(items || [])];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function calculateMapReward({ seconds = 0, multiplier = 1, streak = 0 } = {}) {
  return Math.max(25, Math.round((100 + Math.max(0, seconds) * 2 + Math.max(0, streak) * 15) * multiplier));
}

export function normalizeMapAnswer(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}
