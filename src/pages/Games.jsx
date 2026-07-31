import { useEffect, useMemo, useState } from 'react';
import { buildShareLink, copyToClipboard } from '../services/share';
import { questionBank, gradeOptions } from '../data/questionBank';
import { mergeQuestionBanks } from '../services/assessment';
import { encourageStudent, playVoiceClip } from '../services/voice';
import OnlineGameHostPanel from '../components/live/OnlineGameHostPanel';

const modes = [
  ['speed', '⚡', 'تحدي السرعة', 'أسئلة متتالية مع مؤقت وCombo.'],
  ['wheel', '🎡', 'عجلة الحظ', 'مكافأة عشوائية وسؤال مفاجئ.'],
  ['truefalse', '✅', 'صح أم خطأ', 'جولة سريعة مركزة.'],
  ['character', '🕵️', 'من الشخصية؟', 'اكتشف الشخصية من الأدلة.'],
  ['timeline', '🕰️', 'الخط الزمني', 'رتب الأحداث تاريخيًا.'],
  ['matching', '🧩', 'المطابقة', 'اربط السؤال بإجابته الصحيحة.'],
  ['surprise', '🎁', 'صندوق المفاجآت', 'مضاعفات وحماية ونقاط إضافية.'],
  ['battle', '⚔️', 'مواجهة طالبين', 'تنافس مباشر بنظام الأدوار.'],
  ['teams', '🏆', 'تحدي الفرق', 'فريق ذهبي ضد فريق أسود.'],
];

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const recentSafe = (items, history) => {
  const unseen = items.filter((item) => !history.includes(item.id));
  return unseen.length >= Math.min(5, items.length) ? unseen : items;
};

const gradeKeyFromLabel = (label) => gradeOptions.find((item) => item.label === label)?.key || '6';
const gradeLabelFromKey = (key) => gradeOptions.find((item) => item.key === key)?.label || '';

