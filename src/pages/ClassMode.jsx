import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  Camera,
  CirclePause,
  CirclePlay,
  Dices,
  Eraser,
  FileImage,
  FileText,
  Gamepad2,
  Highlighter,
  LayoutGrid,
  Maximize2,
  Minus,
  PenTool,
  Plus,
  Presentation,
  Redo2,
  RotateCcw,
  Save,
  ScanLine,
  Shapes,
  Shuffle,
  Sparkles,
  StickyNote,
  TimerReset,
  Trophy,
  Undo2,
  Users,
  X,
  Waves,
  ZoomIn,
  ZoomOut,
  MailCheck,
  Volume2,
  Map,
  Video,
  File,
  CircleDot,
  ArrowUpRight,
  Type,
} from 'lucide-react';
import { identity } from '../config/identity';
import { encourageStudent } from '../services/voice';
import { buildShareLink, copyToClipboard } from '../services/share';
import { questionBank } from '../data/questionBank';
import { queueAbsenceNotification } from '../services/notifications';
import { todayISO, formatDateAr } from '../utils/time';

const statusLabels = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'غياب بعذر' };
const toolOptions = [
  { key: 'pen', label: 'قلم', icon: PenTool },
  { key: 'highlighter', label: 'تظليل', icon: Highlighter },
  { key: 'eraser', label: 'ممحاة', icon: Eraser },
  { key: 'text', label: 'نص', icon: Type },
  { key: 'shape', label: 'شكل', icon: Shapes },
  { key: 'arrow', label: 'سهم', icon: ArrowUpRight },
];
const shapeOptions = [
  { key: 'rect', label: 'مستطيل' },
  { key: 'circle', label: 'دائرة' },
  { key: 'triangle', label: 'مثلث' },
  { key: 'line', label: 'خط' },
];
const boardTemplates = [
  { key: 'blank', label: 'فارغ', icon: X },
  { key: 'grid', label: 'شبكة', icon: LayoutGrid },
  { key: 'lines', label: 'سطور', icon: Waves },
  { key: 'focus', label: 'تركيز', icon: Presentation },
];
const flowLabels = { preview: 'تمهيد', board: 'شرح على السبورة', practice: 'تدريب', quiz: 'تقويم سريع' };

