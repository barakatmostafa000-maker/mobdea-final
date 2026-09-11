// PROJECT13_BARCODE_ATTENDANCE_ACCOUNTING_V1
function same(a, b) {
  return String(a ?? '') === String(b ?? '');
}

export function sessionPriceFor(student = {}, session = {}) {
  const studentPrice = Number(student.sessionPrice);
  if (Number.isFinite(studentPrice) && studentPrice >= 0) return studentPrice;
  const sessionPrice = Number(session.price);
  return Number.isFinite(sessionPrice) && sessionPrice >= 0 ? sessionPrice : 0;
}

export function findSessionAttendance(data = {}, studentId, sessionId, date) {
  return (data.attendance || []).find((item) =>
    same(item.studentId, studentId)
    && same(item.sessionId, sessionId)
    && String(item.date || '') === String(date || '')
  ) || null;
}

export function findSessionPayment(data = {}, studentId, sessionId, date) {
  return (data.payments || []).find((item) =>
    same(item.studentId, studentId)
    && same(item.sessionId, sessionId)
    && String(item.date || '') === String(date || '')
    && item.source === 'attendance-barcode'
  ) || null;
}

export function registerBarcodeAttendance(data = {}, {
  student,
  session,
  date,
  paymentStatus = 'due',
  attendanceStatus = 'present',
} = {}) {
  if (!student?.id) throw new Error('الطالب غير محدد.');
  if (!session?.id) throw new Error('الحصة الحالية غير محددة.');
  if (!date) throw new Error('تاريخ الحضور غير محدد.');
  if (!['paid', 'due'].includes(paymentStatus)) throw new Error('حالة الدفع غير صحيحة.');

  const now = new Date().toISOString();
  const amount = sessionPriceFor(student, session);
  const oldAttendance = findSessionAttendance(data, student.id, session.id, date);
  const attendance = {
    ...(oldAttendance || {}),
    id: oldAttendance?.id || `att-${session.id}-${student.id}-${date}`,
    studentId: student.id,
    sessionId: session.id,
    sessionTitle: session.title || '',
    date,
    status: attendanceStatus,
    source: 'barcode',
    scannedAt: now,
    paymentStatus,
    sessionPrice: amount,
    updatedAt: now,
  };
  const attendanceRows = oldAttendance
    ? (data.attendance || []).map((item) => same(item.id, oldAttendance.id) ? attendance : item)
    : [...(data.attendance || []), attendance];

  const oldPayment = findSessionPayment(data, student.id, session.id, date);
  const payment = {
    ...(oldPayment || {}),
    id: oldPayment?.id || `pay-${session.id}-${student.id}-${date}`,
    studentId: student.id,
    sessionId: session.id,
    sessionTitle: session.title || '',
    attendanceId: attendance.id,
    type: paymentStatus,
    amount,
    date,
    note: `حصة ${session.title || ''} — ${paymentStatus === 'paid' ? 'مدفوعة' : 'مستحقة'}`,
    source: 'attendance-barcode',
    updatedAt: now,
    createdAt: oldPayment?.createdAt || now,
  };
  const payments = oldPayment
    ? (data.payments || []).map((item) => same(item.id, oldPayment.id) ? payment : item)
    : [...(data.payments || []), payment];

  return { ...data, attendance: attendanceRows, payments };
}
