// PROJECT11_RANDOM_STUDENT_SELECTION_V1

function studentKey(student, index = 0) {
  const id = student?.id ?? student?.code ?? '';
  return String(id || `index-${index}`);
}

function clampCount(value, max) {
  const number = Math.floor(Number(value || 1));
  return Math.max(1, Math.min(Math.max(1, max), Number.isFinite(number) ? number : 1));
}

export function shuffleStudents(students = [], rng = Math.random) {
  const items = students.slice();
  for (let index = items.length - 1; index > 0; index -= 1) {
    const raw = Number(rng?.() ?? Math.random());
    const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(.999999999, raw)) : .5;
    const swapIndex = Math.floor(normalized * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

/**
 * Draw one or more students without repeating a student until every student
 * in the current class group has been drawn once.
 *
 * If a multi-draw crosses the end of a cycle, all still-unused students are
 * taken first, then a new cycle begins. A student is never duplicated inside
 * the same multi-draw result.
 */
export function drawRandomStudents(students = [], count = 1, usedIds = [], rng = Math.random) {
  const unique = [];
  const seen = new Set();
  students.forEach((student, index) => {
    const key = studentKey(student, index);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push({ ...student, __project11Key: key });
  });

  if (!unique.length) {
    return { selected: [], usedIds: [], cycleReset: false, remainingInCycle: 0 };
  }

  const target = clampCount(count, unique.length);
  const allKeys = new Set(unique.map((student) => student.__project11Key));
  const currentUsed = new Set(
    (Array.isArray(usedIds) ? usedIds : [...(usedIds || [])])
      .map(String)
      .filter((id) => allKeys.has(id)),
  );

  const remaining = unique.filter((student) => !currentUsed.has(student.__project11Key));
  const firstCyclePick = shuffleStudents(remaining, rng).slice(0, target);
  const selected = firstCyclePick.slice();
  let cycleReset = false;
  let nextUsed;

  if (selected.length >= target) {
    nextUsed = new Set(currentUsed);
    selected.forEach((student) => nextUsed.add(student.__project11Key));
  } else {
    // The current cycle is exhausted. Begin the new cycle only after every
    // remaining unused student has been included.
    cycleReset = true;
    const selectedKeys = new Set(selected.map((student) => student.__project11Key));
    const needed = target - selected.length;
    const newCyclePool = unique.filter((student) => !selectedKeys.has(student.__project11Key));
    const secondCyclePick = shuffleStudents(newCyclePool, rng).slice(0, needed);
    selected.push(...secondCyclePick);
    nextUsed = new Set(secondCyclePick.map((student) => student.__project11Key));
  }

  const cleaned = selected.map(({ __project11Key, ...student }) => student);
  return {
    selected: cleaned,
    usedIds: [...nextUsed],
    cycleReset,
    remainingInCycle: Math.max(0, unique.length - nextUsed.size),
  };
}
