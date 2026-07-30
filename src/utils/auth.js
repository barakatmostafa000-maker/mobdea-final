export const ROLE_LABELS = {
  teacher: 'المعلم',
  admin: 'الإدارة',
  student: 'الطالب',
  guardian: 'ولي الأمر',
  visitor: 'الزائر',
};

export const ROLE_HOME = {
  teacher: 'dashboard',
  admin: 'dashboard',
  student: 'dashboard',
  guardian: 'dashboard',
  visitor: 'dashboard',
};

export const ROLE_ACCESS = {
  // teacher/admin currently share full access; kept as separate identities
  // so permissions can diverge later without another migration.
  teacher: null,
  admin: null,
  // Student: own portal only (read-only grades/attendance/games via PortalPreview,
  // locked to their own record), plus the games/map challenge and a read-only
  // content library. No access to the raw admin CRUD screens (Grades, Messages,
  // Payments, Attendance, StudentCards, Settings, Reports, etc.).
  student: new Set(['dashboard', 'portalPreview', 'games', 'mapChallenge', 'contentLibrary']),
  // Guardian: own child's portal only (attendance/grades/dues + messages sent
  // to them, all read-only, locked to their linked student). Messages.jsx is a
  // teacher-only broadcast composer that lists every student's name, code, and
  // guardian phone number, so guardians never get access to it directly.
  guardian: new Set(['dashboard', 'portalPreview']),
  // Visitor: whatever the teacher has published in the content library, nothing else.
  visitor: new Set(['dashboard', 'contentLibrary', 'updates']),
};

export function normalizeDigits(value) {
  return String(value ?? '').replace(/\D/g, '').trim();
}

export function resolveStudentByCode(data, input) {
  const value = normalizeDigits(input);
  if (!value) return null;
  return (data?.students || []).find((student) => String(student.code) === value || String(student.id) === value) || null;
}

export function resolveGuardianByPhone(data, input) {
  const value = normalizeDigits(input);
  if (!value) return null;
  return (data?.students || []).find((student) => normalizeDigits(student.guardianPhone) === value) || null;
}

export function resolveStudentFromQrPayload(data, payload) {
  if (!payload) return null;
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const candidates = [parsed?.code, parsed?.studentCode, parsed?.id, parsed?.studentId]
      .map(normalizeDigits)
      .filter(Boolean);
    for (const candidate of candidates) {
      const student = resolveStudentByCode(data, candidate);
      if (student) return student;
    }
  } catch {
    // Fallback to direct string lookup.
  }
  return resolveStudentByCode(data, payload);
}

export function roleGreeting(role) {
  return ROLE_LABELS[role] || 'المستخدم';
}

export function buildWelcomeMessage(auth, identity) {
  if (!auth) return '';
  const brand = `منصة ${identity?.schoolName?.replace('لتعليم ممتع', '').trim() || 'المُبدع'} مصطفى بركات`;
  if (auth.role === 'teacher' || auth.role === 'admin') {
    return `أهلاً وسهلاً بك أ/ ${(identity?.teacherName || 'مصطفى بركات').replace('المُبدع ', '')} في ${brand}.`;
  }
  if (auth.role === 'student') {
    return auth.displayName ? `أهلاً وسهلاً بك أ/ ${auth.displayName} في ${brand}.` : `أهلاً وسهلاً بك في ${brand}.`;
  }
  if (auth.role === 'guardian') {
    return auth.displayName ? `أهلاً وسهلاً بك ولي الأمر / ${auth.displayName} في ${brand}.` : `أهلاً وسهلاً بك ولي الأمر في ${brand}.`;
  }
  return `أهلاً وسهلاً بك في ${brand}.`;
}

export function defaultAuthState(role = 'admin', student = null) {
  return {
    role,
    studentId: student?.id || null,
    studentCode: student?.code || null,
    displayName: student?.name || '',
    permissions: student?.permissions || null,
    parentPermissions: student?.parentPermissions || null,
  };
}

export function getRoleModules(role) {
  return ROLE_ACCESS[role] || null;
}
