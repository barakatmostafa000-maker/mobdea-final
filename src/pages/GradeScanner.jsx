import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CircleCheckBig, ScanLine, X } from 'lucide-react';
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

const parseQRStudent = (raw) => {
  if (!raw) return null;
  const text = String(raw).trim();

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && (parsed.code || parsed.name)) {
      return parsed;
    }
  } catch {}

  try {
    if (text.startsWith('mobdea://student/')) {
      const url = new URL(text);
      return {
        code: codeOf(url.pathname || url.host),
        name: url.searchParams.get('name') || '',
        grade: url.searchParams.get('grade') || '',
      };
    }
  } catch {}

  const code = codeOf(text);
  if (code) return { code };
  return { name: text };
};

export default function GradeScanner({ data, updateData }) {
  const [student, setStudent] = useState(null);
  const [manual, setManual] = useState('');
  const [examId, setExamId] = useState(data.exams?.[0]?.id || '');
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(0);

  const exam = data.exams.find((item) => item.id === examId);
  const questions = useMemo(() => resolveExamQuestions(exam, [questionBank, data.customQuestionBank || []]), [exam, data.customQuestionBank]);
  const autoGradableCount = questions.filter(isAutoGradable).length;

  useEffect(() => {
    if (!scannerOpen) return;
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  const stopScanner = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    try {
      detectorRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch {}
    setScannerOpen(false);
  };

  const choose = () => {
    const found = data.students.find((s) => Number(s.code) === codeOf(manual) || String(s.name).includes(manual.trim()));
    setStudent(found || null);
    setSaved(false);
  };

  const selectStudentFromQR = (payload) => {
    const code = codeOf(payload?.code ?? payload?.studentCode ?? payload?.id ?? '');
    const name = String(payload?.name || payload?.studentName || '').trim();
    const found = data.students.find((s) => (code && Number(s.code) === code) || (name && s.name.includes(name)));
    if (found) {
      setStudent(found);
      setManual(String(found.code));
      setScannerStatus(`تم اختيار ${found.name}`);
      setScannerOpen(false);
      stopScanner();
    } else {
      setScannerStatus('تمت قراءة الكود ولكن لم يتم العثور على الطالب.');
      if (code) setManual(String(code));
    }
  };

  const startScanner = async () => {
    setScannerError('');
    setScannerStatus('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('الكاميرا غير مدعومة على هذا الجهاز.');
      return;
    }
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      if ('BarcodeDetector' in window) {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] });
      } else {
        detectorRef.current = null;
        setScannerError('المتصفح لا يدعم BarcodeDetector؛ استخدم الإدخال اليدوي أو جرّب APK على الجهاز.');
      }
      const loop = async () => {
        if (!scannerOpen || !videoRef.current) return;
        try {
          if (detectorRef.current && videoRef.current.readyState >= 2) {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes?.length) {
              const raw = codes[0].rawValue || '';
              const payload = parseQRStudent(raw);
              if (payload) selectStudentFromQR(payload);
              return;
            }
          }
        } catch (error) {
          setScannerError(error.message || 'تعذر قراءة QR.');
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (error) {
      setScannerError(error.message || 'تعذر تشغيل الكاميرا.');
      stopScanner();
    }
  };

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
      studentName: student.name,
      studentCode: student.code,
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
          studentName: student.name,
          studentCode: student.code,
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
        <button className="secondary-btn" onClick={startScanner}><Camera size={18} /> مسح QR بالكاميرا</button>
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
              <input inputMode="numeric" placeholder="كود الطالب أو الاسم" value={manual} onChange={(event) => setManual(event.target.value)} />
              <button className="primary-btn" onClick={choose}>اختيار</button>
            </div>
          )}
          {scannerStatus && <div className="success-result-banner" style={{ marginTop: 10 }}>{scannerStatus}</div>}
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

      {scannerOpen && (
        <div className="modal-backdrop">
          <div className="modal-card scanner-modal">
            <div className="panel-title">
              <h3>مسح QR</h3>
              <button className="text-btn" onClick={stopScanner}><X size={18} /> إغلاق</button>
            </div>
            <video ref={videoRef} className="scanner-video" muted playsInline />
            <p className="settings-help">وجّه الكاميرا نحو كارت الطالب أو الكود المطبوع.</p>
            {scannerError && <div className="settings-notice">{scannerError}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
