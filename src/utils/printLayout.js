export function mirrorCardsForDuplex(cards, columns, mode = 'flip-long-edge') {
  const list = [...(cards || [])];
  const width = Math.max(1, Number(columns) || 1);
  if (mode === 'none') return list;
  const rows = [];
  for (let index = 0; index < list.length; index += width) rows.push(list.slice(index, index + width));
  if (mode === 'flip-short-edge') return rows.reverse().flatMap((row) => [...row].reverse());
  return rows.flatMap((row) => [...row].reverse());
}

export function currentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 6 ? year : year - 1;
  return `${start} - ${start + 1}`;
}
