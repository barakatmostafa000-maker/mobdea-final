import { CheckCircle2, Trash2, XCircle } from 'lucide-react';

export default function OcrQuestionReview({ questions = [], onChange }) {
  if (!questions.length) return null;
  const update = (id, patch) => onChange(questions.map((item) => item.id === id ? { ...item, ...patch } : item));
  const answerable = questions.filter((item) => String(item.answer || '').trim()).length;
  const approved = questions.filter((item) => item.approved && String(item.answer || '').trim()).length;

  return (
    <section className="span-2 ocr-review-panel" aria-label="مراجعة أسئلة OCR قبل الاعتماد">
      <header>
        <div><strong>مراجعة الأسئلة قبل الاعتماد</strong><small>{questions.length} سؤال • {answerable} بإجابة • {approved} معتمد للألعاب</small></div>
        <div>
          <button type="button" className="secondary-btn" onClick={() => onChange(questions.map((item) => ({ ...item, approved: Boolean(String(item.answer || '').trim()) })))}><CheckCircle2 size={15}/> اعتماد التي لها إجابة</button>
          <button type="button" className="secondary-btn" onClick={() => onChange(questions.map((item) => ({ ...item, approved: false })))}><XCircle size={15}/> إلغاء الاعتماد</button>
        </div>
      </header>
      <p>صحح نص السؤال والاختيارات والإجابة، ثم اعتمد السؤال. غير المعتمد أو الذي بلا إجابة لا يدخل بنك الألعاب.</p>
      <div className="ocr-review-list">
        {questions.map((item, index) => (
          <article key={item.id} className={item.approved ? 'approved' : ''}>
            <div className="ocr-review-meta"><b>سؤال {index + 1}</b><span>{item.page ? `صفحة ${item.page}` : 'الصفحة غير محددة'}</span><span>{item.sourceTitle || (item.sourceKind === 'exams' ? 'ملف الامتحانات' : 'كتاب الشرح')}</span><span>{item.grade || 'الصف غير محدد'}</span><span>{item.lesson || 'الدرس غير محدد'}</span>{item.sourceFileName && <span dir="ltr">{item.sourceFileName}</span>}</div>
            <label>السؤال<textarea rows="2" value={item.question || ''} onChange={(event) => update(item.id, { question: event.target.value, approved: false })}/></label>
            <label>الاختيارات<textarea rows="3" value={(item.options || []).join('\n')} onChange={(event) => update(item.id, { options: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean), approved: false })} placeholder="اختيار في كل سطر"/></label>
            <label>الإجابة<input value={item.answer || ''} onChange={(event) => update(item.id, { answer: event.target.value, approved: false })} placeholder="الإجابة الصحيحة"/></label>
            <footer>
              <label className="ocr-approve-check"><input type="checkbox" checked={Boolean(item.approved)} disabled={!String(item.question || '').trim() || !String(item.answer || '').trim()} onChange={(event) => update(item.id, { approved: event.target.checked })}/> اعتماد هذا السؤال للألعاب</label>
              <button type="button" className="icon-action danger-text" title="حذف السؤال" onClick={() => onChange(questions.filter((entry) => entry.id !== item.id))}><Trash2 size={16}/></button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
