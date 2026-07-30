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
