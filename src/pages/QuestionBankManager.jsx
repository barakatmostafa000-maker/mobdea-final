import { useMemo, useRef, useState } from 'react';
import { questionBank, gradeOptions } from '../data/questionBank';

const TYPE_LABELS = {
  mcq: 'اختيار متعدد',
  tf: 'صح أو خطأ',
  character: 'من الشخصية؟',
  timeline: 'خط زمني',
  matching: 'مطابقة',
  map: 'خرائط'
};

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function fingerprint(question) {
  return `${normalize(question.gradeKey)}|${normalize(question.unit)}|${normalize(question.lesson)}|${normalize(question.text).toLowerCase()}`;
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function QuestionBankManager({ data, updateData }) {
  const [gradeKey, setGradeKey] = useState('all');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  const custom = data.customQuestionBank || [];
  const merged = useMemo(() => [...questionBank, ...custom], [custom]);

  const filtered = useMemo(() => merged.filter((question) => {
    const matchesGrade = gradeKey === 'all' || question.gradeKey === gradeKey;
    const matchesType = type === 'all' || question.type === type;
    const haystack = `${question.text} ${question.unit} ${question.lesson} ${question.topic}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    return matchesGrade && matchesType && matchesQuery;
  }), [merged, gradeKey, type, query]);

  const duplicateCount = useMemo(() => {
    const seen = new Set();
    let duplicates = 0;
    merged.forEach((item) => {
      const key = fingerprint(item);
      if (seen.has(key)) duplicates += 1;
      seen.add(key);
    });
    return duplicates;
  }, [merged]);

  const importQuestions = async (file) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const rows = Array.isArray(payload) ? payload : payload.questions;
      if (!Array.isArray(rows)) throw new Error('صيغة غير صحيحة');

      const existing = new Set(merged.map(fingerprint));
      const accepted = [];
      rows.forEach((row, index) => {
        const question = {
          id: row.id || `custom-${Date.now()}-${index}`,
          gradeKey: String(row.gradeKey || '6'),
          grade: row.grade || gradeOptions.find((item) => item.key === String(row.gradeKey || '6'))?.label || 'غير محدد',
          term: row.term || 'الترم الأول',
          unit: row.unit || 'غير محدد',
          lesson: row.lesson || 'غير محدد',
          topic: row.topic || 'عام',
          type: row.type || 'mcq',
          text: normalize(row.text),
          options: Array.isArray(row.options) ? row.options : [],
          answer: row.answer ?? '',
          answerIndex: Number.isInteger(row.answerIndex) ? row.answerIndex : 0,
          difficulty: row.difficulty || 'متوسط',
          maxScore: Number(row.maxScore || 1)
        };
        if (!question.text) return;
        const key = fingerprint(question);
        if (existing.has(key)) return;
        existing.add(key);
        accepted.push(question);
      });

      updateData({ ...data, customQuestionBank: [...custom, ...accepted] });
      setMessage(`تم استيراد ${accepted.length} سؤالًا جديدًا ومنع التكرارات تلقائيًا.`);
    } catch (error) {
      setMessage(`تعذر الاستيراد: ${error.message}`);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const cleanDuplicates = () => {
    const builtIn = new Set(questionBank.map(fingerprint));
    const seen = new Set(builtIn);
    const cleaned = custom.filter((item) => {
      const key = fingerprint(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    updateData({ ...data, customQuestionBank: cleaned });
    setMessage(`تم تنظيف البنك. حُذف ${custom.length - cleaned.length} سؤال مكرر.`);
  };

  const generateExam = () => {
    const pool = filtered.filter((q) => ['mcq', 'tf'].includes(q.type));
    const selected = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(20, pool.length));
    if (!selected.length) {
      setMessage('لا توجد أسئلة مناسبة لتوليد امتحان بهذا الاختيار.');
      return;
    }
    const exam = {
      id: `exam-auto-${Date.now()}`,
      title: `اختبار مولد تلقائيًا - ${new Date().toLocaleDateString('ar-EG')}`,
      grade: selected[0].grade,
      questionIds: selected.map((item) => item.id),
      active: true,
      generated: true
    };
    updateData({ ...data, exams: [...(data.exams || []), exam] });
    setMessage(`تم إنشاء امتحان من ${selected.length} سؤالًا وإضافته إلى رصد الدرجات.`);
  };

  return <section className="page">
    <div className="page-heading">
      <div>
        <span className="eyebrow">إدارة مركزية للأسئلة</span>
        <h2>بنك الأسئلة</h2>
        <p>بحث وفلترة واستيراد ومنع تكرار وتوليد امتحانات من نفس البنك.</p>
      </div>
      <div className="heading-actions">
        <button className="secondary-btn" onClick={() => downloadJson({ questions: merged }, 'mobdea-question-bank.json')}>تصدير البنك</button>
        <button className="primary-btn" onClick={() => inputRef.current?.click()}>استيراد JSON</button>
        <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => importQuestions(event.target.files?.[0])}/>
      </div>
    </div>

    <div className="stats-grid compact bank-stats">
      <div className="stat-card"><div><span>إجمالي الأسئلة</span><strong>{merged.length}</strong><small>أساسي + مضاف</small></div></div>
      <div className="stat-card"><div><span>الأسئلة المضافة</span><strong>{custom.length}</strong><small>قابلة للتعديل والاستيراد</small></div></div>
      <div className="stat-card"><div><span>التكرارات المكتشفة</span><strong>{duplicateCount}</strong><small>يمكن تنظيفها بضغطة</small></div></div>
    </div>

    <div className="panel bank-toolbar">
      <select value={gradeKey} onChange={(event) => setGradeKey(event.target.value)}>
        <option value="all">كل الصفوف</option>
        {gradeOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
      </select>
      <select value={type} onChange={(event) => setType(event.target.value)}>
        <option value="all">كل الأنواع</option>
        {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في السؤال أو الدرس أو الموضوع"/>
      <button className="secondary-btn" onClick={cleanDuplicates}>تنظيف التكرار</button>
      <button className="primary-btn" onClick={generateExam}>توليد امتحان</button>
    </div>

    {message && <div className="spoken-banner">{message}</div>}

    <div className="panel question-bank-table-wrap">
      <table className="question-bank-table">
        <thead><tr><th>#</th><th>السؤال</th><th>الصف</th><th>الوحدة والدرس</th><th>النوع</th><th>الصعوبة</th></tr></thead>
        <tbody>
          {filtered.map((question, index) => <tr key={question.id}>
            <td>{index + 1}</td>
            <td><strong>{question.text}</strong><small>{question.topic}</small></td>
            <td>{question.grade}</td>
            <td>{question.unit}<small>{question.lesson}</small></td>
            <td>{TYPE_LABELS[question.type] || question.type}</td>
            <td>{question.difficulty || 'متوسط'}</td>
          </tr>)}
        </tbody>
      </table>
      {!filtered.length && <div className="empty-state">لا توجد نتائج مطابقة.</div>}
    </div>
  </section>;
}
