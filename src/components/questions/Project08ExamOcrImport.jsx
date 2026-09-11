// PROJECT08_OCR_EXAM_IMPORT_V1
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ScanText, XCircle, Trash2 } from 'lucide-react';
import { extractQuestionsFromPdfAsset } from '../../services/pdfQuestionOcr';
import {
  buildOcrImportCandidates,
  dedupeImportedQuestions,
  isQuestionReadyForGame,
} from '../../services/project08QuestionImport';

function withAnswer(question, value) {
  const answer = String(value || '').trim();
  const options = Array.isArray(question.options) ? question.options : [];
  const index = options.findIndex((option) => String(option).trim() === answer);
  return {
    ...question,
    answer,
    answerIndex: question.type === 'mcq'
      ? index
      : question.type === 'tf'
        ? (answer === 'صح' ? 0 : answer === 'خطأ' ? 1 : -1)
        : -1,
    needsAnswer: !answer || (question.type === 'mcq' && index < 0),
    approved: false,
  };
}

export default function Project08ExamOcrImport({
  resource,
  gradeKey,
  gradeLabel,
  existingQuestions = [],
  onImport,
}) {
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(4);
  const [unit, setUnit] = useState('مستورد من ملف الامتحانات');
  const [lesson, setLesson] = useState('أسئلة مستوردة');
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const controllerRef = useRef(null);

  const duplicateState = useMemo(
    () => dedupeImportedQuestions(questions, existingQuestions),
    [questions, existingQuestions],
  );
  const ready = duplicateState.accepted.filter((question) => question.approved && isQuestionReadyForGame(question));
  const pending = duplicateState.accepted.filter((question) => !isQuestionReadyForGame(question));

  const extract = async () => {
    if (!resource?.assetId || !gradeKey || gradeKey === 'all') {
      setStatus('اختر الصف وارفع ملف الامتحانات الرئيسي أولًا.');
      return;
    }
    const first = Math.max(1, Number(startPage || 1));
    const last = Math.max(first, Number(endPage || first));
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setQuestions([]);
    setStatus('جارٍ تجهيز ملف الامتحانات لمحرك OCR...');
    try {
      const result = await extractQuestionsFromPdfAsset({
        assetId: resource.assetId,
        startPage: first,
        endPage: last,
        signal: controller.signal,
        onProgress: ({ stage, page }) => {
          if (stage === 'staging-file') setStatus('جارٍ نقل الملف إلى محرك Android على دفعات آمنة...');
          else if (stage === 'retrying-bitmap') setStatus(`تعذر قراءة الـ bitmap بالحجم الأول؛ إعادة محاولة الصفحة ${page || first} بحجم أكثر أمانًا...`);
          else if (stage === 'rendering') setStatus(`جارٍ تجهيز الصفحة ${page || first}...`);
          else setStatus(`جارٍ قراءة الصفحة ${page || first} واستخراج الأسئلة...`);
        },
      });
      const candidates = buildOcrImportCandidates(result.questions, {
        gradeKey,
        grade: gradeLabel,
        unit,
        lesson,
        topic: 'أسئلة الامتحانات',
        sourceResourceId: resource.id,
        sourceAssetId: resource.assetId,
        sourceFileName: resource.fileName,
      });
      setQuestions(candidates);
      const missing = candidates.filter((question) => !isQuestionReadyForGame(question)).length;
      setStatus(`تم استخراج ${candidates.length} سؤالًا. ${missing ? `${missing} سؤال بلا إجابة مؤكدة ويحتاج إدخالها قبل الإضافة.` : 'كل الأسئلة المستخرجة لها إجابات قابلة للمراجعة.'}`);
    } catch (error) {
      setStatus(error?.name === 'AbortError' ? 'تم إلغاء OCR.' : (error?.message || 'تعذر استخراج الأسئلة.'));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setRunning(false);
    }
  };

  const patchQuestion = (id, patch) => {
    setQuestions((current) => current.map((question) => {
      if (question.id !== id) return question;
      const next = { ...question, ...patch };
      if ('answer' in patch) return withAnswer(next, patch.answer);
      return { ...next, approved: false };
    }));
  };

  const commit = () => {
    const complete = duplicateState.accepted.filter(
      (question) => question.approved && isQuestionReadyForGame(question),
    );
    if (!complete.length) {
      setStatus('لا يوجد سؤال مكتمل ومعتمد يمكن إضافته. أدخل الإجابات الناقصة ثم اعتمد الأسئلة.');
      return;
    }
    onImport?.(complete.map((question) => ({ ...question, needsAnswer: false })));
    setQuestions((current) => current.filter(
      (question) => !complete.some((done) => done.id === question.id),
    ));
    setStatus(`تم إرسال ${complete.length} سؤالًا مكتملًا إلى بنك الأسئلة والألعاب.`);
  };

  return (
    <section className="panel project08-ocr-import-panel" aria-label="استيراد أسئلة ملف الامتحانات بالـ OCR">
      <header>
        <div>
          <span className="eyebrow"><ScanText size={15}/> OCR ملف الامتحانات</span>
          <h3>استخراج السؤال والاختيارات والإجابة تلقائيًا</h3>
          <p>لو الإجابة غير موجودة في الصفحات، المنصة لا تخمّنها: السؤال يظل «مطلوب إجابة» حتى تدخل الإجابة الصحيحة بنفسك.</p>
        </div>
        <div className="project08-ocr-source">
          <strong>{resource?.fileName || 'لا يوجد ملف امتحانات للصف المختار'}</strong>
          <small>{gradeLabel || 'اختر الصف أولًا'}</small>
        </div>
      </header>

      <div className="project08-ocr-controls">
        <label><span>من صفحة</span><input type="number" min="1" value={startPage} onChange={(event) => setStartPage(Number(event.target.value))}/></label>
        <label><span>إلى صفحة</span><input type="number" min={startPage || 1} value={endPage} onChange={(event) => setEndPage(Number(event.target.value))}/></label>
        <label><span>الوحدة</span><input value={unit} onChange={(event) => setUnit(event.target.value)}/></label>
        <label><span>الدرس</span><input value={lesson} onChange={(event) => setLesson(event.target.value)}/></label>
        <button type="button" className="primary-btn" disabled={running || !resource?.assetId || !gradeKey || gradeKey === 'all'} onClick={() => void extract()}>
          <ScanText size={16}/>{running ? 'جارٍ الاستخراج…' : 'استخراج الأسئلة'}
        </button>
        {running && <button type="button" className="secondary-btn" onClick={() => controllerRef.current?.abort()}><XCircle size={16}/> إلغاء</button>}
      </div>

      {status && <div className="project08-ocr-status">{status}</div>}

      {questions.length > 0 && (
        <>
          <div className="project08-import-summary">
            <span><CheckCircle2 size={15}/> معتمد وجاهز: <b>{ready.length}</b></span>
            <span className={pending.length ? 'warn' : ''}><AlertTriangle size={15}/> يحتاج إجابة: <b>{pending.length}</b></span>
            <span>مكرر ومرفوض تلقائيًا: <b>{duplicateState.duplicates.length}</b></span>
          </div>

          <div className="project08-import-list">
            {questions.map((question, index) => {
              const duplicate = duplicateState.duplicates.some((item) => item.id === question.id);
              const needsAnswer = !isQuestionReadyForGame(question);
              return (
                <article key={question.id} className={`${needsAnswer ? 'needs-answer' : 'answer-ready'} ${duplicate ? 'duplicate' : ''}`}>
                  <header>
                    <span>سؤال {index + 1}{question.ocrPage ? ` — صفحة ${question.ocrPage}` : ''}</span>
                    {duplicate ? <b className="duplicate-badge">مكرر — لن يضاف</b> : needsAnswer ? <b className="answer-required-badge">مطلوب إجابة</b> : <b className="ready-badge">الإجابة مكتملة</b>}
                  </header>

                  <label>نص السؤال<textarea rows="2" value={question.text} onChange={(event) => patchQuestion(question.id, { text: event.target.value })}/></label>
                  {question.options.length > 0 && (
                    <label>الاختيارات<textarea rows="4" value={question.options.join('\n')} onChange={(event) => patchQuestion(question.id, {
                      options: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean),
                      answer: '',
                      answerIndex: -1,
                      needsAnswer: true,
                    })}/></label>
                  )}

                  {question.options.length > 0 ? (
                    <label>
                      <span>الإجابة الصحيحة {needsAnswer && <em>— مطلوبة قبل الإضافة</em>}</span>
                      <select value={question.answer || ''} onChange={(event) => patchQuestion(question.id, { answer: event.target.value })}>
                        <option value="">— اختر الإجابة الصحيحة —</option>
                        {question.options.map((option) => <option value={option} key={option}>{option}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label>
                      <span>الإجابة الصحيحة {needsAnswer && <em>— مطلوبة قبل الإضافة</em>}</span>
                      <input value={question.answer || ''} onChange={(event) => patchQuestion(question.id, { answer: event.target.value })} placeholder="اكتب الإجابة الصحيحة"/>
                    </label>
                  )}

                  <footer>
                    <label className="project08-approve">
                      <input
                        type="checkbox"
                        checked={Boolean(question.approved && !needsAnswer)}
                        disabled={duplicate || needsAnswer}
                        onChange={(event) => patchQuestion(question.id, { approved: event.target.checked })}
                      />
                      اعتماد هذا السؤال
                    </label>
                    <button type="button" className="icon-action danger-text" onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}><Trash2 size={14}/> حذف</button>
                  </footer>
                </article>
              );
            })}
          </div>

          <div className="project08-import-actions">
            <button type="button" className="secondary-btn" onClick={() => setQuestions((current) => current.map((question) => ({
              ...question,
              approved: isQuestionReadyForGame(question),
            })))}><CheckCircle2 size={16}/> اعتماد كل المكتمل</button>
            <button type="button" className="primary-btn" disabled={!ready.length} onClick={commit}>إضافة المكتمل لبنك الأسئلة والألعاب</button>
          </div>
        </>
      )}
    </section>
  );
}
