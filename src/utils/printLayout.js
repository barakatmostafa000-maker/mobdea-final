export function mirrorCardsForDuplex(cards, columns, mode = 'driver-long-edge') {
  const list = [...(cards || [])];
  const width = Math.max(1, Number(columns) || 1);
  if (mode === 'none' || mode.startsWith('driver-')) return list;
  const rows = [];
  for (let index = 0; index < list.length; index += width) rows.push(list.slice(index, index + width));
  if (mode === 'manual-long-edge') return rows.reverse().flat();
  if (mode === 'manual-short-edge') return rows.flatMap((row) => [...row].reverse());
  return list;
}

export function nativeDuplexMode(mode) {
  if (mode === 'driver-long-edge') return 'driver-long-edge';
  if (mode === 'driver-short-edge') return 'driver-short-edge';
  return 'none';
}

export function buildDuplexPagePairs(students, slotsPerPage) {
  const list = [...(students || [])];
  const size = Math.max(1, Number(slotsPerPage) || 1);
  const pairs = [];
  for (let index = 0; index < list.length; index += size) {
    pairs.push({
      sheetIndex: pairs.length,
      students: list.slice(index, index + size),
    });
  }
  return pairs;
}

export function currentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 6 ? year : year - 1;
  return `${start} - ${start + 1}`;
}