function playTone(kind = 'correct', settings = {}) {
  if (playVoiceClip(settings, kind)) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = kind === 'correct' ? 720 : kind === 'win' ? 880 : 190;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export default function Games({ data, updateData, shareState }) {
  const [gradeKey, setGradeKey] = useState('6');
  const [unit, setUnit] = useState('all');
  const [mode, setMode] = useState(null);
  const [round, setRound] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [seconds, setSeconds] = useState(20);
  const [playerOne, setPlayerOne] = useState(data.students[0]?.id || '');
  const [playerTwo, setPlayerTwo] = useState(data.students[1]?.id || '');
  const [battleScores, setBattleScores] = useState({ one: 0, two: 0 });
  const [activePlayer, setActivePlayer] = useState('one');
  const [timelineOrder, setTimelineOrder] = useState([]);
  const [characterGuess, setCharacterGuess] = useState('');
  const [matchSelection, setMatchSelection] = useState([]);
  const [powerUp, setPowerUp] = useState(null);
  const [focusResourceId, setFocusResourceId] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const history = data.gameQuestionHistory || [];

  const mergedBank = useMemo(() => mergeQuestionBanks(questionBank, data.customQuestionBank || []), [data.customQuestionBank]);
  const units = useMemo(() => [...new Set(mergedBank.filter((q) => q.gradeKey === gradeKey).map((q) => q.unit))], [mergedBank, gradeKey]);
  const filtered = useMemo(() => mergedBank.filter((q) => q.gradeKey === gradeKey && (unit === 'all' || q.unit === unit)), [mergedBank, gradeKey, unit]);
  const current = round[index];
  const selectedStudent = data.students.find((s) => s.id === Number(playerOne));
  const secondStudent = data.students.find((s) => s.id === Number(playerTwo));
  const gradeLabel = gradeLabelFromKey(gradeKey);
  const contentResources = useMemo(() => (data.contentLibrary || []).filter((item) => !item.grade || item.grade === gradeLabel), [data.contentLibrary, gradeLabel]);
  const lessonResources = useMemo(() => contentResources.filter((item) => unit === 'all' || item.unit === unit), [contentResources, unit]);
  const focusResource = lessonResources.find((item) => String(item.id) === String(focusResourceId)) || lessonResources[0] || null;

  const sharedInvite = shareState?.kind === 'game' ? shareState.payload : null;
  const pendingInvite = data.settings?.pendingChallenge || null;

  useEffect(() => {
    const invite = sharedInvite || pendingInvite;
    if (!invite) return;
    if (invite.gradeKey) setGradeKey(invite.gradeKey);
    if (invite.unit) setUnit(invite.unit);
    if (invite.playerOne) setPlayerOne(String(invite.playerOne));
    if (invite.playerTwo) setPlayerTwo(String(invite.playerTwo));
    if (invite.focusResourceId) setFocusResourceId(invite.focusResourceId);
    if (invite.mode) setShareNotice(`تم استلام رابط تحدي ${invite.mode === 'teams' ? 'الفرق' : 'طالبين'}${sharedInvite ? '' : ' من داخل الحصة'}. اختر بدء التحدي عندما تكون جاهزًا.`);
    if (!sharedInvite && data.settings?.pendingChallenge) {
      updateData({
        ...data,
        settings: {
          ...data.settings,
          pendingChallenge: null,
        },
      });
    }
  }, [sharedInvite, pendingInvite]);

  useEffect(() => {
    if (!mode || mode === 'result' || locked || !current || !['speed', 'battle', 'teams', 'truefalse', 'wheel', 'surprise'].includes(mode)) return;
    if (seconds <= 0) {
      setLocked(true);
      setCombo(0);
      setFeedback(`انتهى الوقت — الإجابة الصحيحة: ${current.answer}`);
      playTone('wrong', data.settings);
      return;
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, mode, locked, current]);

  useEffect(() => {
    if (!lessonResources.length) return;
    if (!focusResource || !lessonResources.some((item) => String(item.id) === String(focusResourceId))) {
      setFocusResourceId(lessonResources[0].id);
    }
  }, [lessonResources, focusResource, focusResourceId]);

  const poolFor = (selectedMode, targetGradeKey = gradeKey, targetUnit = unit) => {
    const pool = mergedBank.filter((q) => q.gradeKey === targetGradeKey && (targetUnit === 'all' || q.unit === targetUnit));
    if (selectedMode === 'truefalse') return pool.filter((q) => q.type === 'tf');
    if (selectedMode === 'character') return pool.filter((q) => q.type === 'character');
    if (selectedMode === 'timeline') return pool.filter((q) => q.type === 'timeline');
    if (selectedMode === 'matching') return pool.filter((q) => q.type === 'mcq');
    return pool.filter((q) => q.type === 'mcq' || q.type === 'tf' || q.type === 'fill');
  };

  const resetRoundState = (selectedMode, picked) => {
    setMode(selectedMode);
    setRound(picked);
    setIndex(0);
    setScore(0);
    setCombo(0);
    setLocked(false);
    setFeedback('');
    setSeconds(20);
    setBattleScores({ one: 0, two: 0 });
    setActivePlayer('one');
    setTimelineOrder(picked[0]?.events ? shuffle(picked[0].events) : []);
    setCharacterGuess('');
    setMatchSelection([]);
    setPowerUp(selectedMode === 'surprise' ? shuffle(['x2', 'shield', 'bonus'])[0] : null);
  };

  const startMode = (selectedMode) => {
    const pool = recentSafe(poolFor(selectedMode), history);
    if (!pool.length) {
      setFeedback('لا توجد أسئلة كافية لهذا الاختيار.');
      return;
    }
    const count = ['timeline', 'character', 'matching'].includes(selectedMode) ? Math.min(4, pool.length) : Math.min(10, pool.length);
    resetRoundState(selectedMode, shuffle(pool).slice(0, count));
  };

  const startFromResource = (selectedMode, resource) => {
    if (!resource) return startMode(selectedMode);
    const targetGradeKey = gradeKeyFromLabel(resource.grade);
    const targetUnit = resource.unit || 'all';
    const pool = recentSafe(poolFor(selectedMode, targetGradeKey, targetUnit), history);
    if (!pool.length) {
      setFeedback('هذا الدرس لا يملك أسئلة كافية بعد.');
      return;
    }
    setGradeKey(targetGradeKey);
    setUnit(targetUnit);
    setFocusResourceId(resource.id);
    const count = ['timeline', 'character', 'matching'].includes(selectedMode) ? Math.min(4, pool.length) : Math.min(10, pool.length);
    resetRoundState(selectedMode, shuffle(pool).slice(0, count));
  };

  const persist = (questionId) => updateData({ ...data, gameQuestionHistory: [...history.filter((id) => id !== questionId), questionId].slice(-30) });

  const award = (correct, base = 10) => {
    if (mode === 'battle' || mode === 'teams') {
      const key = activePlayer;
      setBattleScores((prev) => ({ ...prev, [key]: prev[key] + (correct ? base : 0) }));
    } else if (correct) {
      const multiplier = powerUp === 'x2' ? 2 : 1;
      const bonus = (base + Math.min(combo, 5) * 2) * multiplier;
      setScore((v) => v + bonus);
      setCombo((v) => v + 1);
    } else setCombo(0);
  };

  const answerChoice = (choiceIndex) => {
    if (locked || !current) return;
    setLocked(true);
    persist(current.id);
    const correct = choiceIndex === current.answerIndex;
    award(correct, mode === 'wheel' ? 15 : mode === 'surprise' ? 20 : 10);
    if (correct) {
      setFeedback(powerUp === 'x2' ? 'إجابة صحيحة — النقاط مضاعفة!' : 'إجابة صحيحة، ممتاز!');
      playTone('correct', data.settings);
      encourageStudent('excellent', selectedStudent?.name || 'يا بطل', data.settings);
    } else {
      setFeedback(`الإجابة الصحيحة: ${current.answer} — راجع: ${current.topic}`);
      playTone('wrong', data.settings);
    }
  };

  const submitCharacter = () => {
    if (!current || locked) return;
    setLocked(true);
    persist(current.id);
    const correct = characterGuess.trim().replace(/\s+/g, ' ') === current.answer.trim().replace(/\s+/g, ' ');
    award(correct, 15);
    setFeedback(correct ? 'ممتاز! اكتشفت الشخصية.' : `الشخصية هي: ${current.answer}`);
    playTone(correct ? 'correct' : 'wrong', data.settings);
  };

  const moveTimeline = (event, direction) => setTimelineOrder((prev) => {
    const copy = [...prev];
    const i = copy.indexOf(event);
    const t = i + direction;
    if (t < 0 || t >= copy.length) return prev;
    [copy[i], copy[t]] = [copy[t], copy[i]];
    return copy;
  });

  const submitTimeline = () => {
    if (!current || locked) return;
    setLocked(true);
    persist(current.id);
    const correct = timelineOrder.every((e, i) => e === current.events[i]);
    award(correct, 20);
    setFeedback(correct ? 'ترتيب صحيح بالكامل +20 نقطة' : `الترتيب الصحيح: ${current.events.join(' ← ')}`);
    playTone(correct ? 'correct' : 'wrong', data.settings);
  };

  const submitMatching = () => {
    if (!current || locked) return;
    const correct = matchSelection.length === 1 && matchSelection[0] === current.answerIndex;
    setLocked(true);
    persist(current.id);
    award(correct, 15);
    setFeedback(correct ? 'مطابقة صحيحة!' : `المطابقة الصحيحة: ${current.answer}`);
    playTone(correct ? 'correct' : 'wrong', data.settings);
  };

  const finishRound = () => {
    const xp = mode === 'battle' || mode === 'teams' ? Math.max(battleScores.one, battleScores.two) : score;
    const result = {
      id: Date.now(),
      studentId: Number(playerOne) || null,
      secondStudentId: ['battle', 'teams'].includes(mode) ? Number(playerTwo) || null : null,
      mode,
      gradeKey,
      score: mode === 'battle' || mode === 'teams' ? battleScores.one : score,
      secondScore: ['battle', 'teams'].includes(mode) ? battleScores.two : null,
      xp,
      date: new Date().toISOString().slice(0, 10),
    };
    const achievements = [...(data.achievements || [])];
    if (xp >= 80 && !achievements.some((a) => a.studentId === result.studentId && a.key === 'game-star')) achievements.push({ id: Date.now() + 1, studentId: result.studentId, key: 'game-star', title: 'نجم الألعاب', date: result.date });
    updateData({ ...data, gameResults: [...(data.gameResults || []), result], achievements });
    setMode('result');
    playTone('win', data.settings);
  };

  const nextQuestion = () => {
    if (index >= round.length - 1) {
      finishRound();
      return;
    }
    const next = index + 1;
    setIndex(next);
    setLocked(false);
    setFeedback('');
    setSeconds(20);
    setTimelineOrder(round[next]?.events ? shuffle(round[next].events) : []);
    setCharacterGuess('');
    setMatchSelection([]);
    if (['battle', 'teams'].includes(mode)) setActivePlayer((v) => (v === 'one' ? 'two' : 'one'));
    if (mode === 'surprise') setPowerUp(shuffle(['x2', 'shield', 'bonus'])[0]);
  };

  const buildGamePayload = (selectedMode = 'battle') => ({
    kind: 'game',
    mode: selectedMode,
    gradeKey,
    gradeLabel,
    unit,
    playerOne: Number(playerOne) || null,
    playerTwo: Number(playerTwo) || null,
    selectedStudent: selectedStudent ? { id: selectedStudent.id, name: selectedStudent.name, code: selectedStudent.code } : null,
    secondStudent: secondStudent ? { id: secondStudent.id, name: secondStudent.name, code: secondStudent.code } : null,
    focusResourceId: focusResource?.id || null,
    resource: focusResource ? {
      id: focusResource.id,
      title: focusResource.title,
      unit: focusResource.unit,
      lesson: focusResource.lesson,
      grade: focusResource.grade,
      type: focusResource.type,
      url: focusResource.url,
      assetId: focusResource.assetId || '',
      fileName: focusResource.fileName || '',
    } : null,
    roomTitle: `${gradeLabel || 'الصف'} • ${focusResource?.lesson || focusResource?.title || 'تحدي'}`,
    createdAt: new Date().toISOString(),
  });

  const saveOnlineGameResult = (result) => {
    if (!result) return;
    const gameResults = [result, ...(data.gameResults || [])].slice(0, 300);
    const achievements = [...(data.achievements || [])];
    const winnerId = Number(data.students.find((student) => String(student.code || '') === String(result.winner?.studentCode || ''))?.id || 0);
    if (winnerId && !achievements.some((item) => item.studentId === winnerId && item.key === 'online-champion')) {
      achievements.push({
        id: Date.now() + 7,
        studentId: winnerId,
        key: 'online-champion',
        title: 'بطل التحدي الأونلاين',
        date: result.date,
      });
    }
    updateData({ ...data, gameResults, achievements });
    setShareNotice('تم حفظ نتيجة التحدي الأونلاين في سجل الألعاب.');
  };

  const copyGameLink = async (selectedMode = 'battle') => {
    const payload = buildGamePayload(selectedMode);
    let share;
    try {
      share = await buildShareLink('game', payload, { cloudSync: data.settings?.cloudSync });
    } catch (error) {
      setShareNotice(error?.message || 'تعذر إنشاء رابط التحدي.');
      return null;
    }
    const room = {
      id: share.token || `room-${Date.now()}`,
      mode: selectedMode,
      gradeKey,
      unit,
      focusResourceId: focusResource?.id || null,
      selectedStudentId: Number(playerOne) || null,
      secondStudentId: Number(playerTwo) || null,
      state: payload,
      inviteCode: share.token || '',
      inviteUrl: share.url,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const gameRooms = [room, ...(data.gameRooms || [])].slice(0, 40);
    await updateData({ ...data, gameRooms });
    const copied = await copyToClipboard(share.url);
    setShareNotice(copied ? 'تم نسخ رابط التحدي بنجاح.' : 'تم تجهيز رابط التحدي.');
    return share;
  };

  if (mode === 'result') return <section className="page"><div className="panel game-result-screen"><div className="game-result-icon">🏆</div><h2>انتهت الجولة</h2><p>{['battle', 'teams'].includes(mode) ? `${selectedStudent?.name}: ${battleScores.one} — ${secondStudent?.name}: ${battleScores.two}` : `النتيجة: ${score} نقطة`}</p><p className="game-level-copy">المستوى: {Math.floor(score / 100) + 1} • XP: {score}</p><button className="primary-btn" onClick={() => setMode(null)}>العودة للألعاب</button></div></section>;

  if (mode && current) return <section className="page game-live-page">
    <div className="game-stage-header"><button className="secondary-btn" onClick={() => setMode(null)}>خروج</button><div><span>السؤال {index + 1} من {round.length}</span><strong>{['battle', 'teams'].includes(mode) ? `${battleScores.one} : ${battleScores.two}` : `${score} نقطة`}</strong></div><div className={`game-timer ${seconds <= 5 ? 'danger' : ''}`}>⏱ {seconds}</div><div className="combo-badge">🔥 {combo}</div><button className="secondary-btn" onClick={() => copyGameLink(mode)} type="button">نسخ الرابط</button></div>
    <article className="panel professional-game-board">
      {sharedInvite && <div className="powerup-banner">رابط مشترَك: {sharedInvite.roomTitle || sharedInvite.mode || 'تحدي'}</div>}
      {['battle', 'teams'].includes(mode) && <div className="active-player-banner">الدور على: {activePlayer === 'one' ? selectedStudent?.name : secondStudent?.name}</div>}
      {mode === 'surprise' && <div className="powerup-banner">🎁 المكافأة: {powerUp === 'x2' ? 'ضعف النقاط' : powerUp === 'shield' ? 'درع حماية' : 'مكافأة إضافية'}</div>}
      <span className="eyebrow">{current.unit} • {current.lesson} • {current.difficulty}</span><h2>{current.text}</h2>
      {['speed', 'wheel', 'battle', 'teams', 'surprise'].includes(mode) && <div className="pro-answer-grid">{current.options.map((option, i) => <button key={`${option}-${i}`} disabled={locked} onClick={() => answerChoice(i)} className={locked && i === current.answerIndex ? 'correct' : ''}>{option}</button>)}</div>}
      {mode === 'truefalse' && <div className="tf-buttons"><button disabled={locked} onClick={() => answerChoice(0)}>صح</button><button disabled={locked} onClick={() => answerChoice(1)}>خطأ</button></div>}
      {mode === 'character' && <div className="character-panel"><div className="clues">{current.clues?.map((c, i) => <span key={c}>الدليل {i + 1}: {c}</span>)}</div><input value={characterGuess} onChange={(e) => setCharacterGuess(e.target.value)} placeholder="اكتب اسم الشخصية"/><button className="primary-btn" disabled={locked || !characterGuess.trim()} onClick={submitCharacter}>تأكيد</button></div>}
      {mode === 'timeline' && <div className="timeline-panel">{timelineOrder.map((event, i) => <div className="timeline-event" key={event}><span>{i + 1}</span><strong>{event}</strong><div><button onClick={() => moveTimeline(event, -1)}>↑</button><button onClick={() => moveTimeline(event, 1)}>↓</button></div></div>)}<button className="primary-btn" disabled={locked} onClick={submitTimeline}>تحقق</button></div>}
      {mode === 'matching' && <div className="matching-grid">{current.options.map((option, i) => <button key={option} className={matchSelection.includes(i) ? 'active' : ''} onClick={() => setMatchSelection([i])}>{option}</button>)}<button className="primary-btn" disabled={locked || !matchSelection.length} onClick={submitMatching}>تثبيت المطابقة</button></div>}
      {feedback && <div className={`game-feedback ${feedback.includes('صحيحة') || feedback.includes('ممتاز') || feedback.includes('صحيح') ? 'good' : 'bad'}`}>{feedback}</div>}
      {locked && <button className="primary-btn next-game-btn" onClick={nextQuestion}>{index === round.length - 1 ? 'إنهاء الجولة' : 'السؤال التالي'}</button>}
    </article>
  </section>;

  return <section className="page">
    <div className="page-heading">
      <div>
        <span className="eyebrow">محرك الألعاب الاحترافي</span>
        <h2>الألعاب التعليمية</h2>
        <p>جولات، فرق، نقاط، مستويات، مؤثرات، ومراجعة مرتبطة بالمحتوى الحالي للحصة.</p>
      </div>
    </div>

    <div className="panel game-control-panel">
      <select value={gradeKey} onChange={(e) => { setGradeKey(e.target.value); setUnit('all'); }}>
        {gradeOptions.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
      </select>
      <select value={unit} onChange={(e) => setUnit(e.target.value)}><option value="all">كل الوحدات</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
      <select value={playerOne} onChange={(e) => setPlayerOne(e.target.value)}>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select value={playerTwo} onChange={(e) => setPlayerTwo(e.target.value)}>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <button className="secondary-btn" type="button" onClick={() => copyGameLink('battle')}>رابط طالبين</button>
      <button className="secondary-btn" type="button" onClick={() => copyGameLink('teams')}>رابط الفرق</button>
    </div>

    <div className="lesson-game-panel panel">
      <div className="lesson-game-copy">
        <span className="eyebrow">مرتبطة بالمحتوى</span>
        <h3>{gradeLabel || 'الصف الحالي'}</h3>
        <p>{focusResource ? `${focusResource.unit} — ${focusResource.lesson}` : 'اختر وحدة من بنك الأسئلة أو فعّل موردًا من مكتبة المحتوى.'}</p>
      </div>
      <div className="lesson-game-resource-list">
        {lessonResources.slice(0, 4).map((resource) => <button key={resource.id} className={String(focusResourceId) === String(resource.id) ? 'active' : ''} onClick={() => setFocusResourceId(resource.id)}>{resource.lesson}</button>)}
      </div>
      <div className="lesson-game-actions">
        <button className="secondary-btn" onClick={() => startFromResource('speed', focusResource)}><SparklesIcon /> مراجعة هذا الدرس</button>
        <button className="primary-btn" onClick={() => startMode('speed')}><Gamepad2Icon /> بدء التحدي</button>
      </div>
    </div>

    <OnlineGameHostPanel
      cloudSync={data.settings?.cloudSync}
      title={`${gradeLabel || 'الصف الحالي'} — ${focusResource?.lesson || focusResource?.title || (unit === 'all' ? 'تحدي المراجعة' : unit)}`}
      grade={gradeLabel}
      unit={focusResource?.unit || (unit === 'all' ? '' : unit)}
      questions={filtered}
      onNotice={setShareNotice}
      onFinish={saveOnlineGameResult}
    />

    {shareNotice && <div className="game-feedback good">{shareNotice}</div>}
    {feedback && <div className="game-feedback bad">{feedback}</div>}
    <div className="professional-games-grid">
      {modes.map(([id, icon, title, description]) => <button className="pro-game-card" key={id} onClick={() => (focusResource ? startFromResource(id, focusResource) : startMode(id))}><span>{icon}</span><h3>{title}</h3><p>{description}</p></button>)}
    </div>
    <div className="panel question-bank-summary"><strong>الأسئلة المتاحة: {filtered.length}</strong><span>آخر 30 سؤالًا محفوظة لمنع التكرار.</span></div>
  </section>;
}

function SparklesIcon() { return <span>✨</span>; }
function Gamepad2Icon() { return <span>🎮</span>; }
