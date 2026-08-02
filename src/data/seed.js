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
  customQuestionBank: [],
  exams: defaultExams,
  detailedResults: [],
  grades: [
    { id: 1, studentId: 1, exam: 'الوحدة الأولى', score: 18, total: 20, date: '2026-07-10', weakness: 'التواريخ', strength: 'المفاهيم' },
    { id: 2, studentId: 2, exam: 'الوحدة الأولى', score: 16, total: 20, date: '2026-07-10', weakness: 'الشخصيات', strength: 'المواقع' }
  ],
  payments: [],
  gameResults: [],
  achievements: [],
  rewardCatalog: [],
  rewardRedemptions: [],
  lessonRecordings: [],
  gameRooms: [],
  mapResults: [],
  whiteboardRecords: [],
  notifications: [],
  contentLibrary: [
    {
      id: 'lesson-seed-arab-world',
      kind: 'lesson',
      type: 'lesson',
      title: 'وطننا العربي',
      lesson: 'وطننا العربي',
      grade: 'الصف السادس الابتدائي',
      term: 'الترم الأول',
      unit: 'الوحدة الأولى',
      lessonDate: '2026-07-20',
      pageStart: 1,
      pageEnd: 6,
      notes: 'أضف كتاب الصف الرئيسي من أعلى المكتبة، ثم ستظهر هذه الصفحات تلقائيًا في وضع الحصة.',
      tags: ['تمهيد', 'خريطة', 'مراجعة'],
      sequence: ['preview', 'board', 'practice', 'quiz'],
      relatedQuestionIds: [],
      annotations: [],
      mapState: { regionKey: 'arab', labels: true, placements: [], strokes: [] },
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z'
    }
  ],
  updateHistory: [],
  auditLog: [],
  settings: {
    adminPin: '',
    adminPinHash: '',
    adminPinSalt: '',
    adminPinIterations: 0,
    adminPinAlgorithm: '',
    teacherPin: '',
    teacherPinHash: '',
    teacherPinSalt: '',
    teacherPinIterations: 0,
    teacherPinAlgorithm: '',
    staffRecoveryQuestion: '',
    staffRecoveryAnswerHash: '',
    staffRecoveryAnswerSalt: '',
    staffRecoveryAnswerIterations: 0,
    staffRecoveryAnswerAlgorithm: '',
    lockEnabled: true,
    lockAfterMinutes: 10,
    voiceEnabled: true,
    voiceVolume: 1,
    voiceRate: 0.92,
    voiceGender: 'auto',
    welcomeVoice: true,
    cloudSync: { endpoint: 'https://mobdea-platform-api.barakatmostafa000.workers.dev', workspaceId: 'school_online', token: '', revision: '', lastPushAt: '', lastPullAt: '', autoBackup: false, autoBackupIntervalHours: 24, lastAutoBackupAt: '', autoBackupError: '' },
    update: { manifestUrl: '', autoCheck: true, trustedSha256: '' },
    voiceClips: [],
    classLessonId: 'lesson-seed-arab-world',
    classResourceId: '',
    classResourceQueue: [],
    encouragementPhrases: ['أحسنت يا بطل', 'ممتاز يا بطل', 'أنت رائع', 'أبدعت', 'واصل يا نجم', 'تفوق رائع', 'فخور بك', 'استمر يا مبدع'],
    classResourceTitle: '',
    classResourceType: '',
    classResourceFileName: '',
    classResourcePinnedAt: '',
    visibleModules: {
      games: true,
      grades: true,
      payments: true,
      reports: true,
      messages: true
    }
  }
};
