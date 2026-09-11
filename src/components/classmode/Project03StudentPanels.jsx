// PROJECT03_TWIN_STUDENT_PANELS_V1
// PROJECT11_RANDOM_PICKER_AND_IMPROVEMENT_V1
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dices, MailCheck, Minus, Move, Plus, RotateCcw, Sparkles, Trophy, Users, Volume2, X } from 'lucide-react';
import { speakArabic } from '../../services/voice';
import { drawRandomStudents } from '../../services/project11StudentSelection';

const statusLabels = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'غياب بعذر' };

function normalizeGender(student) {
  const raw = String(student?.gender || student?.sex || '').trim().toLowerCase();
  if (['male', 'm', 'boy', 'boys', 'ذكر', 'ذكور', 'ولد', 'بنين'].includes(raw)) return 'male';
  if (['female', 'f', 'girl', 'girls', 'أنثى', 'انثى', 'إناث', 'اناث', 'بنت', 'بنات'].includes(raw)) return 'female';
  return '';
}

function StudentPanel({
  side,
  students,
  offset,
  attendanceMap,
  points,
  studentProgress,
  randomPickedSet,
  selectedStudent,
  onSelect,
  onMark,
  onAdjustPoints,
  onPhrase,
  onDragStart,
  onDragMove,
  onDragEnd,
  sortMode,
  onSortMode,
  showSort,
}) {
  return (
    <aside
      className={`project03-student-panel ${side}`}
      style={{ '--p03-x': `${offset?.x || 0}px`, '--p03-y': `${offset?.y || 0}px` }}
      aria-label={side === 'right' ? 'طلاب الحصة يمين' : 'طلاب الحصة يسار'}
    >
      <header
        className="project03-student-head"
        onPointerDown={(event) => onDragStart(side, event)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onLostPointerCapture={onDragEnd}
        title="اسحب لتحريك لوحة الطلاب"
      >
        <div><Users size={16}/><span><strong>{side === 'right' ? 'الطلاب — يمين' : 'الطلاب — يسار'}</strong><small>{students.length} طالب</small></span></div>
        <Move size={15}/>
      </header>

      {showSort && (
        <div className="project03-sortbar">
          <select value={sortMode} onChange={(event) => onSortMode(event.target.value)} aria-label="ترتيب الطلاب">
            <option value="points">النقاط</option>
            <option value="improved">الأكثر تحسنًا</option>
            <option value="auto">ترتيب تلقائي</option>
            <option value="alphabetical">أبجدي</option>
            <option value="gender">بنين ثم بنات</option>
          </select>
        </div>
      )}

      <div className="project03-student-list">
        {students.map((student) => {
          const status = attendanceMap?.[student.id];
          const score = Math.max(0, Number(points?.[student.id] || 0));
          const delta = Number(studentProgress?.[student.id]?.delta || 0);
          const active = selectedStudent?.id === student.id;
          const randomPicked = randomPickedSet.has(String(student.id));
          return (
            <div
              key={student.id}
              className={`project03-student-row ${active ? 'active' : ''} ${randomPicked ? 'random-picked' : ''}`}
              data-improvement-delta={delta}
            >
              <button type="button" className="project03-student-main" onClick={() => onSelect(student)}>
                <span className="project03-code">{student.code}</span>
                <span className="project03-name">
                  <strong>{student.name}</strong>
                  <small>{statusLabels[status] || 'لم يسجل'}</small>
                </span>
                <b className="project11-score">
                  <span>{score}</span>
                  {delta !== 0 && (
                    <small className={delta > 0 ? 'up' : 'down'}>
                      {delta > 0 ? `↑ +${delta}` : `↓ ${delta}`}
                    </small>
                  )}
                </b>
              </button>
              <div className="project03-actions">
                <button type="button" className={status === 'present' ? 'present selected' : 'present'} onClick={() => onMark(student, 'present')} title="حاضر">ح</button>
                <button type="button" onClick={() => onAdjustPoints(student, -1)} title="خصم نقطة"><Minus size={12}/></button>
                <button type="button" onClick={() => onAdjustPoints(student, 1)} title="إضافة نقطة"><Plus size={12}/></button>
                <button type="button" className="positive" onClick={() => onPhrase(student, 'positive')} title={`تشجيع ${student.name}`}><Sparkles size={13}/></button>
                <button type="button" className="corrective" onClick={() => onPhrase(student, 'corrective')} title={`تنبيه ${student.name}`}><MailCheck size={13}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function Project03StudentPanels({
  students = [],
  attendanceMap = {},
  points = {},
  studentProgress = {},
  selectedStudent,
  onSelectedStudent,
  onMark,
  onAdjustPoints,
  phrases = [],
  correctivePhrases = [],
  voiceSettings,
  groupLabel = '',
  onSpoken,
  onNotice,
}) {
  const PROJECT13_STUDENT_PANELS_COLLAPSED_V1 = true;
  const [visible, setVisible] = useState(false);
  const [sortMode, setSortMode] = useState('points');
  const [phraseMenu, setPhraseMenu] = useState(null);
  const [offsets, setOffsets] = useState({ right: { x: 0, y: 0 }, left: { x: 0, y: 0 } });
  const [randomOpen, setRandomOpen] = useState(false);
  const [randomCount, setRandomCount] = useState(2);
  const [randomPickedIds, setRandomPickedIds] = useState([]);
  const [randomResult, setRandomResult] = useState([]);
  const [randomRemaining, setRandomRemaining] = useState(students.length);
  const dragRef = useRef(null);
  const randomUsedIdsRef = useRef([]);
  const collator = useMemo(() => new Intl.Collator('ar-EG', { sensitivity: 'base', numeric: true }), []);

  useEffect(() => {
    const valid = new Set(students.map((student) => String(student.id)));
    randomUsedIdsRef.current = randomUsedIdsRef.current.filter((id) => valid.has(String(id)));
    setRandomPickedIds((ids) => ids.filter((id) => valid.has(String(id))));
    setRandomResult((items) => items.filter((student) => valid.has(String(student.id))));
    setRandomRemaining(Math.max(0, students.length - randomUsedIdsRef.current.length));
    setRandomCount((value) => Math.max(1, Math.min(students.length || 1, Number(value || 1))));
  }, [students]);

  const effectiveSort = useMemo(() => {
    if (sortMode !== 'auto') return sortMode;
    const label = String(groupLabel || '').toLowerCase();
    if (/بنين|ذكور|اولاد|أولاد|بنات|اناث|إناث|طالبات/u.test(label)) return 'alphabetical';
    return students.some((student) => normalizeGender(student)) ? 'gender' : 'alphabetical';
  }, [sortMode, groupLabel, students]);

  const ordered = useMemo(() => {
    const list = students.slice();
    list.sort((a, b) => {
      if (effectiveSort === 'improved') {
        const aDelta = Number(studentProgress?.[a.id]?.delta || 0);
        const bDelta = Number(studentProgress?.[b.id]?.delta || 0);
        if (bDelta !== aDelta) return bDelta - aDelta;
        const aCurrent = Number(studentProgress?.[a.id]?.current ?? points?.[a.id] ?? 0);
        const bCurrent = Number(studentProgress?.[b.id]?.current ?? points?.[b.id] ?? 0);
        if (bCurrent !== aCurrent) return bCurrent - aCurrent;
      } else if (effectiveSort === 'points') {
        const scoreDelta = Number(points?.[b.id] || 0) - Number(points?.[a.id] || 0);
        if (scoreDelta) return scoreDelta;
      } else if (effectiveSort === 'gender') {
        const rank = { male: 0, female: 1, '': 2 };
        const delta = (rank[normalizeGender(a)] ?? 2) - (rank[normalizeGender(b)] ?? 2);
        if (delta) return delta;
      }
      return collator.compare(String(a.name || ''), String(b.name || ''));
    });
    return list;
  }, [students, effectiveSort, collator, studentProgress, points]);

  const split = Math.ceil(ordered.length / 2);
  const rightStudents = ordered.slice(0, split);
  const leftStudents = ordered.slice(split);
  const randomPickedSet = useMemo(() => new Set(randomPickedIds.map(String)), [randomPickedIds]);

  const beginDrag = (side, event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      side,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: offsets[side] || { x: 0, y: 0 },
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const maxX = Math.max(80, Math.min(520, (globalThis.innerWidth || 1280) * .42));
    const maxY = Math.max(70, Math.min(280, (globalThis.innerHeight || 720) * .35));
    const next = {
      x: Math.max(-maxX, Math.min(maxX, drag.origin.x + event.clientX - drag.startX)),
      y: Math.max(-maxY, Math.min(maxY, drag.origin.y + event.clientY - drag.startY)),
    };
    setOffsets((current) => ({ ...current, [drag.side]: next }));
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || (event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
    try { event?.currentTarget?.releasePointerCapture?.(drag.pointerId); } catch { }
    dragRef.current = null;
  };

  const openPhrase = (student, type) => {
    onSelectedStudent?.(student);
    setPhraseMenu({ student, type });
  };

  const sayPhraseForStudent = async (student, phrase, type) => {
    const clean = String(phrase || '').replace(/[.!،,]+$/u, '');
    const text = student?.name ? `${clean} يا ${student.name}.` : clean;
    onSelectedStudent?.(student);
    setPhraseMenu(null);
    onSpoken?.(text);
    const spoken = await speakArabic(text, voiceSettings || {}, type === 'positive' ? 'excited' : 'calm');
    if (!spoken) onNotice?.('الصوت العربي غير جاهز على الجهاز. افتح إعدادات تحويل النص إلى كلام وثبّت صوتًا عربيًا.');
  };

  const chooseRandom = (requestedCount) => {
    if (!students.length) {
      onNotice?.('لا يوجد طلاب مسجلون في هذه الحصة.');
      return;
    }
    const count = Math.max(1, Math.min(students.length, Number(requestedCount || 1)));
    const result = drawRandomStudents(students, count, randomUsedIdsRef.current);
    randomUsedIdsRef.current = result.usedIds;
    const ids = result.selected.map((student) => String(student.id));
    setRandomPickedIds(ids);
    setRandomResult(result.selected);
    setRandomRemaining(result.remainingInCycle);
    if (result.selected[0]) onSelectedStudent?.(result.selected[0]);
    const names = result.selected.map((student) => student.name).join('، ');
    onNotice?.(
      `${count === 1 ? 'تم اختيار الطالب' : 'تم اختيار الطلاب'}: ${names}`
      + (result.cycleReset ? ' — بدأت دورة اختيار جديدة بعد اكتمال جميع الطلاب.' : ''),
    );
  };

  const resetRandomCycle = () => {
    randomUsedIdsRef.current = [];
    setRandomPickedIds([]);
    setRandomResult([]);
    setRandomRemaining(students.length);
    onNotice?.('تم بدء دورة اختيار عشوائي جديدة.');
  };

  return (
    <div className="project03-student-layer" aria-live="polite">
      <button type="button" className={`project03-toggle ${visible ? 'active' : ''}`} onClick={() => setVisible((value) => !value)} title={visible ? 'إخفاء الطلاب' : 'إظهار الطلاب'}>
        <Users size={17}/><span>{students.length}</span>
      </button>

      <button
        type="button"
        className={`project11-random-toggle ${randomOpen ? 'active' : ''}`}
        onClick={() => setRandomOpen((value) => !value)}
        title="اختيار طالب أو مجموعة طلاب عشوائيًا دون تكرار"
        aria-label="اختيار عشوائي من طلاب الحصة"
        data-testid="student-random-picker"
      >
        <Dices size={17}/>
        <span>عشوائي</span>
      </button>

      {visible && (
        <>
          <StudentPanel side="right" students={rightStudents} offset={offsets.right} attendanceMap={attendanceMap} points={points} studentProgress={studentProgress} randomPickedSet={randomPickedSet} selectedStudent={selectedStudent} onSelect={onSelectedStudent} onMark={onMark} onAdjustPoints={onAdjustPoints} onPhrase={openPhrase} onDragStart={beginDrag} onDragMove={moveDrag} onDragEnd={endDrag} sortMode={sortMode} onSortMode={setSortMode} showSort/>
          <StudentPanel side="left" students={leftStudents} offset={offsets.left} attendanceMap={attendanceMap} points={points} studentProgress={studentProgress} randomPickedSet={randomPickedSet} selectedStudent={selectedStudent} onSelect={onSelectedStudent} onMark={onMark} onAdjustPoints={onAdjustPoints} onPhrase={openPhrase} onDragStart={beginDrag} onDragMove={moveDrag} onDragEnd={endDrag} sortMode={sortMode} onSortMode={setSortMode}/>
          <button type="button" className="project03-reset" onClick={() => setOffsets({ right: { x: 0, y: 0 }, left: { x: 0, y: 0 } })} title="إرجاع اللوحتين"><RotateCcw size={14}/></button>
        </>
      )}

      {randomOpen && (
        <div className="project11-random-popover" role="dialog" aria-label="اختيار الطلاب عشوائيًا">
          <header>
            <div><small>طلاب الحصة الحالية</small><strong>اختيار عشوائي بدون تكرار</strong></div>
            <button type="button" onClick={() => setRandomOpen(false)} title="إغلاق"><X size={15}/></button>
          </header>

          <button type="button" className="project11-random-one" onClick={() => chooseRandom(1)} data-testid="random-one-student">
            <Dices size={18}/>
            <span><strong>اختيار طالب واحد</strong><small>لن يتكرر قبل المرور على باقي المجموعة</small></span>
          </button>

          <div className="project11-random-many">
            <label>
              <span>اختيار عدد من الطلاب</span>
              <input
                type="number"
                min="1"
                max={Math.max(1, students.length)}
                value={randomCount}
                onChange={(event) => setRandomCount(Math.max(1, Math.min(students.length || 1, Number(event.target.value || 1))))}
                inputMode="numeric"
                aria-label="عدد الطلاب المطلوب اختيارهم"
              />
            </label>
            <button type="button" onClick={() => chooseRandom(randomCount)} data-testid="random-many-students">
              <Dices size={17}/> اختيار العدد
            </button>
          </div>

          {randomResult.length > 0 && (
            <div className="project11-random-result">
              <span><Trophy size={15}/> الاختيار الحالي</span>
              <div>{randomResult.map((student) => <strong key={student.id}>{student.name}</strong>)}</div>
            </div>
          )}

          <footer>
            <small>متبقي في الدورة الحالية: {randomRemaining} من {students.length}</small>
            <button type="button" onClick={resetRandomCycle}>بدء دورة جديدة</button>
          </footer>
        </div>
      )}

      {phraseMenu?.student && (
        <div className={`project03-phrase-popover ${phraseMenu.type}`} role="dialog" aria-label={phraseMenu.type === 'positive' ? 'جمل التشجيع' : 'جمل التنبيه'}>
          <header><div><small>{phraseMenu.type === 'positive' ? 'تشجيع' : 'تنبيه'}</small><strong>{phraseMenu.student.name}</strong></div><button type="button" onClick={() => setPhraseMenu(null)} title="إغلاق"><X size={14}/></button></header>
          <div>
            {(phraseMenu.type === 'positive' ? phrases : correctivePhrases).map((phrase, index) => (
              <button type="button" key={`${phraseMenu.type}-${index}-${phrase}`} onClick={() => sayPhraseForStudent(phraseMenu.student, phrase, phraseMenu.type)}><Volume2 size={13}/><span>{phrase}</span></button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