const normalizeSequence = (sequence) => {
  if (Array.isArray(sequence) && sequence.length) return sequence.filter(Boolean);
  if (typeof sequence === 'string') return sequence.split(',').map((item) => item.trim()).filter(Boolean);
  return ['preview', 'board', 'practice'];
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const matchesGrade = (resource, grade) => !resource.grade || resource.grade === grade;

function boardBackground(template) {
  switch (template) {
    case 'grid':
      return {
        backgroundImage: 'linear-gradient(to right, rgba(17,24,39,.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,24,39,.09) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      };
    case 'lines':
      return {
        backgroundImage: 'repeating-linear-gradient(to bottom, rgba(17,24,39,.06) 0, rgba(17,24,39,.06) 1px, transparent 1px, transparent 29px)',
        backgroundSize: '100% 30px',
      };
    case 'focus':
      return {
        backgroundImage: 'radial-gradient(circle at 50% 5%, rgba(215,173,53,.12), transparent 35%), linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
      };
    default:
      return { backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%)' };
  }
}

function dataUrlToImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function drawStamp(ctx, stamp) {
  const x = stamp.x;
  const y = stamp.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = stamp.color || '#d7ad35';
  ctx.strokeStyle = stamp.color || '#d7ad35';
  ctx.lineWidth = 4;
  ctx.font = '700 18px system-ui, sans-serif';

  if (stamp.kind === 'text') {
    const lines = String(stamp.text || '').split('\n').slice(0, 5);
    lines.forEach((line, index) => ctx.fillText(line, 0, 22 + index * 24));
  } else if (stamp.kind === 'shape') {
    const kind = stamp.shape || 'rect';
    ctx.globalAlpha = 0.9;
    if (kind === 'circle') {
      ctx.beginPath();
      ctx.arc(80, 60, 46, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(80, 10);
      ctx.lineTo(130, 102);
      ctx.lineTo(30, 102);
      ctx.closePath();
      ctx.stroke();
    } else if (kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(160, 60);
      ctx.stroke();
    } else {
      ctx.strokeRect(20, 20, 120, 86);
    }
  } else if (stamp.kind === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(10, 70);
    ctx.lineTo(130, 70);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(112, 52);
    ctx.lineTo(140, 70);
    ctx.lineTo(112, 88);
    ctx.stroke();
  }

  ctx.restore();
}

function CanvasOverlay({ actions, onDrawAction, template, zoom, boardRef, tool, selectedColor, shapeKind, arrowMode, textValue, setTextValue, boardReady, setBoardReady }) {
  const canvasRef = useRef(null);
  const currentStroke = useRef(null);
  const drawing = useRef(false);

  const render = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    for (const action of actions) {
      if (action.kind !== 'stroke') continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = action.tool === 'highlighter' ? 0.3 : 1;
      ctx.strokeStyle = action.tool === 'eraser' ? '#ffffff' : action.color || '#111827';
      ctx.lineWidth = action.tool === 'eraser' ? 22 : action.tool === 'highlighter' ? 16 : action.width || 4;
      ctx.beginPath();
      action.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => { render(); }, [actions]);

  useEffect(() => {
    if (!boardReady && canvasRef.current) setBoardReady(true);
  }, [boardReady, setBoardReady]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    return {
      x: ((point.clientX - rect.left) / rect.width) * canvas.width,
      y: ((point.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const commitStroke = () => {
    if (!currentStroke.current) return;
    currentStroke.current = null;
    drawing.current = false;
  };

  const onPointerDown = (event) => {
    if (!canvasRef.current) return;
    const point = getPoint(event);
    if (tool === 'text' || tool === 'shape' || tool === 'arrow') {
      let stampText = textValue.trim();
      if (tool === 'text' && !stampText) stampText = window.prompt('اكتب النص الذي تريد وضعه على السبورة:', '') || '';
      if (tool === 'text' && !stampText.trim()) return;
      if (tool === 'shape' && !shapeKind) return;
      if (tool === 'arrow' && !arrowMode) return;
      onDrawAction({
        kind: tool,
        x: point.x,
        y: point.y,
        text: stampText || `سهم ${arrowMode}`,
        shape: shapeKind,
        arrowMode,
        color: selectedColor,
      });
      return;
    }

    drawing.current = true;
    currentStroke.current = {
      kind: 'stroke',
      tool,
      color: selectedColor,
      width: tool === 'highlighter' ? 10 : 4,
      points: [point],
    };
  };

  const onPointerMove = (event) => {
    if (!drawing.current || !currentStroke.current) return;
    event.preventDefault();
    const point = getPoint(event);
    currentStroke.current.points.push(point);
    renderStrokePreview();
  };

  const renderStrokePreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentStroke.current) return;
    const ctx = canvas.getContext('2d');
    render();
    const stroke = currentStroke.current;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.3 : 1;
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color || '#111827';
    ctx.lineWidth = stroke.tool === 'eraser' ? 22 : stroke.tool === 'highlighter' ? 16 : stroke.width || 4;
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  };

  const onPointerUp = () => {
    if (drawing.current && currentStroke.current) onDrawAction(currentStroke.current);
    commitStroke();
  };

  return (
    <div ref={boardRef} className="class-board-canvas-shell" style={{ "--board-zoom": zoom }}>
      <canvas
        ref={canvasRef}
        width={1200}
        height={720}
        className="class-board-canvas"
        style={{ ...boardBackground(template) }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />
      {actions.filter((action) => action.kind !== 'stroke').map((action) => {
        const style = { left: `${(action.x / 1200) * 100}%`, top: `${(action.y / 720) * 100}%` };
        if (action.kind === 'text') {
          return <div key={action.id} className="class-stamp text-stamp" style={style}>{action.text}</div>;
        }
        if (action.kind === 'shape') {
          return <div key={action.id} className={`class-stamp shape-stamp ${action.shape || 'rect'}`} style={style} />;
        }
        if (action.kind === 'arrow') {
          return <div key={action.id} className={`class-stamp arrow-stamp ${action.arrowMode || 'right'}`} style={style}><ArrowUpRight size={24} /></div>;
        }
        return null;
      })}
    </div>
  );
}

export default function ClassMode({ data, updateData, navigate }) {
  const current = data.sessions.find((session) => session.current) || data.sessions[0] || null;
  const students = current ? data.students.filter((student) => student.group === current.group) : [];
  const today = todayISO();
  const currentGrade = students[0]?.grade || current?.title || '';
  const resources = useMemo(() => (data.contentLibrary || []).filter((item) => matchesGrade(item, currentGrade)), [data.contentLibrary, currentGrade]);

  const [lastPraise, setLastPraise] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [points, setPoints] = useState({});
  const [view, setView] = useState('board');
  const [tool, setTool] = useState('pen');
  const [notes, setNotes] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [boardTemplate, setBoardTemplate] = useState('blank');
  const [selectedResourceId, setSelectedResourceId] = useState(data.settings?.classResourceId || resources[0]?.id || '');
  const [flowIndex, setFlowIndex] = useState(0);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationColor, setAnnotationColor] = useState('#d7ad35');
  const [annotationMode, setAnnotationMode] = useState('note');
  const [boardActions, setBoardActions] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [shapeKind, setShapeKind] = useState('rect');
  const [arrowMode, setArrowMode] = useState('right');
  const [boardText, setBoardText] = useState('');
  const [zoom, setZoom] = useState(1);
  const [boardReady, setBoardReady] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [challengeMode, setChallengeMode] = useState('battle');
  const [challengePickIds, setChallengePickIds] = useState([]);
  const [challengeNotice, setChallengeNotice] = useState('');
  const boardRef = useRef(null);

  const selectedResource = useMemo(
    () => resources.find((item) => String(item.id) === String(selectedResourceId)) || resources[0] || null,
    [resources, selectedResourceId]
  );
  const flow = useMemo(() => normalizeSequence(selectedResource?.sequence), [selectedResource]);
  const activeFlow = flow[flowIndex] || flow[0] || 'preview';
  const resourceAnnotations = Array.isArray(selectedResource?.annotations) ? selectedResource.annotations : [];
  const relatedQuestions = useMemo(() => {
    const baseBank = [...questionBank, ...(data.customQuestionBank || [])];
    const ids = normalizeTags(selectedResource?.relatedQuestionIds || selectedResource?.questionIds || []);
    const byIds = ids.length ? ids.map((id) => baseBank.find((question) => String(question.id) === String(id))).filter(Boolean) : [];
    if (byIds.length) return byIds;
    if (!selectedResource) return [];
    return baseBank
      .filter((question) => question.grade === selectedResource.grade && question.unit === selectedResource.unit && question.lesson === selectedResource.lesson)
      .slice(0, 8);
  }, [data.customQuestionBank, selectedResource]);

  const recentRecordings = useMemo(() => (data.lessonRecordings || []).slice(0, 3), [data.lessonRecordings]);

  const saveSelectedResource = async (patch = {}) => {
    if (!selectedResource) return;
    const nextResources = (data.contentLibrary || []).map((resource) =>
      String(resource.id) === String(selectedResource.id)
        ? { ...resource, ...patch, updatedAt: new Date().toISOString() }
        : resource
    );
    await updateData({ ...data, contentLibrary: nextResources });
  };

  const captureBoardImage = () => {
    const canvas = boardRef.current?.querySelector('canvas');
    return canvas?.toDataURL('image/png') || '';
  };

  const buildLessonPayload = ({ includeBoardImage = false } = {}) => ({
    kind: 'lesson',
    sessionId: current?.id || null,
    sessionTitle: current?.title || '',
    group: current?.group || '',
    grade: currentGrade || '',
    date: today,
    teacher: identity.teacherName,
    title: selectedResource?.title || current?.title || '',
    summary: notes.trim() || selectedResource?.notes || '',
    notes: notes.trim() || selectedResource?.notes || '',
    resource: selectedResource ? {
      id: selectedResource.id,
      title: selectedResource.title,
      type: selectedResource.type,
      unit: selectedResource.unit,
      lesson: selectedResource.lesson,
      grade: selectedResource.grade,
      url: selectedResource.url,
      fileName: selectedResource.fileName,
      notes: selectedResource.notes,
      sequence: normalizeSequence(selectedResource.sequence),
      tags: normalizeTags(selectedResource.tags),
      pageStart: selectedResource.pageStart,
      pageEnd: selectedResource.pageEnd,
    } : null,
    flow: flow.map((step) => step),
    selectedStudentId: selectedStudent?.id || null,
    selectedStudentName: selectedStudent?.name || '',
    attendance: students.map((student) => ({ studentId: student.id, status: attendanceMap[student.id] || 'pending' })),
    points,
    players: students.map((student) => ({ id: student.id, name: student.name, code: student.code })),
    challengeMode,
    challengePlayers: challengePickIds.map((id) => {
      const student = students.find((item) => item.id === id);
      return student ? { id: student.id, name: student.name, code: student.code } : null;
    }).filter(Boolean),
    questions: relatedQuestions.map((question) => ({
      id: question.id,
      text: question.text,
      lesson: question.lesson,
      unit: question.unit,
      type: question.type,
      answer: question.answer,
      options: question.options,
    })),
    boardActions: boardActions.slice(-100),
    resourceAnnotations,
    boardTemplate,
    zoom,
    boardImage: includeBoardImage ? captureBoardImage().slice(0, 150000) : '',
    createdAt: new Date().toISOString(),
  });

  const recordLesson = async ({ copyLink = false } = {}) => {
    const payload = buildLessonPayload({ includeBoardImage: true });
    const share = buildShareLink('lesson', payload);
    const recording = {
      id: Date.now(),
      ...payload,
      shareToken: share.token || '',
      shareUrl: share.url,
    };
    const lessonRecordings = [recording, ...(data.lessonRecordings || [])].slice(0, 120);
    const nextSessions = data.sessions.map((session) =>
      session.id === current.id ? { ...session, summary: payload.summary, updatedAt: new Date().toISOString(), recordingId: recording.id, recordingShareUrl: share.url } : session
    );
    const settings = {
      ...data.settings,
      classResourceId: selectedResource?.id || '',
      classResourceTitle: selectedResource?.title || '',
      classResourceType: selectedResource?.type || '',
      classResourceFileName: selectedResource?.fileName || '',
      classResourcePinnedAt: new Date().toISOString(),
    };
    await updateData({ ...data, sessions: nextSessions, lessonRecordings, settings });
    setShareNotice(copyLink ? (await copyToClipboard(share.url) ? 'تم نسخ رابط الطالب بنجاح.' : 'تم تجهيز الرابط لكن تعذر نسخه.') : 'تم حفظ تسجيل الحصة.');
    return { ...payload, share };
  };

  const buildChallengePayload = () => {
    const picked = challengePickIds
      .map((id) => students.find((student) => student.id === id))
      .filter(Boolean);
    const teamGold = picked.filter((_, index) => index % 2 === 0);
    const teamBlack = picked.filter((_, index) => index % 2 === 1);
    return {
      kind: 'game',
      mode: challengeMode,
      roomTitle: challengeMode === 'teams' ? 'تحدي الفرق داخل الحصة' : 'تحدي طالبين داخل الحصة',
      gradeKey: currentGrade?.includes('الرابع') ? '4' : currentGrade?.includes('الخامس') ? '5' : currentGrade?.includes('السادس') ? '6' : currentGrade?.includes('الأول الإعدادي') ? '7' : currentGrade?.includes('الثاني الإعدادي') ? '8' : '6',
      grade: currentGrade || current.title,
      unit: selectedResource?.unit || current.title || '',
      focusResourceId: selectedResource?.id || null,
      playerOne: picked[0]?.id || null,
      playerTwo: picked[1]?.id || null,
      playerIds: picked.map((student) => student.id),
      teamGold: teamGold.map((student) => ({ id: student.id, name: student.name, code: student.code })),
      teamBlack: teamBlack.map((student) => ({ id: student.id, name: student.name, code: student.code })),
      sessionId: current.id,
      sessionTitle: current.title,
    };
  };

  const startClassChallenge = async ({ copyLink = false } = {}) => {
    if (!challengePickIds.length || (challengeMode === 'battle' && challengePickIds.length < 2)) {
      setChallengeNotice('اختر طالبين على الأقل لبدء التحدي.');
      return;
    }
    const payload = buildChallengePayload();
    const share = buildShareLink('game', payload);
    const nextSettings = {
      ...data.settings,
      pendingChallenge: payload,
    };
    await updateData({ ...data, settings: nextSettings, gameRooms: [{ id: share.token || `room-${Date.now()}`, ...payload, inviteCode: share.token || '', inviteUrl: share.url, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...(data.gameRooms || [])].slice(0, 40) });
    if (copyLink) {
      setChallengeNotice(await copyToClipboard(share.url) ? 'تم نسخ رابط التحدي.' : 'تم تجهيز الرابط ولم ينسخ.');
    } else {
      setChallengeNotice('تم تجهيز تحدي الحصة داخل الألعاب.');
      if (typeof navigate === 'function') navigate('games');
    }
  };

  const addAnnotation = async () => {
    if (!annotationText.trim() || !selectedResource) return;
    const next = [
      ...resourceAnnotations,
      {
        id: Date.now(),
        text: annotationText.trim(),
        color: annotationColor,
        mode: annotationMode,
        createdAt: new Date().toISOString()
      }
    ];
    await saveSelectedResource({ annotations: next });
    setAnnotationText('');
  };

  const removeAnnotation = async (id) => {
    if (!selectedResource) return;
    const next = resourceAnnotations.filter((item) => item.id !== id);
    await saveSelectedResource({ annotations: next });
  };

  useEffect(() => {
    if (!resources.length) return;
    if (!selectedResource || !resources.some((item) => String(item.id) === String(selectedResourceId))) {
      setSelectedResourceId(resources[0].id);
    }
  }, [resources, selectedResource, selectedResourceId]);

  useEffect(() => {
    setFlowIndex(0);
    setNotes(selectedResource?.notes || '');
  }, [selectedResource?.id]);

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
      ? data.attendance.map((item) => (item.id === existing.id ? { ...item, status } : item))
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

  const saveBoard = () => {
    const canvas = boardRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `شرح-${current?.title || 'الحصة'}-${today}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const saveLessonState = async () => {
    if (!current) return;
    await recordLesson({ copyLink: false });
  };

  const endClass = async () => {
    await recordLesson({ copyLink: false });
    navigate('dashboard');
  };

  const undoBoard = () => {
    setBoardActions((currentActions) => {
      if (!currentActions.length) return currentActions;
      const last = currentActions[currentActions.length - 1];
      setRedoStack((redo) => [last, ...redo]);
      return currentActions.slice(0, -1);
    });
  };

  const redoBoard = () => {
    setRedoStack((currentRedo) => {
      if (!currentRedo.length) return currentRedo;
      const [next, ...rest] = currentRedo;
      setBoardActions((currentActions) => [...currentActions, next]);
      return rest;
    });
  };

  const clearBoard = () => {
    setBoardActions([]);
    setRedoStack([]);
  };

  const handleBoardAction = (action) => {
    setBoardActions((currentActions) => [...currentActions, { ...action, id: Date.now() + Math.random() }]);
    setRedoStack([]);
    if (action.kind === 'stroke') setTool(action.tool || 'pen');
  };

  useEffect(() => {
    if (view === 'students' && students.length) {
      setSelectedStudent((currentStudent) => currentStudent || students[0]);
    }
  }, [view, students]);

  useEffect(() => {
    if (!students.length) {
      setChallengePickIds([]);
      return;
    }
    setChallengePickIds((currentIds) => {
      const valid = currentIds.filter((id) => students.some((student) => student.id === id));
      if (valid.length) return valid;
      return students.slice(0, challengeMode === 'teams' ? Math.min(4, students.length) : 2).map((student) => student.id);
    });
  }, [students, challengeMode]);

  if (!current) {
    return <section className="page class-mode-page"><div className="panel empty-state"><h2>لا توجد حصة حالية</h2><p>حدد الحصة الحالية أولًا من قسم الحصص والمجموعات.</p><button className="primary-btn" onClick={() => navigate('sessions')} type="button">فتح الحصص</button></div></section>;
  }

  const boardStats = [
    { label: 'الصف', value: currentGrade || '—' },
    { label: 'الدرس', value: selectedResource?.lesson || selectedResource?.title || current.title },
    { label: 'خط سير الحصة', value: flowLabels[activeFlow] || activeFlow },
    { label: 'التاريخ', value: formatDateAr(today) },
  ];

  const currentCount = students.length;

  return (
    <section className={`page classmode-scene ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="classmode-hero">
        <div className="classmode-ribbon classmode-ribbon-left">
          <img src="/identity/mostafa-barakat-icon.png" alt={current.title} />
          <div>
            <strong>المبدع</strong>
            <small>لتعليم ممتع</small>
          </div>
        </div>

        <div className="classmode-hero-copy">
          <span className="eyebrow">شرح الدرس</span>
          <h2>منصة المُبدع</h2>
          <p>{current.title} — {current.group}</p>
        </div>

        <div className="classmode-teacher-card">
          <div className="classmode-teacher-avatar"><img src="/identity/mostafa-barakat.jpg" alt="المُبدع مصطفى بركات" /></div>
          <div>
            <strong>المُبدع مصطفى بركات</strong>
            <small>معلم تاريخ ودراسات</small>
          </div>
        </div>
      </div>

      <div className="classmode-layout">
        <section className="classmode-board-panel">
          <div className="classmode-board-topbar">
            <div className="classmode-current-badge live-badge">● حصة مباشرة</div>
            <div className="classmode-metrics">
              <div><Users size={17} /><b>{currentCount}</b><span>الطلاب</span></div>
              <div><b>{counts.present || 0}</b><span>حاضر</span></div>
              <div><b>{counts.absent || 0}</b><span>غائب</span></div>
              <div><b>{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</b><span>مدة الحصة</span></div>
            </div>
            <div className="classmode-top-actions">
              <button className="icon-action" onClick={() => setRunning((value) => !value)} type="button">{running ? <CirclePause /> : <CirclePlay />}</button>
              <button className="icon-action" onClick={() => setSeconds(0)} type="button"><TimerReset /></button>
              <button className="icon-action" onClick={() => setFullscreen((value) => !value)} type="button"><Maximize2 /></button>
              <button className="secondary-btn" onClick={() => recordLesson({ copyLink: true })} type="button">رابط الطالب</button>
              <button className="danger-btn" onClick={endClass} type="button">إنهاء الحصة</button>
            </div>
          </div>

          <div className="classmode-resource-card">
            <div>
              <span className="eyebrow">المورد المرتبط بالحصة</span>
              <h3>{selectedResource?.title || current.title}</h3>
              <p>{selectedResource?.unit || current.group} — {selectedResource?.lesson || current.title}</p>
            </div>
            <div className="classmode-flow-row">
              {flow.map((step, index) => (
                <button key={step} className={index === flowIndex ? 'active' : ''} onClick={() => setFlowIndex(index)} type="button">{flowLabels[step] || step}</button>
              ))}
            </div>
            <div className="classmode-resource-actions">
              <button className="secondary-btn" onClick={() => setView('board')} type="button"><Presentation size={16} /> فتح السبورة</button>
              <button className="secondary-btn" onClick={() => recordLesson({ copyLink: true })} type="button"><ScanLine size={16} /> رابط الطالب</button>
              <button className="primary-btn" onClick={saveLessonState} type="button"><Save size={16} /> حفظ الملخص</button>
            </div>
          </div>

          <div className="classmode-board-frame">
            <div className="classmode-board-surface">
              <div className="classmode-board-sidebar-left">
                <div className="classmode-minibrand">
                  <strong>المبدع</strong>
                  <small>تعليم ممتع</small>
                </div>
                <div className="classmode-lesson-bullets">
                  {boardStats.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
                </div>
                <div className="classmode-lesson-tip">
                  <span>فكر:</span>
                  <p>لماذا تحتاج المجتمعات إلى وجود دولة واحدة؟</p>
                </div>
              </div>

              <div className="classmode-board-stage">
                {selectedResource && (
                  <div className="classmode-resource-preview">
                    <div className="resource-preview-head">
                      <strong>{selectedResource.title}</strong>
                      <small>{selectedResource.fileName || selectedResource.mimeType || selectedResource.type}</small>
                    </div>
                    <div className="resource-preview-body">
                      {selectedResource.type === 'image' && selectedResource.url && <img src={selectedResource.url} alt={selectedResource.title} />}
                      {selectedResource.type === 'video' && selectedResource.url && <video controls src={selectedResource.url} />}
                      {selectedResource.type === 'audio' && selectedResource.url && <audio controls src={selectedResource.url} />}
                      {selectedResource.type === 'pdf' && selectedResource.url && <iframe title={selectedResource.title} src={selectedResource.url} />}
                      {!['image', 'video', 'audio', 'pdf'].includes(selectedResource.type) && <div className="resource-placeholder">المورد جاهز للشرح والكتابة فوقه.</div>}
                      {resourceAnnotations.length > 0 && <div className="resource-annotation-overlay">{resourceAnnotations.map((note) => <span key={note.id} style={{ background: note.color }}>{note.text}</span>)}</div>}
                    </div>
                  </div>
                )}

                <CanvasOverlay
                  actions={boardActions}
                  onDrawAction={handleBoardAction}
                  template={boardTemplate}
                  zoom={zoom}
                  boardRef={boardRef}
  
                  tool={tool}
                  selectedColor={annotationColor}
                  shapeKind={shapeKind}
                  arrowMode={arrowMode}
                  textValue={boardText}
                  setTextValue={setBoardText}
                  boardReady={boardReady}
                  setBoardReady={setBoardReady}
                />
              </div>
            </div>
          </div>

          <div className="classmode-toolbar">
            <div className="classmode-tool-group">
              {toolOptions.map(({ key, label, icon: Icon }) => (
                <button key={key} className={tool === key ? 'active' : ''} onClick={() => setTool(key)} type="button"><Icon size={18} />{label}</button>
              ))}
            </div>
            <div className="classmode-tool-group compact">
              {boardTemplates.map(({ key, label, icon: Icon }) => (
                <button key={key} className={boardTemplate === key ? 'active' : ''} onClick={() => setBoardTemplate(key)} type="button"><Icon size={17} />{label}</button>
              ))}
            </div>
            <div className="classmode-tool-group compact">
              {shapeOptions.map((shape) => <button key={shape.key} className={shapeKind === shape.key ? 'active' : ''} onClick={() => setShapeKind(shape.key)} type="button">{shape.label}</button>)}
              <button className={arrowMode === 'right' ? 'active' : ''} onClick={() => setArrowMode('right')} type="button">سهم يمين</button>
              <button className={arrowMode === 'down' ? 'active' : ''} onClick={() => setArrowMode('down')} type="button">سهم لأسفل</button>
            </div>
            <div className="classmode-tool-group compact">
              <button onClick={() => setZoom((value) => Math.min(2, value + 0.15))} type="button"><ZoomIn size={17} /> تكبير</button>
              <button onClick={() => setZoom((value) => Math.max(1, value - 0.15))} type="button"><ZoomOut size={17} /> تصغير</button>
              <button onClick={undoBoard} type="button"><Undo2 size={17} /> Undo</button>
              <button onClick={redoBoard} type="button"><Redo2 size={17} /> Redo</button>
              <button onClick={clearBoard} type="button"><RotateCcw size={17} /> مسح</button>
              <button onClick={saveBoard} type="button"><Save size={17} /> حفظ</button>
            </div>
          </div>
        </section>

        <aside className="classmode-side-column">
          <article className="panel classmode-side-panel classmode-students-panel">
            <div className="panel-heading compact">
              <div><span className="eyebrow">الطلاب والنقاط</span><h3>الترتيب الحالي</h3></div>
              <Trophy size={20} />
            </div>
            <div className="classmode-students-list">
              {students.map((student) => {
                const status = attendanceMap[student.id];
                const score = points[student.id] || 0;
                return (
                  <button key={student.id} className={`classmode-student-row ${selectedStudent?.id === student.id ? 'active' : ''}`} onClick={() => setSelectedStudent(student)} type="button">
                    <span className="student-code">{student.code}</span>
                    <div>
                      <strong>{student.name}</strong>
                      <small>{student.grade}</small>
                    </div>
                    <b className={`attendance-dot ${status || 'pending'}`}>{statusLabels[status] || 'لم يسجل'}</b>
                    <span className="student-score">{score}</span>
                  </button>
                );
              })}
            </div>
            <div className="classmode-student-actions">
              <button className="secondary-btn" onClick={randomStudent} type="button"><Shuffle size={16} /> اختيار عشوائي</button>
              <button className="secondary-btn" onClick={() => navigate('attendance')} type="button"><Camera size={16} /> مسح QR</button>
              <button className="secondary-btn" onClick={() => navigate('games')} type="button"><Gamepad2 size={16} /> جولة سريعة</button>
              <button className="secondary-btn" onClick={() => selectedStudent && praise(selectedStudent, 'comic')} disabled={!selectedStudent} type="button"><Sparkles size={16} /> تشجيع</button>
            </div>
            {selectedStudent && (
              <div className="classmode-selected-student">
                <Trophy size={18} />
                <div><span>الطالب المحدد</span><strong>{selectedStudent.name}</strong></div>
                <b>{points[selectedStudent.id] || 0} نقطة</b>
              </div>
            )}
          </article>

          <article className="panel classmode-side-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">الأنشطة</span><h3>خطة سير الحصة</h3></div><MailCheck size={18} /></div>
            <div className="classmode-activity-list">
              {flow.map((step, index) => <button key={step} className={index === flowIndex ? 'active' : ''} onClick={() => setFlowIndex(index)} type="button">{flowLabels[step] || step}</button>)}
            </div>
            <div className="classmode-resource-summary">{selectedResource?.notes || 'اختر موردًا لتظهر الملاحظات هنا.'}</div>
            <div className="classmode-resource-tags">{normalizeTags(selectedResource?.tags).map((tag) => <span key={tag}>#{tag}</span>)}</div>
          </article>

          <article className="panel classmode-side-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">المورد</span><h3>الملفات والوسائط</h3></div><File size={18} /></div>
            <div className="classmode-resource-list">
              {resources.slice(0, 6).map((resource) => (
                <button key={resource.id} className={String(selectedResourceId) === String(resource.id) ? 'active' : ''} onClick={() => setSelectedResourceId(resource.id)} type="button">
                  {resource.type === 'image' ? <FileImage size={16} /> : resource.type === 'video' ? <Video size={16} /> : resource.type === 'map' ? <Map size={16} /> : resource.type === 'audio' ? <Volume2 size={16} /> : <FileText size={16} />}
                  <span>{resource.title}</span>
                  <small>{resource.lesson}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="panel classmode-side-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">الكتابة</span><h3>ملاحظات فوق المورد</h3></div><StickyNote size={18} /></div>
            <div className="annotation-controls">
              <select value={annotationMode} onChange={(e) => setAnnotationMode(e.target.value)}>
                <option value="note">ملاحظة</option>
                <option value="highlight">تمييز</option>
                <option value="question">سؤال</option>
                <option value="answer">إجابة</option>
              </select>
              <input value={annotationText} onChange={(e) => setAnnotationText(e.target.value)} placeholder="اكتب الملاحظة أو الشرح هنا" />
              <input type="color" value={annotationColor} onChange={(e) => setAnnotationColor(e.target.value)} />
            </div>
            <div className="annotation-actions">
              <button className="primary-btn" onClick={addAnnotation} type="button"><StickyNote size={16}/> إضافة</button>
              <button className="secondary-btn" onClick={() => setAnnotationText('')} type="button">مسح النص</button>
            </div>
            <div className="annotation-list">
              {resourceAnnotations.length ? resourceAnnotations.map((note) => (
                <div className="annotation-chip" key={note.id} style={{ borderColor: note.color }}>
                  <span style={{ background: note.color }}>{note.mode === 'highlight' ? 'تمييز' : note.mode === 'question' ? 'سؤال' : note.mode === 'answer' ? 'إجابة' : 'ملاحظة'}</span>
                  <p>{note.text}</p>
                  <button className="text-btn danger-text" onClick={() => removeAnnotation(note.id)} type="button">حذف</button>
                </div>
              )) : <small className="settings-help">لا توجد ملاحظات فوق المورد بعد.</small>}
            </div>
          </article>

          <article className="panel classmode-side-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">التسجيلات</span><h3>آخر الحصص</h3></div><Presentation size={18} /></div>
            <div className="classmode-recordings-list">
              {recentRecordings.length ? recentRecordings.map((recording) => (
                <div className="classmode-recording-item" key={recording.id}>
                  <strong>{recording.sessionTitle || recording.title || 'حصة محفوظة'}</strong>
                  <small>{formatDateAr(recording.createdAt)} • {recording.grade || 'الصف'}</small>
                  <div className="classmode-recording-actions">
                    <button className="secondary-btn" type="button" onClick={() => copyToClipboard(recording.shareUrl || '')}>نسخ الرابط</button>
                    <button className="secondary-btn" type="button" onClick={() => window.open(recording.shareUrl || '#', '_blank', 'noopener,noreferrer')}>فتح</button>
                  </div>
                </div>
              )) : <small className="settings-help">لا توجد تسجيلات محفوظة بعد.</small>}
            </div>
          </article>

          <article className="panel classmode-side-panel classmode-challenge-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">التحديات داخل الحصة</span><h3>طالبين أو فرق</h3></div><Gamepad2 size={18} /></div>
            <div className="classmode-challenge-switch">
              <button type="button" className={challengeMode === 'battle' ? 'active' : ''} onClick={() => setChallengeMode('battle')}>طالبين</button>
              <button type="button" className={challengeMode === 'teams' ? 'active' : ''} onClick={() => setChallengeMode('teams')}>فرق</button>
            </div>
            <div className="classmode-challenge-grid">
              {students.map((student) => {
                const active = challengePickIds.includes(student.id);
                return (
                  <button key={student.id} type="button" className={active ? 'active' : ''} onClick={() => setChallengePickIds((currentIds) => {
                    if (active) return currentIds.filter((id) => id !== student.id);
                    if (challengeMode === 'battle' && currentIds.length >= 2) return [currentIds[1], student.id];
                    return [...currentIds, student.id];
                  })}>
                    <strong>{student.name}</strong>
                    <small>{student.code}</small>
                  </button>
                );
              })}
            </div>
            <div className="classmode-challenge-summary">
              <span>المحددون: {challengePickIds.length}</span>
              <small>{challengeMode === 'teams' ? 'سيتم تقسيمهم إلى فريق ذهبي وفريق أسود' : 'سيبدأ التحدي بين طالبين داخل الحصة'}</small>
            </div>
            {challengeNotice && <div className="settings-notice">{challengeNotice}</div>}
            <div className="classmode-summary-actions">
              <button className="primary-btn" onClick={() => startClassChallenge({ copyLink: false })} type="button"><Gamepad2 size={16}/> فتح داخل الألعاب</button>
              <button className="secondary-btn" onClick={() => startClassChallenge({ copyLink: true })} type="button">نسخ الرابط</button>
            </div>
          </article>

          <article className="panel classmode-side-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">ملخص</span><h3>تسجيل الحصة</h3></div><Save size={18} /></div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اكتب النقاط المهمة، الواجب، أو الطلاب المحتاجين للمتابعة..." rows="8" />
            <div className="classmode-summary-actions">
              <button className="primary-btn" onClick={saveLessonState} type="button"><Save size={16}/> حفظ</button>
              <button className="secondary-btn" onClick={() => recordLesson({ copyLink: true })} type="button">نسخ الرابط</button>
              <button className="secondary-btn" onClick={() => setNotes('')} type="button">تفريغ</button>
            </div>
          </article>
        </aside>
      </div>

      {lastPraise && <div className="spoken-banner">🔊 {lastPraise}</div>}
      {shareNotice && <div className="spoken-banner">{shareNotice}</div>}
      {view === 'students' && students.length > 0 && (
        <div className="classmode-students-footer">
          <button className="secondary-btn" onClick={() => setView('board')} type="button">العودة إلى السبورة</button>
          <button className="secondary-btn" onClick={() => navigate('gradeScanner')} type="button">رصد الدرجات</button>
          <button className="secondary-btn" onClick={() => navigate('games')} type="button">الألعاب التعليمية</button>
        </div>
      )}
    </section>
  );
}
