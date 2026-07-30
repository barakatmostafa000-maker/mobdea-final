import { useMemo, useRef, useState } from 'react';
import { BookMarked, ExternalLink } from 'lucide-react';
import { questionBank, gradeOptions } from '../data/questionBank';
import {
  buildExamFromPool,
  fingerprintQuestion,
  getQuestionTypeLabel,
  mergeQuestionBanks,
  normalizeText,
  sanitizeQuestion,
  questionTypeMeta
} from '../services/assessment';
import { getGradeExams } from '../services/libraryModel';
import { useAssetUrl } from '../hooks/useAssetUrl';

const TYPE_KEYS = Object.keys(questionTypeMeta);

function createDraft(template = {}) {
  return sanitizeQuestion(template, {
    gradeKey: '6',
    grade: gradeOptions[2]?.label || 'الصف السادس الابتدائي',
    term: 'الترم الأول',
    unit: 'الوحدة الأولى',
    lesson: 'درس جديد',
    topic: 'عام',
    type: 'mcq',
    text: '',
    options: [],
    answer: '',
    answerIndex: 0,
    difficulty: 'متوسط',
    maxScore: 1,
    source: 'custom'
  });
}

function csvSafe(value) {
  return String(value ?? '').replaceAll('"', '""');
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

function OfficialExamsSource({ resource, gradeLabel }) {
  const url = useAssetUrl(resource?.assetId, resource?.url);
  return (
    <div className={`panel question-bank-official-source ${url ? 'ready' : 'missing'}`}>
      <BookMarked size={24}/>
      <div>
        <span className="eyebrow">المصدر الرسمي من المكتبة</span>
        <h3>{gradeLabel ? `ملف الامتحانات الرئيسي — ${gradeLabel}` : 'اختر صفًا لعرض ملف امتحاناته'}</h3>
        <p>{url ? (resource.fileName || 'ملف الامتحانات محفوظ ومتاح كمرجع دائم للمولد.') : 'لم يتم رفع ملف الامتحانات الرئيسي لهذا الصف بعد.'}</p>
      </div>
      {url && <a className="secondary-btn" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> فتح المرجع</a>}
    </div>
  );
}

export default function QuestionBankManager({ data, updateData }) {
  const inputRef = useRef(null);
  const [gradeKey, setGradeKey] = useState('all');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [examTitle, setExamTitle] = useState('اختبار من بنك الأسئلة');
  const [examCount, setExamCount] = useState(20);
  const [shuffleExam, setShuffleExam] = useState(true);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const custom = data.customQuestionBank || [];
  const merged = useMemo(() => mergeQuestionBanks(questionBank, custom), [custom]);
  const selectedGradeLabel = gradeKey === 'all' ? '' : (gradeOptions.find((item) => item.key === gradeKey)?.label || '');
  const officialExamSource = selectedGradeLabel ? getGradeExams(data, selectedGradeLabel) : null;

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
      const key = fingerprintQuestion(item);
      if (seen.has(key)) duplicates += 1;
      seen.add(key);
    });
    return duplicates;
  }, [merged]);

  const customDuplicates = useMemo(() => {
    const seen = new Set(questionBank.map(fingerprintQuestion));
    const duplicates = [];
    custom.forEach((item) => {
      const key = fingerprintQuestion(item);
      if (seen.has(key)) duplicates.push(item);
      seen.add(key);
    });
    return duplicates;
  }, [custom]);

  const openEditor = (question = null) => {
    const seed = question ? sanitizeQuestion(question, { source: 'custom' }) : createDraft();
    setDraft({
      ...seed,
      optionsText: Array.isArray(seed.options) ? seed.options.join('\n') : '',
      isNew: !question || question.source !== 'custom'
    });
    setEditingId(question?.id || null);
  };

  const closeEditor = () => {
    setDraft(null);
    setEditingId(null);
  };

  const saveQuestion = () => {
    if (!draft?.text?.trim()) {
      setMessage('اكتب نص السؤال أولًا.');
      return;
    }

    const nextQuestion = sanitizeQuestion({
      ...draft,
      options: String(draft.optionsText || '')
        .split('\n')
        .map((item) => normalizeText(item))
        .filter(Boolean)
    }, { source: 'custom', id: editingId || `custom-${Date.now()}` });

    const current = custom.filter((item) => item.id !== editingId);
    const nextCustom = [...current, nextQuestion];
    updateData({ ...data, customQuestionBank: nextCustom });
    setMessage(editingId ? 'تم تحديث السؤال بنجاح.' : 'تمت إضافة السؤال إلى بنك الأسئلة.');
    closeEditor();
  };

  const cloneQuestion = (question) => {
    setDraft({
      ...sanitizeQuestion(question, { source: 'custom' }),
      id: `custom-${Date.now()}`,
      source: 'custom',
      optionsText: Array.isArray(question.options) ? question.options.join('\n') : ''
    });
    setEditingId(null);
  };

  const deleteQuestion = (question) => {
    const nextCustom = custom.filter((item) => item.id !== question.id);
    updateData({ ...data, customQuestionBank: nextCustom });
    setMessage('تم حذف السؤال المخصص.');
    if (editingId === question.id) closeEditor();
  };

  const importQuestions = async (file) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const rows = Array.isArray(payload) ? payload : payload.questions;
      if (!Array.isArray(rows)) throw new Error('صيغة غير صحيحة');

      const existing = new Set(merged.map(fingerprintQuestion));
      const accepted = [];
      rows.forEach((row, index) => {
        const question = sanitizeQuestion({
          ...row,
          id: row.id || `custom-${Date.now()}-${index}`,
          options: Array.isArray(row.options) ? row.options : String(row.optionsText || '').split('\n').filter(Boolean)
        }, {
          gradeKey: row.gradeKey,
          grade: row.grade,
          term: row.term,
          unit: row.unit,
          lesson: row.lesson,
          topic: row.topic,
          type: row.type,
          text: row.text,
          answer: row.answer,
          answerIndex: row.answerIndex,
          difficulty: row.difficulty,
          maxScore: row.maxScore,
          source: 'custom'
        });
        if (!question.text) return;
        const key = fingerprintQuestion(question);
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
    const builtIn = new Set(questionBank.map(fingerprintQuestion));
    const seen = new Set(builtIn);
    const cleaned = custom.filter((item) => {
      const key = fingerprintQuestion(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    updateData({ ...data, customQuestionBank: cleaned });
    setMessage(`تم تنظيف البنك. حُذف ${custom.length - cleaned.length} سؤال مكرر.`);
  };

  const exportBank = () => {
    downloadJson({ questions: merged }, 'mobdea-question-bank.json');
  };

  const exportCsv = () => {
    const header = ['id', 'gradeKey', 'grade', 'term', 'unit', 'lesson', 'topic', 'type', 'text', 'options', 'answer', 'answerIndex', 'difficulty', 'maxScore'];
    const rows = merged.map((item) => [
      item.id,
      item.gradeKey,
      item.grade,
      item.term,
      item.unit,
      item.lesson,
      item.topic,
      item.type,
      item.text,
      (item.options || []).join(' | '),
      item.answer,
      item.answerIndex,
      item.difficulty,
      item.maxScore
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map((value) => `"${csvSafe(value)}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mobdea-question-bank.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateExam = () => {
    const pool = filtered.filter((q) => ['mcq', 'tf', 'fill', 'essay'].includes(q.type));
    const exam = buildExamFromPool(pool, {
      title: examTitle,
      grade: selectedGradeLabel || pool[0]?.grade,
      count: Number(examCount || 0),
      shuffle: shuffleExam,
      generated: true,
      sourceResourceId: officialExamSource?.id || '',
      sourceAssetId: officialExamSource?.assetId || '',
      sourceFileName: officialExamSource?.fileName || '',
    });
    if (!exam) {
      setMessage('لا توجد أسئلة مناسبة لتوليد امتحان بهذا الاختيار.');
      return;
    }
    updateData({ ...data, exams: [...(data.exams || []), exam] });
    setMessage(`تم إنشاء امتحان من ${exam.questionIds.length} سؤالًا وإضافته إلى رصد الدرجات.`);
  };

  const examCountText = `${(data.exams || []).length} امتحان`;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">إدارة مركزية للأسئلة</span>
          <h2>بنك الأسئلة</h2>
          <p>بحث، فلترة، إضافة، تعديل، استيراد، توليد امتحانات، وتنظيف التكرارات.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-btn" onClick={exportCsv}>تصدير CSV</button>
          <button className="secondary-btn" onClick={exportBank}>تصدير JSON</button>
          <button className="primary-btn" onClick={() => openEditor()}>+ سؤال جديد</button>
        </div>
      </div>

      <div className="stats-grid compact bank-stats">
        <div className="stat-card"><div><span>إجمالي الأسئلة</span><strong>{merged.length}</strong><small>أساسي + مضاف</small></div></div>
        <div className="stat-card"><div><span>الأسئلة المضافة</span><strong>{custom.length}</strong><small>قابلة للتعديل والاستيراد</small></div></div>
        <div className="stat-card"><div><span>التكرارات المكتشفة</span><strong>{duplicateCount}</strong><small>يمكن تنظيفها بضغطة</small></div></div>
      </div>

      <OfficialExamsSource resource={officialExamSource} gradeLabel={selectedGradeLabel} />

      <div className="panel bank-toolbar">
        <select value={gradeKey} onChange={(event) => setGradeKey(event.target.value)}>
          <option value="all">كل الصفوف</option>
          {gradeOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">كل الأنواع</option>
          {TYPE_KEYS.map((key) => <option key={key} value={key}>{getQuestionTypeLabel(key)}</option>)}
        </select>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في السؤال أو الدرس أو الموضوع" />
        <button className="secondary-btn" onClick={cleanDuplicates}>تنظيف التكرار</button>
        <button className="secondary-btn" onClick={() => inputRef.current?.click()}>استيراد JSON</button>
        <button className="primary-btn" onClick={generateExam}>توليد امتحان</button>
        <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => importQuestions(event.target.files?.[0])} />
      </div>

      <div className="panel bank-toolbar" style={{ marginTop: 12 }}>
        <input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="عنوان الامتحان" />
        <input type="number" min="5" max="40" value={examCount} onChange={(event) => setExamCount(Number(event.target.value))} placeholder="عدد الأسئلة" />
        <label className="setting-row" style={{ margin: 0 }}>
          <span>ترتيب عشوائي</span>
          <input type="checkbox" checked={shuffleExam} onChange={(event) => setShuffleExam(event.target.checked)} />
        </label>
        <div className="spoken-banner" style={{ margin: 0 }}>{examCountText}</div>
      </div>

      {message && <div className="spoken-banner">{message}</div>}

      <div className="panel question-bank-table-wrap">
        <table className="question-bank-table">
          <thead>
            <tr>
              <th>#</th>
              <th>السؤال</th>
              <th>الصف</th>
              <th>الوحدة والدرس</th>
              <th>النوع</th>
              <th>الصعوبة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((question, index) => {
              const isCustom = custom.some((item) => item.id === question.id);
              return (
                <tr key={question.id}>
                  <td>{index + 1}</td>
                  <td><strong>{question.text}</strong><small>{question.topic}</small></td>
                  <td>{question.grade}</td>
                  <td>{question.unit}<small>{question.lesson}</small></td>
                  <td>{getQuestionTypeLabel(question.type)}</td>
                  <td>{question.difficulty || 'متوسط'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary-btn" onClick={() => cloneQuestion(question)}>نسخ</button>
                      {isCustom ? (
                        <>
                          <button className="secondary-btn" onClick={() => openEditor(question)}>تعديل</button>
                          <button className="danger-btn" onClick={() => deleteQuestion(question)}>حذف</button>
                        </>
                      ) : (
                        <button className="secondary-btn" onClick={() => cloneQuestion(question)}>إضافة نسخة</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="empty-state">لا توجد نتائج مطابقة.</div>}
      </div>

      <div className="panel" style={{ marginTop: 13 }}>
        <div className="panel-title">
          <h3>الامتحانات الحالية</h3>
          <span>{examCountText}</span>
        </div>
        <div className="cards-list">
          {(data.exams || []).slice(0, 6).map((exam) => (
            <article className={`session-item ${exam.generated ? 'current-item' : ''}`} key={exam.id}>
              <div>
                <h3>{exam.title}</h3>
                <p>{exam.grade} — {exam.questionIds?.length || 0} سؤال</p>
              </div>
              <small>{exam.active ? 'نشط' : 'غير نشط'}</small>
            </article>
          ))}
          {!(data.exams || []).length && <div className="empty-state">لا توجد امتحانات محفوظة بعد.</div>}
        </div>
      </div>

      {draft && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: 'min(920px, 100%)' }}>
            <h3>{editingId ? 'تعديل سؤال' : 'إضافة سؤال جديد'}</h3>
            <div className="form-grid">
              <select value={draft.gradeKey} onChange={(event) => setDraft({ ...draft, gradeKey: event.target.value, grade: gradeOptions.find((item) => item.key === event.target.value)?.label || draft.grade })}>
                {gradeOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
              </select>
              <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                {TYPE_KEYS.map((key) => <option key={key} value={key}>{getQuestionTypeLabel(key)}</option>)}
              </select>
              <input value={draft.term} onChange={(event) => setDraft({ ...draft, term: event.target.value })} placeholder="الترم" />
              <input value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} placeholder="الموضوع" />
              <input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="الوحدة" />
              <input value={draft.lesson} onChange={(event) => setDraft({ ...draft, lesson: event.target.value })} placeholder="الدرس" />
              <input value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} placeholder="الصعوبة" />
              <input type="number" min="1" value={draft.maxScore} onChange={(event) => setDraft({ ...draft, maxScore: Number(event.target.value) })} placeholder="الدرجة" />
              <textarea
                style={{ gridColumn: '1/-1', minHeight: 110, padding: 11, border: '1px solid var(--line)', borderRadius: 10 }}
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                placeholder="نص السؤال"
              />
              <textarea
                style={{ gridColumn: '1/-1', minHeight: 130, padding: 11, border: '1px solid var(--line)', borderRadius: 10 }}
                value={draft.optionsText || ''}
                onChange={(event) => setDraft({ ...draft, optionsText: event.target.value })}
                placeholder="الاختيارات — سطر لكل اختيار"
              />
              <input value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} placeholder="الإجابة النصية أو التفسير" />
              <input type="number" min="0" value={draft.answerIndex} onChange={(event) => setDraft({ ...draft, answerIndex: Number(event.target.value) })} placeholder="رقم الإجابة الصحيحة" />
            </div>
            <div className="modal-actions">
              <button className="primary-btn" onClick={saveQuestion}>{editingId ? 'حفظ التعديل' : 'إضافة السؤال'}</button>
              <button className="secondary-btn" onClick={closeEditor}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
