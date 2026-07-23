import { useMemo, useState } from 'react';
import { questionBank } from '../data/questionBank';
import { buildAssessmentSummary, calculateQuestionOutcome, isAutoGradable, resolveExamQuestions } from '../services/assessment';
import { queueLowGradeNotification } from '../services/notifications';
import { todayISO } from '../utils/time';

const STATUS_CONFIG = {
  correct: { label: 'صحيح', factor: 1 },
  partial: { label: 'جزئي', factor: 0.5 },
  wrong: { label: 'خطأ', factor: 0 },
  blank: { label: 'لم يجب', factor: 0 }
};

const codeOf = (value) => {
  const match = String(value || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

export default function GradeScanner({ data, updateData }) {
  const [student, setStudent] = useState(null);
  const [manual, setManual] = useState('');
  const [examId, setExamId] = useState(data.exams?.[0]?.id || '');
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState(false);

  const exam = data.exams.find((item) => item.id === examId);
  const questions = useMemo(() => resolveExamQuestions(exam, [questionBank, data.customQuestionBank || []]), [exam, data.customQuestionBank]);
  const autoGradableCount = questions.filter(isAutoGradable).length;

  const choose = () => setStudent(data.students.find((s) => Number(s.code) === codeOf(manual)) || null);
  const setMark = (id, status) => setMarks((current) => ({ ...current, [id]: status }));

  const detail = questions.map((question) => calculateQuestionOutcome(question, marks[question.id] || 'blank'));
  const score = detail.reduce((sum, item) => sum + item.score, 0);
  const total = detail.reduce((sum, item) => sum + item.maxScore, 0);
  const pct = total ? Math.round((score / total) * 100) : 0;
  const summary = buildAssessmentSummary([{ pct }]);

  const save = () => {
    if (!student || !exam) return;
    const result = {
      id: Date.now(),
      studentId: student.id,
      examId: exam.id,
      exam: exam.title,
      score,
      total,
      date: todayISO(),
      questionResults: detail,
      pct
    };

    let next = {
      ...data,
      detailedResults: [...(data.detailedResults || []), result],
      grades: [
        ...data.grades,
        {
          id: result.id,
          studentId: student.id,
          exam: exam.title,
          score,
          total,
          date: result.date,
          strength: detail.filter((item) => item.status === 'correct').map((item) => item.topic).slice(0, 3).join('، '),
          weakness: detail.filter((item) => item.status !== 'correct').map((item) => item.topic).slice(0, 3).join('، ')
        }
      ]
    };

    next = queueLowGradeNotification(next, student, exam.title, result);
    updateData(next);
    setSaved(true);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">رصد سؤال بسؤال</span>
          <h2>رصد الدرجات بالكود</h2>
          <p>أدخل كود الطالب أو امسحه بالكاميرا داخل التطبيق، ثم حدّد نتيجة كل سؤال.</p>
        </div>
      </div>

      <div className="scanner-summary-grid">
        <div className="panel">
          <h3>اختيار الطالب</h3>
          {student ? (
            <div className="selected-student">
              <span className="student-code large-code">{student.code}</span>
              <div>
                <h3>{student.name}</h3>
                <p>{student.grade} — {student.group}</p>
              </div>
            </div>
          ) : (
            <div className="manual-code">
              <input inputMode="numeric" placeholder="كود الطالب" value={manual} onChange={(event) => setManual(event.target.value)} />
              <button className="primary-btn" onClick={choose}>اختيار</button>
            </div>
          )}
        </div>

        <div className="panel result-live-card">
          <span>النتيجة الحالية</span>
          <strong>{score}/{total}</strong>
          <b className={pct < 60 ? 'low-percentage' : 'good-percentage'}>{pct}%</b>
          <small>{autoGradableCount} سؤالًا من الامتحان قابلًا للتصحيح الآلي</small>
        </div>
      </div>

      <div className="panel exam-picker-panel">
        <label>الامتحان</label>
        <select value={examId} onChange={(event) => setExamId(event.target.value)}>
          {data.exams.filter((item) => !student || item.grade === student.grade).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>

      <div className="panel" style={{ marginBottom: 13 }}>
        <div className="panel-title">
          <h3>ملخص التحليل</h3>
          <span>{summary.totalStudents ? `${summary.average}% متوسط حفظ` : '—'}</span>
        </div>
        <div className="stats-grid compact">
          <div className="stat-card"><div><span>عدد الأسئلة</span><strong>{questions.length}</strong><small>في الامتحان الحالي</small></div></div>
          <div className="stat-card"><div><span>المصحح يدويًا</span><strong>{questions.length - autoGradableCount}</strong><small>أسئلة تحتاج مراجعة</small></div></div>
          <div className="stat-card"><div><span>درجة النجاح</span><strong>60%</strong><small>معيار المتابعة</small></div></div>
        </div>
      </div>

      <div className="question-marking-list">
        {questions.map((question, index) => (
          <article className="panel marking-question" key={question.id}>
            <header>
              <span className="question-number">{index + 1}</span>
              <div>
                <h3>{question.text}</h3>
                <p>{question.unit} • {question.lesson} • <b>{question.topic}</b></p>
              </div>
              <span className="question-max">{question.maxScore} درجة</span>
            </header>
            <div className="marking-options">
              {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                <button key={key} className={(marks[question.id] || 'blank') === key ? `active ${key}` : key} onClick={() => setMark(question.id, key)}>{value.label}</button>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="save-result-bar">
        <div>
          <span>الإجمالي</span>
          <strong>{score}/{total} — {pct}%</strong>
        </div>
        <button className="primary-btn" disabled={!student} onClick={save}>حفظ وتحليل الأخطاء</button>
      </div>

      {saved && <div className="success-result-banner">تم حفظ النتيجة وتجهيز التحليل والتنبيه عند أقل من 60%.</div>}
    </section>
  );
}
