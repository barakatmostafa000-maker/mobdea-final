import { defaultExams } from './questionBank';

export const seedData = {
  students: [
    { id: 1, code: 1, name: 'أحمد محمد', grade: 'الصف السادس الابتدائي', group: 'مجموعة 5 مساءً', guardianPhone: '01000000001', sessionPrice: 50, permissions: { games: true, grades: true, content: true }, parentPermissions: { attendance: true, grades: true, dues: true } },
    { id: 2, code: 2, name: 'سارة إيهاب', grade: 'الصف السادس الابتدائي', group: 'مجموعة 5 مساءً', guardianPhone: '01000000002', sessionPrice: 50, permissions: { games: true, grades: true, content: true }, parentPermissions: { attendance: true, grades: true, dues: true } },
    { id: 3, code: 3, name: 'محمد علي', grade: 'الصف السادس الابتدائي', group: 'مجموعة 5 مساءً', guardianPhone: '01000000003', sessionPrice: 50, permissions: { games: true, grades: true, content: true }, parentPermissions: { attendance: true, grades: true, dues: true } },
    { id: 4, code: 4, name: 'نور أحمد', grade: 'الصف السادس الابتدائي', group: 'مجموعة 5 مساءً', guardianPhone: '01000000004', sessionPrice: 50, permissions: { games: true, grades: true, content: true }, parentPermissions: { attendance: true, grades: true, dues: true } }
  ],
  sessions: [
    { id: 1, title: 'الصف السادس الابتدائي', group: 'مجموعة 5 مساءً', day: 'الأربعاء', time: '17:00', price: 50, current: true }
  ],
  attendance: [],
  exams: defaultExams,
  detailedResults: [],
  grades: [
    { id: 1, studentId: 1, exam: 'الوحدة الأولى', score: 18, total: 20, date: '2026-07-10', weakness: 'التواريخ', strength: 'المفاهيم' },
    { id: 2, studentId: 2, exam: 'الوحدة الأولى', score: 16, total: 20, date: '2026-07-10', weakness: 'الشخصيات', strength: 'المواقع' }
  ],
  payments: [],
  gameResults: [],
  notifications: [],
  auditLog: [],
  settings: {
    adminPin: '123456',
    lockEnabled: true,
    lockAfterMinutes: 10,
    voiceEnabled: true,
    voiceVolume: 1,
    voiceRate: 0.92,
    voiceGender: 'auto',
    welcomeVoice: true,
    cloudSync: { endpoint: '', workspaceId: '', token: '', lastPushAt: '', lastPullAt: '' },
    visibleModules: {
      games: true,
      grades: true,
      payments: true,
      reports: true,
      messages: true
    }
  }
};
