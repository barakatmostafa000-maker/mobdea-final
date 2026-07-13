
import { useMemo, useState } from 'react';
import { filterQuestions, gradeOptions } from '../data/questionBank';
import { encourageStudent } from '../services/voice';

const modes = [
  { id: 'speed', title: 'تحدي السرعة', icon: '⚡', description: 'أسئلة سريعة مع مؤقت ونقاط متتالية.' },
  { id: 'wheel', title: 'عجلة الحظ', icon: '🎡', description: 'اختيار سؤال عشوائي ومكافأة متغيرة.' },
  { id: 'truefalse', title: 'صح أم خطأ', icon: '✅', description: 'جولة سريعة من أسئلة الصواب والخطأ.' },
  { id: 'character', title: 'من الشخصية؟', icon: '🕵️', description: 'اكتشف الشخصية من الأدلة.' },
  { id: 'timeline', title: 'الخط الزمني', icon: '🕰️', description: 'رتب الأحداث من الأقدم إلى الأحدث.' },
  { id: 'battle', title: 'مواجهة طالبين', icon: '⚔️', description: 'نقاط لكل طالب في جولة تنافسية.' }
];

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function nonRepeatedPool(items, history) {
  const unseen = items.filter((item) => !history.includes(item.id));
  return unseen.length >= 3 ? unseen : items;
}

