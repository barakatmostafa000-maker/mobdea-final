import { buildAttendanceMessage, cleanWhatsAppMessage } from './whatsapp';

export function ensureNotificationState(data) {
  return {
    ...data,
    notifications: Array.isArray(data.notifications) ? data.notifications : []
  };
}

export function queueAbsenceNotification(data, student, session, date) {
  const eventKey = `absence:${student.id}:${session?.id || 'none'}:${date}`;
  if ((data.notifications || []).some((item) => item.eventKey === eventKey)) return data;

  const notification = {
    id: Date.now() + Math.random(),
    eventKey,
    type: 'absence',
    studentId: student.id,
    guardianPhone: student.guardianPhone,
    sessionId: session?.id || null,
    date,
    status: 'ready',
    createdAt: new Date().toISOString(),
    message: cleanWhatsAppMessage(buildAttendanceMessage(student.name, 'absent', date))
  };

  return { ...data, notifications: [...(data.notifications || []), notification] };
}

export function markNotification(data, id, status) {
  return {
    ...data,
    notifications: (data.notifications || []).map((item) =>
      item.id === id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item
    )
  };
}

export function queueLowGradeNotification(data, student, examTitle, result) {
  const percentage=Math.round((result.score/Math.max(1,result.total))*100);
  if(percentage>=60)return data;
  const eventKey=`low-grade:${student.id}:${result.examId}:${result.id}`;
  if((data.notifications||[]).some(n=>n.eventKey===eventKey))return data;
  const weak=[...new Set(result.questionResults.filter(x=>x.status!=="correct").map(x=>x.topic).filter(Boolean))];
  const message=`السلام عليكم ورحمة الله وبركاته\n\nعزيزي ولي الأمر،\nنتيجة الطالب: ${student.name}\nفي اختبار: ${examTitle}\nالدرجة: ${result.score}/${result.total}\nالنسبة: ${percentage}%\n\nالموضوعات التي تحتاج مراجعة:\n${weak.map(x=>`- ${x}`).join('\n')||'- مراجعة أسئلة الاختبار'}\n\nالمُبدع مصطفى بركات\nالمُبدع لتعليم ممتع`;
  return {...data,notifications:[...(data.notifications||[]),{id:Date.now()+Math.random(),eventKey,type:"low-grade",studentId:student.id,guardianPhone:student.guardianPhone,examId:result.examId,date:result.date,status:"ready",createdAt:new Date().toISOString(),message}]};
}

// RUN18_ATTENDANCE_WHATSAPP_EXPORT_CLOSURE_V1
export function sendAbsenceWhatsApp(student = {}, session = {}, date = '') {
  const rawPhone = String(student?.guardianPhone || '').trim();
  const normalized = rawPhone.replace(/\D/g, '').replace(/^0/, '20');
  if (!normalized) {
    return { ok: false, message: 'لا يوجد رقم هاتف مسجل لولي الأمر.' };
  }
  const safeDate = String(date || new Date().toISOString().slice(0, 10));
  const message = cleanWhatsAppMessage(
    buildAttendanceMessage(student?.name || 'الطالب', 'absent', safeDate),
  );
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { ok: false, message: 'فتح واتساب متاح من التطبيق أو المتصفح فقط.' };
  }
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return { ok: true, message: `تم فتح واتساب لإبلاغ ولي أمر ${student?.name || 'الطالب'}.` };
}
