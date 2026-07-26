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
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nowTime12() {
  return new Date().toLocaleTimeString('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
