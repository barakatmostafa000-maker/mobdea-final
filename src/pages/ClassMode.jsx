import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CirclePause, CirclePlay, Dices, Eraser, FileImage, FileText, Gamepad2, Highlighter, Maximize2, Minus, PenTool, Plus, Presentation, RotateCcw, Save, ScanLine, Shuffle, Sparkles, TimerReset, Trophy, Users, X } from 'lucide-react';
import { encourageStudent } from '../services/voice';
import { queueAbsenceNotification } from '../services/notifications';
import { formatTime12, todayISO } from '../utils/time';

const statusLabels = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'غياب بعذر' };
const toolLabels = { pen: 'قلم', highlighter: 'هايلايتر', eraser: 'ممحاة' };

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function ClassMode({ data, updateData, navigate }) {
  const current = data.sessions.find((session) => session.current);
  const students = current ? data.students.filter((student) => student.group === current.group) : [];
  const today = todayISO();
  const [lastPraise, setLastPraise] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [points, setPoints] = useState({});
  const [view, setView] = useState('students');
  const [tool, setTool] = useState('pen');
  const [notes, setNotes] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const attendanceMap = useMemo(() => Object.fromEntries(
    data.attendance
      .filter((item) => item.date === today && item.sessionId === current?.id)
      .map((item) => [item.studentId, item.status])
  ), [data.attendance, today, current?.id]);

  const counts = useMemo(() => Object.values(attendanceMap).reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}), [attendanceMap]);

  const mark = (student, status) => {
    const existing = data.attendance.find((item) => item.studentId === student.id && item.date === today && item.sessionId === current?.id);
    const attendance = existing
      ? data.attendance.map((item) => item.id === existing.id ? { ...item, status } : item)
      : [...data.attendance, { id: Date.now() + Math.random(), studentId: student.id, sessionId: current?.id || null, date: today, status }];
    let next = { ...data, attendance };
    if (status === 'absent') next = queueAbsenceNotification(next, student, current, today);
    updateData(next);
  };

  const praise = (student, type) => {
    setSelectedStudent(student);
    setLastPraise(encourageStudent(type, student.name, data.settings));
  };

  const adjustPoints = (student, delta) => {
    setPoints((previous) => ({ ...previous, [student.id]: (previous[student.id] || 0) + delta }));
  };

  const randomStudent = () => {
    if (!students.length) return;
    const student = students[Math.floor(Math.random() * students.length)];
    setSelectedStudent(student);
    setLastPraise(`تم اختيار ${student.name}`);
    encourageStudent('calm', student.name, data.settings);
  };

  const canvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0];
    return { x: (touch?.clientX ?? event.clientX) - rect.left, y: (touch?.clientY ?? event.clientY) - rect.top };
  };

  const startDraw = (event) => {
    if (!canvasRef.current) return;
    drawingRef.current = true;
    const point = canvasPoint(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (event) => {
    if (!drawingRef.current || !canvasRef.current) return;
    event.preventDefault();
    const point = canvasPoint(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = tool === 'highlighter' ? 0.28 : 1;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : tool === 'highlighter' ? '#f3ca3e' : '#111827';
    ctx.lineWidth = tool === 'eraser' ? 24 : tool === 'highlighter' ? 16 : 4;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDraw = () => { drawingRef.current = false; };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `شرح-${current?.title || 'الحصة'}-${today}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const endClass = () => {
    const summary = {
      id: Date.now(), sessionId: current.id, date: today, durationSeconds: seconds,
      attendance: counts, points, notes, endedAt: new Date().toISOString()
    };
    updateData({ ...data, classSummaries: [...(data.classSummaries || []), summary] });
    navigate('dashboard');
  };

  if (!current) return <section className="page class-mode-page"><div className="panel empty-state"><h2>لا توجد حصة حالية</h2><p>حدد الحصة الحالية أولًا من قسم الحصص والمجموعات.</p><button className="primary-btn" onClick={() => navigate('sessions')}>فتح الحصص</button></div></section>;

  return <section className={`page class-mode-page ${fullscreen ? 'class-fullscreen' : ''}`}>
    <div className="class-command-bar">
      <div className="class-title-block"><span className="live-badge">● حصة مباشرة</span><h2>{current.title} — {current.group}</h2><p>{current.day} • {formatTime12(current.time)}</p></div>
      <div className="class-live-metrics">
        <div><Users size={17}/><b>{students.length}</b><span>الطلاب</span></div>
        <div><b>{counts.present || 0}</b><span>حاضر</span></div>
        <div><b>{counts.absent || 0}</b><span>غائب</span></div>
        <div className="class-clock"><b>{formatDuration(seconds)}</b><span>مدة الحصة</span></div>
      </div>
      <div className="class-top-actions">
        <button className="icon-action" onClick={() => setRunning(!running)}>{running ? <CirclePause/> : <CirclePlay/>}</button>
        <button className="icon-action" onClick={() => setSeconds(0)}><TimerReset/></button>
        <button className="icon-action" onClick={() => setFullscreen(!fullscreen)}><Maximize2/></button>
        <button className="danger-btn" onClick={endClass}>إنهاء الحصة</button>
      </div>
    </div>

    <div className="class-mode-tabs">
      <button className={view === 'students' ? 'active' : ''} onClick={() => setView('students')}><Users/> الطلاب والحضور</button>
      <button className={view === 'explain' ? 'active' : ''} onClick={() => setView('explain')}><Presentation/> الشرح والسبورة</button>
      <button onClick={() => navigate('games')}><Gamepad2/> الألعاب</button>
      <button onClick={() => navigate('gradeScanner')}><ScanLine/> رصد الدرجات</button>
    </div>

    {lastPraise && <div className="spoken-banner">🔊 {lastPraise}</div>}

    {view === 'students' ? <>
      <div className="class-quick-strip">
        <button onClick={randomStudent}><Shuffle/> اختيار طالب عشوائي</button>
        <button onClick={() => navigate('games')}><Dices/> جولة سريعة</button>
        <button onClick={() => navigate('attendance')}><Camera/> مسح QR</button>
        <button onClick={() => selectedStudent && praise(selectedStudent, 'comic')} disabled={!selectedStudent}><Sparkles/> جملة كوميدية</button>
      </div>

      {selectedStudent && <div className="selected-student-focus"><Trophy/><div><span>الطالب المحدد</span><strong>{selectedStudent.name}</strong></div><b>{points[selectedStudent.id] || 0} نقطة</b></div>}

      <div className="class-students-grid">
        {students.map((student) => {
          const status = attendanceMap[student.id];
          return <article className={`class-student-card ${selectedStudent?.id === student.id ? 'focused' : ''}`} key={student.id} onClick={() => setSelectedStudent(student)}>
            <header><span className="student-code">{student.code}</span><div><strong>{student.name}</strong><small>{student.grade}</small></div><span className={`status-pill class-status ${status || ''}`}>{statusLabels[status] || 'لم يسجل'}</span></header>
            <div className="class-attendance-actions">
              {Object.entries(statusLabels).map(([key,label]) => <button key={key} className={status === key ? `selected ${key}-btn` : `${key}-btn`} onClick={(e) => { e.stopPropagation(); mark(student,key); }}>{label}</button>)}
            </div>
            <div className="student-points-row"><button onClick={(e) => { e.stopPropagation(); adjustPoints(student,-1); }}><Minus/></button><b>{points[student.id] || 0}</b><button onClick={(e) => { e.stopPropagation(); adjustPoints(student,1); }}><Plus/></button></div>
            <div className="voice-shortcuts">
              <button onClick={(e) => { e.stopPropagation(); praise(student,'excellent'); }}>⭐ ممتاز</button>
              <button onClick={(e) => { e.stopPropagation(); praise(student,'close'); }}>🍬 ناقصها سكر</button>
              <button onClick={(e) => { e.stopPropagation(); praise(student,'retry'); }}>🔁 حاول تاني</button>
              <button onClick={(e) => { e.stopPropagation(); praise(student,'comic'); }}>😒 زهقان</button>
            </div>
          </article>;
        })}
      </div>
    </> : <div className="explain-layout">
      <div className="board-panel panel">
        <div className="board-toolbar">
          <div className="tool-group">
            {Object.entries(toolLabels).map(([key,label]) => <button key={key} className={tool === key ? 'active' : ''} onClick={() => setTool(key)}>{key === 'pen' ? <PenTool/> : key === 'highlighter' ? <Highlighter/> : <Eraser/>}{label}</button>)}
          </div>
          <div className="tool-group"><button onClick={clearCanvas}><RotateCcw/> مسح</button><button onClick={saveBoard}><Save/> حفظ صورة</button></div>
        </div>
        <div className="canvas-wrap"><canvas ref={canvasRef} width="1200" height="700" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}/></div>
      </div>
      <aside className="lesson-side-panel">
        <article className="panel"><span className="eyebrow">مصادر الشرح</span><h3>إضافة محتوى</h3><div className="resource-buttons"><button><FileText/> PDF</button><button><FileImage/> صورة</button><button><Presentation/> عرض</button><button><Camera/> تصوير السبورة</button></div></article>
        <article className="panel"><span className="eyebrow">ملاحظات المعلم</span><h3>ملخص الحصة</h3><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اكتب النقاط المهمة، الواجب، أو الطلاب المحتاجين للمتابعة..." rows="10"/></article>
      </aside>
    </div>}
  </section>;
}