export default function Games({ data, updateData }) {
  const [gradeKey, setGradeKey] = useState('6');
  const [unit, setUnit] = useState('all');
  const [mode, setMode] = useState(null);
  const [round, setRound] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [playerOne, setPlayerOne] = useState(data.students[0]?.id || '');
  const [playerTwo, setPlayerTwo] = useState(data.students[1]?.id || '');
  const [battleScores, setBattleScores] = useState({ one: 0, two: 0 });
  const [activePlayer, setActivePlayer] = useState('one');
  const [timelineOrder, setTimelineOrder] = useState([]);
  const [characterGuess, setCharacterGuess] = useState('');
  const history = data.gameQuestionHistory || [];

  const units = useMemo(() => {
    const list = filterQuestions({ gradeKey });
    return [...new Set(list.map((q) => q.unit))];
  }, [gradeKey]);

  const filtered = useMemo(() => filterQuestions({ gradeKey, unit }), [gradeKey, unit]);

  const current = round[index];

  const startMode = (selectedMode) => {
    let pool = filtered;
    if (selectedMode === 'truefalse') pool = filtered.filter((q) => q.type === 'tf');
    else if (selectedMode === 'character') pool = filtered.filter((q) => q.type === 'character');
    else if (selectedMode === 'timeline') pool = filtered.filter((q) => q.type === 'timeline');
    else pool = filtered.filter((q) => q.type === 'mcq');

    pool = nonRepeatedPool(pool, history);
    if (!pool.length) {
      setFeedback('لا توجد أسئلة كافية لهذا الاختيار.');
      return;
    }

    const count = selectedMode === 'timeline' || selectedMode === 'character' ? Math.min(3, pool.length) : Math.min(7, pool.length);
    const picked = shuffled(pool).slice(0, count);
    setMode(selectedMode);
    setRound(picked);
    setIndex(0);
    setScore(0);
    setCombo(0);
    setLocked(false);
    setFeedback('');
    setBattleScores({ one: 0, two: 0 });
    setActivePlayer('one');
    setTimelineOrder(picked[0]?.events ? shuffled(picked[0].events) : []);
    setCharacterGuess('');
  };

  const persistHistory = (questionId) => {
    const next = [...history.filter((id) => id !== questionId), questionId].slice(-20);
    updateData({ ...data, gameQuestionHistory: next });
  };

  const answerChoice = (choiceIndex) => {
    if (locked || !current) return;
    setLocked(true);
    const correct = choiceIndex === current.answerIndex;
    persistHistory(current.id);

    if (mode === 'battle') {
      const key = activePlayer;
      setBattleScores((previous) => ({ ...previous, [key]: previous[key] + (correct ? 10 : 0) }));
      setFeedback(correct ? 'إجابة صحيحة +10 نقاط' : `الإجابة الصحيحة: ${current.answer}`);
    } else {
      if (correct) {
        const bonus = 10 + Math.min(combo, 5) * 2;
        setScore((value) => value + bonus);
        setCombo((value) => value + 1);
        setFeedback(`رائع! +${bonus} نقطة`);
      } else {
        setCombo(0);
        setFeedback(`الإجابة الصحيحة: ${current.answer} — راجع: ${current.topic}`);
      }
    }
  };

  const answerTrueFalse = (value) => {
    answerChoice(value === 'صح' ? 0 : 1);
  };

  const submitCharacter = () => {
    if (!current || locked) return;
    setLocked(true);
    persistHistory(current.id);
    const correct = characterGuess.trim() === current.answer.trim();
    if (correct) {
      setScore((value) => value + 15);
      setCombo((value) => value + 1);
      setFeedback('ممتاز! اكتشفت الشخصية.');
    } else {
      setCombo(0);
      setFeedback(`الشخصية هي: ${current.answer}`);
    }
  };

  const moveTimeline = (event, direction) => {
    setTimelineOrder((previous) => {
      const copy = [...previous];
      const currentIndex = copy.indexOf(event);
      const target = currentIndex + direction;
      if (target < 0 || target >= copy.length) return previous;
      [copy[currentIndex], copy[target]] = [copy[target], copy[currentIndex]];
      return copy;
    });
  };

  const submitTimeline = () => {
    if (!current || locked) return;
    setLocked(true);
    persistHistory(current.id);
    const correct = timelineOrder.every((event, i) => event === current.events[i]);
    if (correct) {
      setScore((value) => value + 20);
      setCombo((value) => value + 1);
      setFeedback('ترتيب صحيح بالكامل +20 نقطة');
    } else {
      setCombo(0);
      setFeedback(`الترتيب الصحيح: ${current.events.join(' ← ')}`);
    }
  };

  const nextQuestion = () => {
    if (index >= round.length - 1) {
      finishRound();
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setLocked(false);
    setFeedback('');
    setTimelineOrder(round[nextIndex]?.events ? shuffled(round[nextIndex].events) : []);
    setCharacterGuess('');
    if (mode === 'battle') setActivePlayer((value) => value === 'one' ? 'two' : 'one');
  };

  const finishRound = () => {
    const result = {
      id: Date.now(),
      studentId: Number(playerOne) || null,
      secondStudentId: mode === 'battle' ? Number(playerTwo) || null : null,
      mode,
      gradeKey,
      score: mode === 'battle' ? battleScores.one : score,
      secondScore: mode === 'battle' ? battleScores.two : null,
      date: new Date().toISOString().slice(0, 10)
    };
    updateData({ ...data, gameResults: [...(data.gameResults || []), result] });
    setMode('result');
  };

  const selectedStudent = data.students.find((s) => s.id === Number(playerOne));
  const secondStudent = data.students.find((s) => s.id === Number(playerTwo));

  if (mode === 'result') {
    return <section className="page">
      <div className="panel game-result-screen">
        <div className="game-result-icon">🏆</div>
        <h2>انتهت الجولة</h2>
        {battleScores.one || battleScores.two ? (
          <p>{selectedStudent?.name}: {battleScores.one} نقطة — {secondStudent?.name}: {battleScores.two} نقطة</p>
        ) : <p>النتيجة: {score} نقطة</p>}
        <button className="primary-btn" onClick={() => setMode(null)}>العودة للألعاب</button>
      </div>
    </section>;
  }

  if (mode && current) {
    return <section className="page">
      <div className="game-stage-header">
        <button className="secondary-btn" onClick={() => setMode(null)}>خروج</button>
        <div><span>السؤال {index + 1} من {round.length}</span><strong>{mode === 'battle' ? `${battleScores.one} : ${battleScores.two}` : `${score} نقطة`}</strong></div>
        <div className="combo-badge">🔥 Combo {combo}</div>
      </div>

      <article className="panel professional-game-board">
        {mode === 'battle' && <div className="active-player-banner">الدور على: {activePlayer === 'one' ? selectedStudent?.name : secondStudent?.name}</div>}
        <span className="eyebrow">{current.unit} • {current.lesson}</span>
        <h2>{current.text}</h2>

        {(mode === 'speed' || mode === 'wheel' || mode === 'battle') && (
          <div className="pro-answer-grid">
            {current.options.map((option, optionIndex) => (
              <button key={option} disabled={locked} onClick={() => answerChoice(optionIndex)}
                className={locked && optionIndex === current.answerIndex ? 'correct' : ''}>
                {option}
              </button>
            ))}
          </div>
        )}

        {mode === 'truefalse' && <div className="tf-buttons">
          <button disabled={locked} onClick={() => answerTrueFalse('صح')}>صح</button>
          <button disabled={locked} onClick={() => answerTrueFalse('خطأ')}>خطأ</button>
        </div>}

        {mode === 'character' && <div className="character-panel">
          <div className="clues">{current.clues.map((clue, i) => <span key={clue}>الدليل {i + 1}: {clue}</span>)}</div>
          <input value={characterGuess} onChange={(e) => setCharacterGuess(e.target.value)} placeholder="اكتب اسم الشخصية"/>
          <button className="primary-btn" disabled={locked || !characterGuess.trim()} onClick={submitCharacter}>تأكيد الإجابة</button>
        </div>}

        {mode === 'timeline' && <div className="timeline-panel">
          {timelineOrder.map((event, i) => <div className="timeline-event" key={event}>
            <span>{i + 1}</span><strong>{event}</strong>
            <div><button onClick={() => moveTimeline(event, -1)}>↑</button><button onClick={() => moveTimeline(event, 1)}>↓</button></div>
          </div>)}
          <button className="primary-btn" disabled={locked} onClick={submitTimeline}>تحقق من الترتيب</button>
        </div>}

        {feedback && <div className={`game-feedback ${feedback.includes('صحيحة') || feedback.includes('رائع') || feedback.includes('ممتاز') || feedback.includes('صحيح بالكامل') ? 'good' : 'bad'}`}>{feedback}</div>}
        {locked && <button className="primary-btn next-game-btn" onClick={nextQuestion}>{index === round.length - 1 ? 'إنهاء الجولة' : 'السؤال التالي'}</button>}
      </article>
    </section>;
  }

  return <section className="page">
    <div className="page-heading">
      <div><span className="eyebrow">محرك ألعاب متنوع</span><h2>الألعاب التعليمية</h2><p>أسئلة حسب الصف والوحدة مع منع التكرار وجولات متعددة.</p></div>
    </div>

    <div className="panel game-control-panel">
      <select value={gradeKey} onChange={(e) => { setGradeKey(e.target.value); setUnit('all'); }}>
        {gradeOptions.map((grade) => <option key={grade.key} value={grade.key}>{grade.label}</option>)}
      </select>
      <select value={unit} onChange={(e) => setUnit(e.target.value)}>
        <option value="all">كل الوحدات</option>
        {units.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={playerOne} onChange={(e) => setPlayerOne(e.target.value)}>
        {data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
      </select>
      <select value={playerTwo} onChange={(e) => setPlayerTwo(e.target.value)}>
        {data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
      </select>
    </div>

    <div className="professional-games-grid">
      {modes.map((item) => <button className="pro-game-card" key={item.id} onClick={() => startMode(item.id)}>
        <span>{item.icon}</span><h3>{item.title}</h3><p>{item.description}</p>
      </button>)}
    </div>

    <div className="panel question-bank-summary">
      <strong>الأسئلة المتاحة لهذا الاختيار: {filtered.length}</strong>
      <span>تم حفظ آخر 20 سؤالًا لمنع تكرارها في الجولات القريبة.</span>
    </div>
  </section>;
}
