export function cleanWhatsAppMessage(text = '') {
  return String(text)
    .replace(/\/nn/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildAttendanceMessage(studentName, status, date) {
  const statusText = status === 'present'
    ? 'حضر حصة اليوم.'
    : status === 'late'
      ? 'حضر متأخرًا إلى حصة اليوم.'
      : 'لم يحضر حصة اليوم.';

  return cleanWhatsAppMessage(`السلام عليكم ورحمة الله وبركاته

عزيزي ولي الأمر،
نحيط سيادتكم علمًا بأن الطالب: ${studentName}
${statusText}

التاريخ: ${date}

مع خالص الشكر،
المُبدع مصطفى بركات
المُبدع لتعليم ممتع`);
}

export function openWhatsApp(phone, message) {
  const normalized = String(phone || '').replace(/\D/g, '').replace(/^0/, '20');
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(cleanWhatsAppMessage(message))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
