export const ROLE_LABELS = {
  admin: 'الإدارة',
  student: 'الطالب',
  guardian: 'ولي الأمر',
  visitor: 'الزائر',
};

export const ROLE_HOME = {
  admin: 'dashboard',
  student: 'dashboard',
  guardian: 'dashboard',
  visitor: 'dashboard',
};

export const ROLE_ACCESS = {
  admin: null,
  student: new Set(['dashboard', 'portalPreview', 'studentCards', 'grades', 'games', 'mapChallenge', 'contentLibrary', 'messages']),
  guardian: new Set(['dashboard', 'portalPreview', 'attendance', 'grades', 'payments', 'messages', 'reports', 'contentLibrary']),
  visitor: new Set(['dashboard', 'portalPreview', 'contentLibrary', 'updates']),
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
