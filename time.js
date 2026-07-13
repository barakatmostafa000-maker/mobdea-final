export function formatTime12(value) {
  if (!value) return '—';
  const [rawHour, rawMinute = '00'] = String(value).split(':');
  let hour = Number(rawHour);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'م' : 'ص';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(rawMinute).padStart(2, '0')} ${suffix}`;
}

export function formatDateAr(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return date.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime12() {
  return new Date().toLocaleTimeString('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
