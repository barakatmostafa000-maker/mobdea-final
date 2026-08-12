import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Gamepad2, RefreshCw, Trophy, Users, XCircle } from 'lucide-react';
import { selectQuestionRound } from '../../services/questionRotation';

function answerOptions(question) {
  if (!question || typeof question !== 'object') return [];
  if (Array.isArray(question.options) && question.options.length) return question.options;
  if (question.type === 'tf') return ['صح', 'خطأ'];
  return [];
}

function isCorrect(question, answer, index) {
  if (Number.isInteger(question.answerIndex)) return Number(index) === Number(question.answerIndex);
  return String(answer || '').trim() === String(question.answer || '').trim();
}

export default function ClassroomGamePanel({
  questions = [],
  students = [],
  history = [],
  selectedStudentId = '',
  onSelectStudent,
  onAwardPoint,
  onQuestionUsed,
  onCreateOnlineChallenge,
  onlineBusy = false,
}) {
  const [round, setRound] = useState([]);
  const [index, setIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const reportedQuestionIdsRef = useRef(new Set());

  const compatible = useMemo(() => questions.filter((question) => (
    question && typeof question === 'object' && (
      ['mcq', 'tf'].includes(question.type) || (Array.isArray(question.options) && question.options.length)
    )
  )), [questions]);

  const startRound = () => {
    setRound(selectQuestionRound(compatible, history, Math.min(10, compatible.length || 1)));
    setIndex(0);
    setLocked(false);
    setFeedback('');
    setScore(0);
  };

  useEffect(() => {
    startRound();
  }, [compatible.map((question) => question.id).join('|')]);

  const current = round[index] || null;

  useEffect(() => {
    const id = String(current?.id || '');
    if (!id || reportedQuestionIdsRef.current.has(id)) return;
    reportedQuestionIdsRef.current.add(id);
    onQuestionUsed?.(id);
  }, [current?.id, onQuestionUsed]);
  const options = answerOptions(current);
  const activeStudent = students.find((student) => String(student.id) === String(selectedStudentId)) || students[0] || null;

  const answer = (value, optionIndex) => {
    if (!current || locked) return;
    const correct = isCorrect(current, value, optionIndex);
    setLocked(true);
    setFeedback(correct ? 'إجابة صحيحة — تمت إضافة نقطة.' : `الإجابة الصحيحة: ${current.answer || options[current.answerIndex] || 'راجع السؤال'}`);
    if (correct) {
      setScore((currentScore) => currentScore + 1);
      if (activeStudent) onAwardPoint?.(activeStudent, 1);
    }
  };

  const move = (direction) => {
    if (!round.length) return;
    setIndex((currentIndex) => (currentIndex + direction + round.length) % round.length);
    setLocked(false);
    setFeedback('');
  };

  if (!compatible.length) {
    return <div className="classmode-game-panel classmode-game-empty"><Gamepad2 size={54}/><h3>لا توجد أسئلة جاهزة لهذا الدرس</h3><p>احفظ أسئلة نهاية الدرس أو ملف الامتحانات في المكتبة، ثم ارجع إلى الحصة.</p></div>;
  }

  return (
    <section className="classmode-game-panel">
      <header className="classmode-game-head">
        <div><span>ألعاب الدرس داخل الحصة</span><h3>{current?.lesson || 'تقويم سريع'}</h3></div>
        <div className="classmode-game-score"><Trophy size={19}/><b>{score}</b><small>نقاط الجولة</small></div>
      </header>

      <div className="classmode-game-controls">
        <label><Users size={16}/><span>الطالب</span><select value={activeStudent?.id || ''} onChange={(event) => onSelectStudent?.(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
        <button type="button" className="secondary-btn" onClick={startRound}><RefreshCw size={16}/> جولة جديدة بلا تكرار</button>
        <button type="button" className="primary-btn" disabled={onlineBusy || students.length < 2} onClick={() => onCreateOnlineChallenge?.()}><Copy size={16}/> {onlineBusy ? 'جارٍ إنشاء الرابط…' : 'رابط لعبة للطلاب'}</button>
      </div>

      <div className="classmode-game-question">
        <div className="classmode-game-progress"><span>{index + 1} من {round.length}</span><b>{current?.topic || current?.sourceLabel || 'أسئلة الدرس'}</b></div>
        <h2>{current?.text}</h2>
        <div className="classmode-game-options">
          {options.map((option, optionIndex) => {
            const correct = locked && isCorrect(current, option, optionIndex);
            return <button key={`${option}-${optionIndex}`} type="button" disabled={locked} className={correct ? 'correct' : ''} onClick={() => answer(option, optionIndex)}>{correct ? <CheckCircle2 size={18}/> : locked ? <XCircle size={18}/> : null}<span>{option}</span></button>;
          })}
        </div>
        {feedback && <div className={feedback.startsWith('إجابة صحيحة') ? 'classmode-game-feedback correct' : 'classmode-game-feedback'}>{feedback}</div>}
      </div>

      <footer className="classmode-game-footer">
        <button type="button" onClick={() => move(-1)}><ChevronRight size={18}/> السابق</button>
        <button type="button" onClick={() => move(1)}>التالي <ChevronLeft size={18}/></button>
      </footer>
    </section>
  );
}
