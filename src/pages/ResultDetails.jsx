// PROJECT13_EXAM_ERROR_ANALYTICS_V1
import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, FileText, Filter, Users } from 'lucide-react';
import { useAssetUrl } from '../hooks/useAssetUrl';
import { buildExamErrorIndex, wrongQuestionResults } from '../services/project13ExamAnalytics';

const statusLabel = { wrong: 'خطأ', partial: 'جزئي', blank: 'بدون إجابة', correct: 'صحيح' };

export default function ResultDetails({ data }) {
  const [id, setId] = useState(data.detailedResults?.[0]?.id || '');
  const [wrongOnly, setWrongOnly] = useState(true);
  const result = (data.detailedResults || []).find((item) => String(item.id) === String(id));
  const student = data.students.find((item) => String(item.id) === String(result?.studentId));
  const sourceUrl = useAssetUrl(result?.sourceExamAssetId, result?.sourceExamUrl);

  const visibleRows = useMemo(() => {
    if (!result) return [];
    return wrongOnly
      ? wrongQuestionResults(result)
      : (result.questionResults || []).map((item, index) => ({ ...item, questionNumber: index + 1 }));
  }, [result, wrongOnly]);

  const weakTopics = useMemo(() => {
    const count = {};
    for (const item of wrongQuestionResults(result || {})) {
      const key = [item.unit, item.lesson, item.topic].filter(Boolean).join(' — ') || 'عام';
      count[key] = (count[key] || 0) + 1;
    }
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
  }, [result]);

  const aggregate = useMemo(
    () => buildExamErrorIndex(data.detailedResults || [], result?.examId || ''),
    [data.detailedResults, result?.examId],
  );

  return (
    <section className="page project13-result-details">
      <div className="page-heading"><div><span className="eyebrow">تحليل سؤال بسؤال</span><h2>الأخطاء مباشرة</h2><p>اختر نتيجة؛ الأسئلة الخطأ تظهر أولًا، ومعها أكثر أسئلة الامتحان خطأً عند كل الطلاب.</p></div></div>

      <div className="panel project13-result-toolbar">
        <label>اختر نتيجة
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {(data.detailedResults || []).map((item) => <option key={item.id} value={item.id}>{data.students.find((s) => String(s.id) === String(item.studentId))?.name} — {item.exam}</option>)}
          </select>
        </label>
        <button type="button" className={wrongOnly ? 'secondary-btn active' : 'secondary-btn'} onClick={() => setWrongOnly((value) => !value)}>
          <Filter size={16}/> {wrongOnly ? 'عرض الأخطاء فقط' : 'عرض كل الأسئلة'}
        </button>
        {sourceUrl && <a className="secondary-btn" href={sourceUrl} target="_blank" rel="noopener noreferrer"><FileText size={16}/> ملف الامتحانات <ExternalLink size={13}/></a>}
      </div>

      {!result ? <div className="panel empty-state">لا توجد نتائج تفصيلية بعد.</div> : (
        <>
          <div className="project13-error-summary">
            <article className="panel"><span>الطالب</span><strong>{student?.name || result.studentName}</strong><small>كود {student?.code || result.studentCode}</small></article>
            <article className="panel"><span>الدرجة</span><strong>{result.score}/{result.total}</strong><small>{result.pct}%</small></article>
            <article className="panel error"><span>الأسئلة غير الصحيحة</span><strong>{wrongQuestionResults(result).length}</strong><small>من {result.questionResults?.length || 0}</small></article>
          </div>

          <div className="result-details-layout">
            <div className="panel">
              <h3>{wrongOnly ? 'الأسئلة الخطأ والمحتاجة مراجعة' : 'كل أسئلة النتيجة'}</h3>
              {visibleRows.length ? visibleRows.map((item) => (
                <div className={`result-question-row ${item.status}`} key={`${item.questionId}-${item.questionNumber}`}>
                  <span>{item.questionNumber}</span>
                  <div><strong>{item.questionText}</strong><small>{item.unit} • {item.lesson} • {item.topic}</small></div>
                  <b>{statusLabel[item.status] || item.status} — {item.score}/{item.maxScore}</b>
                </div>
              )) : <div className="empty-state">لا توجد أخطاء في هذه النتيجة.</div>}
            </div>

            <div className="project13-analysis-side">
              <article className="panel">
                <h3><AlertTriangle size={17}/> أكثر أسئلة الامتحان خطأً</h3>
                {aggregate.slice(0, 12).map((item) => (
                  <div className="project13-question-error-row" key={item.questionId || item.questionNumber}>
                    <span><b>س{item.questionNumber}</b><strong>{item.questionText}</strong><small>{item.topic || item.lesson}</small></span>
                    <em>{item.totalErrors} خطأ</em>
                    <small><Users size={12}/> {item.students.map((s) => s.code || s.name).filter(Boolean).join('، ')}</small>
                  </div>
                ))}
                {!aggregate.length && <div className="empty-state">لا توجد أخطاء مجمعة.</div>}
              </article>

              <article className="panel">
                <h3>الموضوعات الضعيفة</h3>
                {weakTopics.length ? weakTopics.map(([topic, count]) => <div className="weak-topic-row" key={topic}><span>{topic}</span><b>{count} خطأ</b></div>) : <div className="empty-state">لا توجد أخطاء.</div>}
              </article>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
