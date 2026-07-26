import { sanitizeQuestion } from './assessment';
import { gradeOptions } from '../data/questionBank';

const RESOURCE_TYPE_LABELS = {
  video: 'فيديو',
  pdf: 'كتاب أو شرح PDF',
  image: 'صورة تعليمية',
  map: 'خريطة تعليمية',
  audio: 'صوت',
  slides: 'عرض تقديمي',
  link: 'رابط خارجي',
};

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function inferGradeKey(grade = '') {
  const normalized = normalize(grade);
  const exact = gradeOptions.find((item) => normalize(item.label) === normalized);
  if (exact) return exact.key;
  const partial = gradeOptions.find((item) => normalized && normalize(item.label).includes(normalized))
    || gradeOptions.find((item) => normalized && normalized.includes(normalize(item.label)));
  return partial?.key || '6';
}

function inferTopic(resource = {}) {
  const text = normalize([resource.title, resource.unit, resource.lesson, resource.notes, ...(Array.isArray(resource.tags) ? resource.tags : [])].join(' '));
  if (/خريطة|map|atlas|خرائط/i.test(text) || resource.type === 'map') return 'الخريطة والمهارات الجغرافية';
  if (/تاريخ|حضارة|مصر|الوطن العربي|دولة|حدود|موقع/i.test(text)) return 'المفاهيم الأساسية';
  return normalize(resource.tags?.[0] || resource.lesson || resource.unit || 'عام');
}

function buildQuestion(id, input, fallback) {
  return sanitizeQuestion({ id, ...input }, fallback);
}

export function generateQuestionsFromResource(resource = {}) {
  if (!resource?.id) return [];

  const gradeKey = inferGradeKey(resource.grade);
  const grade = normalize(resource.grade || gradeOptions.find((item) => item.key === gradeKey)?.label || 'غير محدد');
  const title = normalize(resource.title || 'مورد تعليمي');
  const unit = normalize(resource.unit || 'الوحدة');
  const lesson = normalize(resource.lesson || title);
  const topic = inferTopic(resource);
  const typeLabel = RESOURCE_TYPE_LABELS[resource.type] || 'مورد تعليمي';
  const pages = resource.pageStart && resource.pageEnd
    ? `ص ${resource.pageStart} إلى ص ${resource.pageEnd}`
    : resource.pageStart
      ? `من ص ${resource.pageStart}`
      : resource.pageEnd
        ? `حتى ص ${resource.pageEnd}`
        : 'غير محددة';
  const typeHint = /خريطة|map|خرائط/i.test(title + ' ' + topic) || resource.type === 'map'
    ? 'خرائط ومواقع' 
    : resource.type === 'video'
      ? 'الشرح والمشاهدة'
      : resource.type === 'audio'
        ? 'الاستماع والتشجيع'
        : resource.type === 'image'
          ? 'الملاحظة والفهم'
          : 'المراجعة والشرح';
  const base = `auto-${resource.id}`;

  const items = [
    buildQuestion(`${base}-type`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'mcq',
      text: `ما نوع المورد "${title}"؟`,
      options: [typeLabel, 'اختبار نهائي', 'واجب منزلي', 'سجل درجات'],
      answerIndex: 0,
      answer: typeLabel,
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-lesson`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'fill',
      text: 'اكتب اسم الدرس المرتبط بالمورد:',
      answer: lesson,
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-grade`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'tf',
      text: `هذا المورد مخصص للصف ${grade}.`,
      options: ['صح', 'خطأ'],
      answerIndex: 0,
      answer: 'صح',
      difficulty: 'سهل',
      maxScore: 1,
      source: 'auto',
    }),
    buildQuestion(`${base}-pages`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic,
      type: 'mcq',
      text: `صفحات هذا المورد ${pages} تعني أنه مناسب لـ...`,
      options: [
        typeHint,
        'تنظيم الدفاتر فقط',
        'الامتحان الشفوي فقط',
        'الملفات الإدارية فقط',
      ],
      answerIndex: 0,
      answer: typeHint,
      difficulty: 'متوسط',
      maxScore: 1,
      source: 'auto',
    }),
  ];

  if (/خريطة|map|خرائط/i.test(title + ' ' + lesson + ' ' + unit + ' ' + topic) || resource.type === 'map') {
    items.push(buildQuestion(`${base}-map`, {
      gradeKey,
      grade,
      term: normalize(resource.term || 'الترم الأول'),
      unit,
      lesson,
      topic: 'الخريطة والظاهرات الجغرافية',
      type: 'mcq',
      text: 'ما الفكرة الأساسية من هذا المورد الجغرافي؟',
      options: ['تحديد المواقع والظاهرات على الخريطة', 'حفظ النصوص الأدبية', 'حل مسائل الحساب', 'كتابة تقارير فقط'],
      answerIndex: 0,
      answer: 'تحديد المواقع والظاهرات على الخريطة',
      difficulty: 'متوسط',
      maxScore: 1,
      source: 'auto',
    }));
  }

  return items.map((question) => ({
    ...question,
    resourceId: resource.id,
    resourceTitle: title,
    source: 'auto',
  }));
}

export function upsertGeneratedQuestions(questionBank = [], resource = {}, generatedQuestions = []) {
  const resourceId = String(resource?.id ?? '');
  const prefix = `auto-${resourceId}`;
  const cleaned = Array.isArray(questionBank)
    ? questionBank.filter((question) => {
        const sameResource = String(question?.resourceId ?? '') === resourceId;
        const samePrefix = String(question?.id ?? '').startsWith(prefix);
        return !(sameResource || samePrefix);
      })
    : [];
  return [...cleaned, ...(generatedQuestions || [])];
}

export function removeGeneratedQuestions(questionBank = [], resourceId) {
  const key = String(resourceId ?? '');
  const prefix = `auto-${key}`;
  return (Array.isArray(questionBank) ? questionBank : []).filter((question) => {
    const sameResource = String(question?.resourceId ?? '') === key;
    const samePrefix = String(question?.id ?? '').startsWith(prefix);
    return !(sameResource || samePrefix);
  });
}
