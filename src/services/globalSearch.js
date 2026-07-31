const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function allowedStudentIds(data, auth) {
  if (!['student', 'guardian'].includes(auth?.role)) return null;
  const ids = new Set([
    auth?.studentId,
    ...(Array.isArray(auth?.studentIds) ? auth.studentIds : []),
    ...(Array.isArray(auth?.linkedStudentIds) ? auth.linkedStudentIds : []),
  ].filter((value) => value !== null && value !== undefined).map(String));
  if (auth?.role === 'guardian') {
    const anchor = (data.students || []).find((student) => ids.has(String(student.id)));
    if (anchor?.guardianPhone) {
      for (const student of data.students || []) {
        if (student.guardianPhone && student.guardianPhone === anchor.guardianPhone) ids.add(String(student.id));
      }
    }
  }
  return ids;
}

function addItem(items, item) {
  const title = String(item.title || '').trim();
  if (!title) return;
  const subtitle = String(item.subtitle || '').trim();
  const keywords = Array.isArray(item.keywords) ? item.keywords.join(' ') : String(item.keywords || '');
  items.push({
    id: String(item.id || `${item.type}-${items.length}`),
    type: item.type || 'item',
    page: item.page || 'dashboard',
    title,
    subtitle,
    searchText: normalizeSearchText(`${title} ${subtitle} ${keywords}`),
  });
}

export function buildGlobalSearchIndex(data = {}, auth = {}) {
  const items = [];
  const studentIds = allowedStudentIds(data, auth);
  const canManage = ['admin', 'teacher'].includes(auth?.role);
  const visibleStudents = (data.students || []).filter(
    (student) => !studentIds || studentIds.has(String(student.id)),
  );

  for (const student of visibleStudents) {
    addItem(items, {
      id: `student-${student.id}`,
      type: 'student',
      page: auth?.role === 'guardian' ? 'portalPreview' : 'students',
      title: student.name,
      subtitle: `${student.grade || 'بدون صف'} • ${student.group || 'بدون مجموعة'} • كود ${student.code || student.id}`,
      keywords: [student.code, student.grade, student.group],
    });
  }

  for (const resource of data.contentLibrary || []) {
    addItem(items, {
      id: `resource-${resource.id}`,
      type: 'resource',
      page: 'contentLibrary',
      title: resource.title || resource.lesson || resource.fileName,
      subtitle: `${resource.grade || 'كل الصفوف'} • ${resource.unit || 'بدون وحدة'} • ${resource.type || 'ملف'}`,
      keywords: [resource.lesson, resource.fileName, resource.notes],
    });
  }

  for (const session of data.sessions || []) {
    addItem(items, {
      id: `session-${session.id}`,
      type: 'session',
      page: 'sessions',
      title: session.title || session.group || 'حصة',
      subtitle: `${session.group || ''} • ${session.day || ''} ${session.time || ''}`,
      keywords: [session.teacher, session.room],
    });
  }

  for (const recording of data.lessonRecordings || []) {
    addItem(items, {
      id: `recording-${recording.id}`,
      type: 'recording',
      page: 'classMode',
      title: recording.title || recording.lessonTitle || 'تسجيل حصة',
      subtitle: `${recording.grade || ''} • ${recording.createdAt ? new Date(recording.createdAt).toLocaleDateString('ar-EG') : ''}`,
      keywords: [recording.lessonTitle, recording.group, recording.fileName],
    });
  }

  for (const exam of data.exams || []) {
    addItem(items, {
      id: `exam-${exam.id}`,
      type: 'exam',
      page: 'grades',
      title: exam.title || exam.name || 'امتحان',
      subtitle: `${exam.grade || ''} • ${exam.date || ''}`,
      keywords: [exam.subject, exam.term],
    });
  }

  for (const result of data.detailedResults || []) {
    if (studentIds && !studentIds.has(String(result.studentId))) continue;
    const student = visibleStudents.find((entry) => String(entry.id) === String(result.studentId));
    addItem(items, {
      id: `result-${result.id}`,
      type: 'result',
      page: 'resultDetails',
      title: result.exam || result.examTitle || 'نتيجة امتحان',
      subtitle: `${student?.name || 'طالب'} • ${result.score ?? 0}/${result.total ?? 0}`,
      keywords: [result.date, result.lesson, result.topic],
    });
  }

  if (canManage) {
    for (const payment of data.payments || []) {
      const student = (data.students || []).find((entry) => String(entry.id) === String(payment.studentId));
      addItem(items, {
        id: `payment-${payment.id}`,
        type: 'payment',
        page: 'payments',
        title: student?.name || payment.title || 'عملية حسابية',
        subtitle: `${payment.type || 'دفعة'} • ${Number(payment.amount || 0)} ج.م • ${payment.date || ''}`,
        keywords: [payment.note, payment.month],
      });
    }

    for (const question of data.customQuestionBank || []) {
      addItem(items, {
        id: `question-${question.id}`,
        type: 'question',
        page: 'questionBank',
        title: question.text || 'سؤال',
        subtitle: `${question.grade || question.gradeKey || ''} • ${question.unit || ''}`,
        keywords: [question.lesson, question.topic, question.answer],
      });
    }
  }

  return items;
}

export function searchGlobalIndex(index = [], query = '', limit = 20) {
  const normalized = normalizeSearchText(query);
  if (normalized.length < 2) return [];
  const tokens = normalized.split(' ').filter(Boolean);
  return (Array.isArray(index) ? index : [])
    .map((item) => {
      const haystack = item.searchText || normalizeSearchText(`${item.title} ${item.subtitle}`);
      if (!tokens.every((token) => haystack.includes(token))) return null;
      const exactTitle = normalizeSearchText(item.title) === normalized;
      const titleStarts = normalizeSearchText(item.title).startsWith(normalized);
      const score = (exactTitle ? 100 : 0) + (titleStarts ? 30 : 0) + tokens.reduce((sum, token) => sum + (haystack.indexOf(token) < 20 ? 5 : 1), 0);
      return { ...item, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'ar'))
    .slice(0, Math.max(1, Math.min(50, Number(limit || 20))));
}
