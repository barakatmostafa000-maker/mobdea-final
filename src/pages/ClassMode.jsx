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
  Clock,
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
  MousePointer2,
  Move,
} from 'lucide-react';
import { identity } from '../config/identity';
import { buildEncouragementPhrase, speakArabic } from '../services/voice';
import { openResourceDocument } from '../services/nativePlatform';
import {
  nativeScreenRecordingAvailable,
  pauseNativeScreenRecording,
  resumeNativeScreenRecording,
  startNativeScreenRecording,
  stopNativeScreenRecording,
} from '../services/screenRecording';
import { buildShareLink, copyToClipboard } from '../services/share';
import { questionBank } from '../data/questionBank';
import { queueAbsenceNotification } from '../services/notifications';
import { deleteAsset, importAssetBlob, importLegacyDataUrl } from '../services/assetStore';
import { useAssetUrl } from '../hooks/useAssetUrl';
import { usePdfPage } from '../hooks/usePdfPage';
import { todayISO, formatDateAr } from '../utils/time';
import LessonMapStudio from '../components/maps/LessonMapStudio';
import MediaNavigator from '../components/classmode/MediaNavigator';
import LessonRecordingItem from '../components/classmode/LessonRecordingItem';
import TeacherLivePanel from '../components/live/TeacherLivePanel';
import { getAllLibraryGrades,
  getLessonsForGrade, getLessonModeResources, resolveDefaultLesson, clampLessonPage } from '../services/libraryModel';

const statusLabels = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'غياب بعذر' };
const toolOptions = [
  { key: 'pen', label: 'قلم', icon: PenTool },
  { key: 'select', label: 'تحديد', icon: MousePointer2 },
  { key: 'highlighter', label: 'هايلايتر', icon: Highlighter },
  { key: 'shape', label: 'أشكال', icon: Shapes },
  { key: 'text', label: 'نص', icon: Type },
  { key: 'arrow', label: 'سهم', icon: ArrowUpRight },
  { key: 'eraser', label: 'ممحاة', icon: Eraser },
  { key: 'move', label: 'تحريك', icon: Move },
];
const shapeOptions = [
  { key: 'rect', label: 'مستطيل' },
  { key: 'circle', label: 'دائرة' },
  { key: 'triangle', label: 'مثلث' },
  { key: 'line', label: 'خط' },
];
const boardTemplates = [
  { key: 'history', label: 'تاريخي', icon: BookOpen },
  { key: 'geography', label: 'جغرافي', icon: Map },
  { key: 'manuscript', label: 'مخطوطات', icon: StickyNote },
  { key: 'blank', label: 'فارغ', icon: X },
  { key: 'grid', label: 'شبكة', icon: LayoutGrid },
  { key: 'lines', label: 'سطور', icon: Waves },
  { key: 'focus', label: 'تركيز', icon: Presentation },
];
const flowLabels = { preview: 'تمهيد', board: 'شرح على السبورة', practice: 'تدريب', quiz: 'تقويم سريع' };
const modeResourceTypes = {
  pdf: ['textbook', 'pdf'],
  images: ['image'],
  videos: ['video'],
  audio: ['audio'],
  files: ['file', 'document', 'slides', 'link'],
};

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
    case 'history':
      return {
        backgroundImage: 'radial-gradient(circle at 50% 45%, rgba(139,92,35,.10), transparent 32%), repeating-linear-gradient(0deg, rgba(111,78,45,.025) 0 1px, transparent 1px 7px), linear-gradient(145deg, #f6edda, #fffaf0)',
      };
    case 'geography':
      return {
        backgroundImage: 'radial-gradient(circle at 50% 45%, rgba(38,113,92,.09), transparent 32%), linear-gradient(rgba(46,95,78,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(46,95,78,.045) 1px, transparent 1px), linear-gradient(145deg, #f2f7ef, #fbfff9)',
        backgroundSize: 'auto, 42px 42px, 42px 42px, auto',
      };
    case 'manuscript':
      return {
        backgroundImage: 'radial-gradient(ellipse at center, rgba(168,116,52,.06), transparent 62%), repeating-linear-gradient(0deg, rgba(103,68,32,.025) 0 1px, transparent 1px 5px), linear-gradient(145deg, #f1dfbc, #fff7e6)',
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
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function drawBoardIdentity(ctx, template, width, height) {
  if (!['history', 'geography', 'manuscript'].includes(template)) return;
  const backgrounds = {
    history: ['#f6edda', '#fffaf0'],
    geography: ['#eef6ec', '#fbfff9'],
    manuscript: ['#f1dfbc', '#fff7e6'],
  };
  const [start, end] = backgrounds[template];
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = template === 'geography' ? '#1f6b55' : '#6d421d';
  ctx.lineWidth = 2;
  for (let x = 40; x < width; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 35; y < height; y += 75) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  try {
    const logo = await dataUrlToImage(identity.logo);
    const target = Math.min(width, height) * 0.42;
    ctx.save();
    ctx.globalAlpha = 0.085;
    ctx.drawImage(logo, (width - target) / 2, (height - target) / 2, target, target);
    ctx.restore();
  } catch {
    // The board remains usable if the optional brand image cannot be decoded.
  }

  try {
    const portrait = await dataUrlToImage(identity.portrait);
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    ctx.arc(width - 68, height - 72, 43, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(portrait, width - 111, height - 115, 86, 86);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,8,.72)';
    ctx.fillRect(width - 310, height - 56, 224, 38);
    ctx.fillStyle = '#f1c869';
    ctx.font = '700 16px Tahoma, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(identity.teacherName, width - 198, height - 34);
    ctx.restore();
  } catch {
    // Portrait is decorative and must never block saving the board.
  }
}

function drawStamp(ctx, stamp) {
  const x = stamp.x;
  const y = stamp.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = stamp.color || '#d7ad35';
  ctx.strokeStyle = stamp.color || '#d7ad35';
  ctx.lineWidth = 4;
  ctx.font = `${stamp.fontWeight || 700} ${stamp.fontSize || 22}px ${stamp.fontFamily || 'Tahoma, Arial, sans-serif'}`;

  if (stamp.kind === 'text') {
    const lines = String(stamp.text || '').split('\n').slice(0, 5);
    const style = stamp.textStyle || 'plain';
    if (style !== 'plain') {
      const palette = style === 'geography'
        ? { fill: 'rgba(19,88,68,.90)', stroke: '#d8c36a' }
        : style === 'event'
          ? { fill: 'rgba(108,47,32,.92)', stroke: '#e4b25c' }
          : { fill: 'rgba(57,36,18,.92)', stroke: '#d7ad35' };
      ctx.fillStyle = palette.fill;
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = 3;
      ctx.fillRect(-18, -12, Math.max(230, String(stamp.text || '').length * 15), Math.max(62, lines.length * 31 + 20));
      ctx.strokeRect(-18, -12, Math.max(230, String(stamp.text || '').length * 15), Math.max(62, lines.length * 31 + 20));
      ctx.fillStyle = '#fff7df';
    }
    lines.forEach((line, index) => ctx.fillText(line, 0, 25 + index * 31));
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

function boardActionBounds(action) {
  if (action.kind === 'stroke') {
    const points = action.points || [];
    if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { x: Math.min(...xs) - 15, y: Math.min(...ys) - 15, width: Math.max(...xs) - Math.min(...xs) + 30, height: Math.max(...ys) - Math.min(...ys) + 30 };
  }
  if (action.kind === 'text') return { x: action.x, y: action.y, width: Math.max(140, String(action.text || '').length * 19), height: 80 };
  return { x: action.x, y: action.y, width: 170, height: 115 };
}

function moveBoardAction(action, dx, dy) {
  if (action.kind === 'stroke') return { ...action, points: (action.points || []).map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  return { ...action, x: action.x + dx, y: action.y + dy };
}

function drawBoardAction(ctx, action, selected = false) {
  if (action.kind === 'stroke') {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = action.tool === 'highlighter' ? 0.3 : 1;
    ctx.globalCompositeOperation = action.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = action.tool === 'eraser' ? 'rgba(0,0,0,1)' : action.color || '#111827';
    ctx.lineWidth = action.tool === 'eraser' ? 22 : action.tool === 'highlighter' ? 16 : action.width || 4;
    ctx.beginPath();
    (action.points || []).forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  } else {
    drawStamp(ctx, action);
  }
  if (selected) {
    const bounds = boardActionBounds(action);
    ctx.save();
    ctx.strokeStyle = '#d7ad35';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 6]);
    ctx.strokeRect(bounds.x, bounds.y, Math.max(20, bounds.width), Math.max(20, bounds.height));
    ctx.restore();
  }
}

function CanvasOverlay({ actions, onDrawAction, onMoveAction, onSelectAction, selectedActionId, template, zoom, boardRef, tool, selectedColor, strokeWidth, shapeKind, arrowMode, textValue, textStyle, fontFamily, fontSize, boardReady, setBoardReady, hasResourceHeader = false }) {
  const canvasRef = useRef(null);
  const currentStroke = useRef(null);
  const drawing = useRef(false);
  const moving = useRef(null);

  const render = (preview = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    actions.forEach((action) => drawBoardAction(ctx, action, action.id === selectedActionId));
    if (preview) drawBoardAction(ctx, preview, false);
  };

  useEffect(() => { render(); }, [actions, selectedActionId]);

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

  const findAction = (point) => {
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const bounds = boardActionBounds(actions[index]);
      if (point.x >= bounds.x && point.x <= bounds.x + Math.max(20, bounds.width) && point.y >= bounds.y && point.y <= bounds.y + Math.max(20, bounds.height)) return actions[index];
    }
    return null;
  };

  const onPointerDown = (event) => {
    if (!canvasRef.current) return;
    event.preventDefault();
    const point = getPoint(event);
    if (tool === 'select' || tool === 'move') {
      const action = findAction(point);
      onSelectAction(action?.id || null);
      if (tool === 'move' && action) moving.current = { action, start: point };
      return;
    }
    if (tool === 'text' || tool === 'shape' || tool === 'arrow') {
      let stampText = textValue.trim();
      if (tool === 'text' && !stampText) stampText = window.prompt('اكتب النص الذي تريد وضعه على السبورة:', '') || '';
      if (tool === 'text' && !stampText.trim()) return;
      onDrawAction({
        kind: tool,
        x: point.x,
        y: point.y,
        text: stampText || `سهم ${arrowMode}`,
        shape: shapeKind,
        arrowMode,
        color: selectedColor,
        textStyle,
        fontFamily,
        fontSize,
      });
      return;
    }

    drawing.current = true;
    currentStroke.current = {
      kind: 'stroke',
      tool,
      color: selectedColor,
      width: tool === 'highlighter' ? (strokeWidth || 4) * 2.5 : (strokeWidth || 4),
      points: [point],
    };
  };

  const onPointerMove = (event) => {
    if (moving.current) {
      event.preventDefault();
      const point = getPoint(event);
      onMoveAction(moveBoardAction(moving.current.action, point.x - moving.current.start.x, point.y - moving.current.start.y));
      return;
    }
    if (!drawing.current || !currentStroke.current) return;
    event.preventDefault();
    currentStroke.current.points.push(getPoint(event));
    render(currentStroke.current);
  };

  const onPointerUp = () => {
    if (moving.current) {
      moving.current = null;
      return;
    }
    if (drawing.current && currentStroke.current) onDrawAction(currentStroke.current);
    currentStroke.current = null;
    drawing.current = false;
  };

  return (
    <div ref={boardRef} className={`class-board-canvas-shell tool-${tool} board-theme-${template} ${hasResourceHeader ? 'has-resource-head' : ''}`} style={{ '--board-zoom': zoom }}>
      {!hasResourceHeader && ['history', 'geography', 'manuscript'].includes(template) && (
        <div className="classmode-board-identity" aria-hidden="true">
          <div className="classmode-history-ornament ornament-top" />
          <img className="classmode-board-watermark" src={identity.logo} alt="" />
          <div className="classmode-board-teacher-mark">
            <img src={identity.portrait} alt="" />
            <span><strong>{identity.teacherName}</strong><small>{identity.teacherTitle}</small></span>
          </div>
          <div className="classmode-history-ornament ornament-bottom" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={1200}
        height={720}
        className="class-board-canvas"
        style={hasResourceHeader || ['history', 'geography', 'manuscript'].includes(template) ? undefined : { ...boardBackground(template) }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />

    </div>
  );
}

export default function ClassMode({ data, updateData, navigate }) {
  const current = data.sessions.find((session) => session.current) || data.sessions[0] || null;
  const students = current ? data.students.filter((student) => student.group === current.group) : [];
  const today = todayISO();
  const availableGrades = useMemo(
    () => getAllLibraryGrades(data),
    [data],
  );

  const preferredLesson = useMemo(
    () =>
      (data.contentLibrary || []).find(
        (item) =>
          item.type === 'lesson' &&
          String(item.id) === String(data.settings?.classLessonId || ''),
      ) || null,
    [data.contentLibrary, data.settings?.classLessonId],
  );

  const currentGrade = useMemo(() => {
    const normalize = (value) =>
      String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const candidates = [
      preferredLesson?.grade,
      data.settings?.libraryGrade,
      current?.grade,
      students[0]?.grade,
      current?.group,
    ].filter(Boolean);

    const exactGrade = availableGrades.find((grade) =>
      candidates.some(
        (candidate) => normalize(candidate) === normalize(grade),
      ),
    );
    if (exactGrade) return exactGrade;

    const embeddedGrade = availableGrades.find((grade) =>
      candidates.some((candidate) => {
        const normalizedCandidate = normalize(candidate);
        const normalizedGrade = normalize(grade);
        return (
          normalizedCandidate.includes(normalizedGrade) ||
          normalizedGrade.includes(normalizedCandidate)
        );
      }),
    );

    return embeddedGrade || preferredLesson?.grade || students[0]?.grade || '';
  }, [
    availableGrades,
    current?.grade,
    current?.group,
    data.settings?.libraryGrade,
    preferredLesson?.grade,
    students,
  ]);
  const lessons = useMemo(() => getLessonsForGrade(data, currentGrade), [data, currentGrade]);
  const [activeLessonId, setActiveLessonId] = useState(data.settings?.classLessonId || '');
  const activeLesson = useMemo(
    () => resolveDefaultLesson(data, currentGrade, activeLessonId || data.settings?.classLessonId || ''),
    [data, currentGrade, activeLessonId]
  );
  const resources = useMemo(
    () => getLessonModeResources(data, currentGrade, activeLesson?.id || activeLessonId),
    [data, currentGrade, activeLesson?.id, activeLessonId]
  );

  const [lastPraise, setLastPraise] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [points, setPoints] = useState({});
  const [view, setView] = useState('board');
  const [tool, setTool] = useState('pen');
  const [notes, setNotes] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [contentMode, setContentMode] = useState('pdf');
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })), 30000);
    return () => clearInterval(timer);
  }, []);
  const [boardTemplate, setBoardTemplate] = useState('history');
  const [selectedResourceId, setSelectedResourceId] = useState(data.settings?.classResourceId || resources[0]?.id || '');
  const [flowIndex, setFlowIndex] = useState(0);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationColor, setAnnotationColor] = useState('#d7ad35');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [annotationMode, setAnnotationMode] = useState('note');
  const [boardActions, setBoardActions] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedBoardActionId, setSelectedBoardActionId] = useState(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingBackend, setRecordingBackend] = useState('');
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);
  const recordingCleanupRef = useRef(() => {});
  const recordingStopResolverRef = useRef(null);
  const recordingTimelineRef = useRef([]);
  const recordingBackendRef = useRef('');
  const stopRecordingOnUnmountRef = useRef(() => Promise.resolve());
  useEffect(() => {
    recordingBackendRef.current = recordingBackend;
  }, [recordingBackend]);
  useEffect(() => {
    if (!recordingActive || recordingPaused) return undefined;
    const timer = setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recordingActive, recordingPaused]);
  const [shapeKind, setShapeKind] = useState('rect');
  const [arrowMode, setArrowMode] = useState('right');
  const [boardText, setBoardText] = useState('');
  const [textStyle, setTextStyle] = useState('plain');
  const [fontFamily, setFontFamily] = useState('Tahoma, Arial, sans-serif');
  const [fontSize, setFontSize] = useState(24);
  const [zoom, setZoom] = useState(1);
  const [boardReady, setBoardReady] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [challengeMode, setChallengeMode] = useState('battle');
  const [challengePickIds, setChallengePickIds] = useState([]);
  const [challengeNotice, setChallengeNotice] = useState('');
  const boardRef = useRef(null);
  const sceneRef = useRef(null);

  const toggleFullscreen = async () => {
    const node = sceneRef.current;
    if (!node) { setFullscreen((value) => !value); return; }
    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen API unsupported or blocked (e.g. some in-app webviews) —
      // fall back to the CSS-only fullscreen overlay so the button still works.
      setFullscreen((value) => !value);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const selectedResource = useMemo(
    () => resources.find((item) => String(item.id) === String(selectedResourceId)) || resources[0] || null,
    [resources, selectedResourceId]
  );
  const selectedStorageResource = selectedResource?.virtualLessonTextbook || selectedResource?.virtualLessonRecording ? activeLesson : selectedResource;
  const selectedResourceUrl = useAssetUrl(selectedResource?.assetId, selectedResource?.url);

  useEffect(() => {
    if (!selectedResource) return;
    const mode = selectedResource.type === 'image'
      ? 'images'
      : selectedResource.type === 'video'
        ? 'videos'
        : selectedResource.type === 'audio'
          ? 'audio'
          : ['slides', 'document', 'file', 'link'].includes(selectedResource.type)
            ? 'files'
            : ['pdf', 'textbook'].includes(selectedResource.type)
              ? 'pdf'
              : null;
    if (mode && !modeResourceTypes[contentMode]?.includes(selectedResource.type)) {
      setContentMode(mode);
    }
  }, [selectedResource?.id]);

  const selectedExamUrl = useAssetUrl(selectedResource?.examAssetId, selectedResource?.examUrl);
  const [classPage, setClassPage] = useState(null);
  useEffect(() => {
    setClassPage(clampLessonPage(selectedResource?.pageStart || 1, selectedResource, 1));
  }, [selectedResource?.id, selectedResource?.pageStart, selectedResource?.pageEnd]);
  useEffect(() => {
    if (!recordingActive) return;
    const entry = {
      atSeconds: recordingSeconds,
      type: 'content-change',
      contentMode,
      resourceId: selectedResource?.id || '',
      resourceTitle: selectedResource?.title || '',
      page: classPage || 1,
      createdAt: new Date().toISOString(),
    };
    const previous = recordingTimelineRef.current.at(-1);
    if (
      previous?.contentMode === entry.contentMode
      && String(previous?.resourceId || '') === String(entry.resourceId)
      && Number(previous?.page || 0) === Number(entry.page || 0)
    ) return;
    recordingTimelineRef.current.push(entry);
  }, [recordingActive, contentMode, selectedResource?.id, selectedResource?.title, classPage]);
  const renderedPdf = usePdfPage(contentMode === 'pdf' && ['pdf', 'textbook'].includes(selectedResource?.type) ? selectedResourceUrl : '', classPage || 1);
  const boardLayerKey = contentMode === 'board'
    ? `board:${current?.id || 'session'}`
    : `${selectedResource?.id || 'blank'}:${classPage || 1}`;
  const displayResource = modeResourceTypes[contentMode]?.includes(selectedResource?.type) ? selectedResource : null;
  const boardToolsVisible = contentMode === 'board' || Boolean(displayResource && ['pdf', 'images'].includes(contentMode));
  useEffect(() => {
    const saved = contentMode === 'board'
      ? current?.boardLayers?.[boardLayerKey] || []
      : selectedStorageResource?.boardLayers?.[boardLayerKey] || [];
    setBoardActions(Array.isArray(saved) ? saved : []);
    setRedoStack([]);
    setSelectedBoardActionId(null);
  }, [boardLayerKey, selectedStorageResource?.boardLayers, current?.boardLayers]);
  useEffect(() => {
    if (!renderedPdf.pageCount) return;
    const upperBound = selectedResource?.pageEnd ? Math.min(Number(selectedResource.pageEnd), renderedPdf.pageCount) : renderedPdf.pageCount;
    if ((classPage || 1) > upperBound) setClassPage(upperBound);
  }, [classPage, renderedPdf.pageCount, selectedResource?.pageEnd]);
  const sessionQueue = useMemo(() => {
    if (activeLesson && resources.length) return resources;
    const pinned = data.settings?.classResourceQueue || [];
    return pinned
      .map((entry) => resources.find((item) => String(item.id) === String(entry.id)) || entry)
      .filter(Boolean);
  }, [activeLesson, data.settings?.classResourceQueue, resources]);
  const sessionQueueIndex = sessionQueue.findIndex((item) => String(item.id) === String(selectedResourceId));
  const goToQueueStep = (direction) => {
    if (!sessionQueue.length) return;
    const base = sessionQueueIndex === -1 ? 0 : sessionQueueIndex;
    const next = (base + direction + sessionQueue.length) % sessionQueue.length;
    setSelectedResourceId(sessionQueue[next].id);
    setFlowIndex(0);
  };
  const switchContentMode = (mode) => {
    setContentMode(mode);
    const wantedTypes = modeResourceTypes[mode];
    if (!wantedTypes) return;
    if (wantedTypes.includes(selectedResource?.type)) return;
    const match = resources.find((item) => wantedTypes.includes(item.type));
    if (match) setSelectedResourceId(match.id);
  };
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

  const recentRecordings = useMemo(() => (data.lessonRecordings || [])
    .slice()
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, 8), [data.lessonRecordings]);

  const saveSelectedResource = async (patch = {}) => {
    if (!selectedStorageResource) return;
    const nextResources = (data.contentLibrary || []).map((resource) =>
      String(resource.id) === String(selectedStorageResource.id)
        ? { ...resource, ...patch, updatedAt: new Date().toISOString() }
        : resource
    );
    await updateData({ ...data, contentLibrary: nextResources });
  };

  const selectLesson = async (lessonId) => {
    const lesson = lessons.find((item) => String(item.id) === String(lessonId)) || null;
    if (!lesson) return;
    const nextResources = getLessonModeResources(data, currentGrade, lesson.id);
    setActiveLessonId(lesson.id);
    setSelectedResourceId(nextResources[0]?.id || '');
    setContentMode(nextResources.some((item) => ['pdf', 'textbook'].includes(item.type)) ? 'pdf' : 'board');
    setFlowIndex(0);
    await updateData({
      ...data,
      settings: {
        ...data.settings,
        classLessonId: lesson.id,
        classResourceId: nextResources[0]?.id || '',
      },
    });
  };

  const saveLessonMapState = async (mapState) => {
    if (!activeLesson) return;
    const nextResources = (data.contentLibrary || []).map((resource) =>
      String(resource.id) === String(activeLesson.id)
        ? { ...resource, mapState, updatedAt: new Date().toISOString() }
        : resource
    );
    await updateData({ ...data, contentLibrary: nextResources });
    setShareNotice('تم حفظ الخريطة التعليمية داخل الدرس.');
  };

  const composeBoardImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f6f0e1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (contentMode === 'board') {
      await drawBoardIdentity(ctx, boardTemplate, canvas.width, canvas.height);
    }

    const backgroundSource = contentMode === 'images' && selectedResource?.type === 'image'
      ? selectedResourceUrl
      : (contentMode === 'pdf' && ['pdf', 'textbook'].includes(selectedResource?.type) ? renderedPdf.dataUrl : '');
    if (backgroundSource) {
      try {
        const image = await dataUrlToImage(backgroundSource);
        const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
        const drawWidth = image.width * ratio;
        const drawHeight = image.height * ratio;
        ctx.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
      } catch {
        // The drawing layer is still exported if the background cannot be decoded.
      }
    }
    boardActions.forEach((action) => drawBoardAction(ctx, action, false));
    return canvas.toDataURL('image/png');
  };

  const buildLessonPayload = ({ boardImage = '' } = {}) => ({
    kind: 'lesson',
    sessionId: current?.id || null,
    sessionTitle: current?.title || '',
    group: current?.group || '',
    grade: currentGrade || '',
    date: today,
    teacher: identity.teacherName,
    lessonId: activeLesson?.id || null,
    title: activeLesson?.title || selectedResource?.title || current?.title || '',
    summary: notes.trim() || activeLesson?.notes || selectedResource?.notes || '',
    notes: notes.trim() || activeLesson?.notes || selectedResource?.notes || '',
    homework: activeLesson?.homework || '',
    mapState: activeLesson?.mapState || null,
    resource: selectedResource ? {
      id: selectedResource.id,
      title: selectedResource.title,
      type: selectedResource.type,
      unit: selectedResource.unit,
      lesson: selectedResource.lesson,
      grade: selectedResource.grade,
      url: selectedResource.url,
      assetId: selectedResource.assetId || '',
      fileName: selectedResource.fileName,
      notes: selectedResource.notes,
      sequence: normalizeSequence(selectedResource.sequence),
      tags: normalizeTags(selectedResource.tags),
      pageStart: selectedResource.pageStart,
      pageEnd: selectedResource.pageEnd,
      currentPage: classPage || 1,
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
    boardActions: boardActions.slice(-300),
    resourceAnnotations,
    boardTemplate,
    zoom,
    boardImage,
    createdAt: new Date().toISOString(),
  });

  const persistCurrentBoardLayer = async () => {
    const layer = boardActions.slice(-500);
    if (contentMode !== 'board' && selectedResource) {
      await saveSelectedResource({
        boardLayers: {
          ...(selectedStorageResource?.boardLayers || {}),
          [boardLayerKey]: layer,
        },
      });
    } else if (current) {
      await updateData({
        ...data,
        sessions: data.sessions.map((session) => session.id === current.id
          ? { ...session, boardLayers: { ...(session.boardLayers || {}), [boardLayerKey]: layer }, updatedAt: new Date().toISOString() }
          : session),
      });
    }
    setShareNotice('تم حفظ طبقة الكتابة وربطها بالحصة.');
  };

  const recordLesson = async ({ copyLink = false, screenRecording = null } = {}) => {
    const boardImage = await composeBoardImage();
    const payload = buildLessonPayload({ boardImage });
    let share = { url: '', token: null };
    let shareError = '';
    try {
      share = await buildShareLink('lesson', payload, { cloudSync: data.settings?.cloudSync });
    } catch (error) {
      shareError = error?.message || 'تعذر إنشاء رابط الحصة.';
    }
    const boardAsset = payload.boardImage ? await importLegacyDataUrl(payload.boardImage, { name: `board-${Date.now()}.png`, kind: 'board' }) : null;
    const recording = {
      id: Date.now(),
      ...payload,
      boardImage: '',
      boardAssetId: boardAsset?.id || '',
      videoAssetId: screenRecording?.id || '',
      videoFileName: screenRecording?.name || '',
      videoMimeType: screenRecording?.type || '',
      videoSize: Number(screenRecording?.size || 0),
      durationSeconds: Number(screenRecording?.durationSeconds || 0),
      timeline: Array.isArray(screenRecording?.timeline)
        ? screenRecording.timeline.slice(0, 1000)
        : [],
      shareToken: share.token || '',
      shareUrl: share.url || '',
    };
    const allRecordings = [recording, ...(data.lessonRecordings || [])];
    const lessonRecordings = allRecordings.slice(0, 120);
    const droppedRecordings = allRecordings.slice(120);
    const nextSessions = data.sessions.map((session) =>
      session.id === current.id ? {
        ...session,
        summary: payload.summary,
        updatedAt: new Date().toISOString(),
        recordingId: recording.id,
        recordingShareUrl: share.url || '',
        boardLayers: contentMode !== 'board' && selectedResource ? session.boardLayers : { ...(session.boardLayers || {}), [boardLayerKey]: boardActions.slice(-500) },
      } : session
    );
    const nextContentLibrary = contentMode !== 'board' && selectedStorageResource ? (data.contentLibrary || []).map((resource) =>
      String(resource.id) === String(selectedStorageResource.id)
        ? { ...resource, boardLayers: { ...(resource.boardLayers || {}), [boardLayerKey]: boardActions.slice(-500) }, updatedAt: new Date().toISOString() }
        : resource
    ) : data.contentLibrary;
    const settings = {
      ...data.settings,
      classLessonId: activeLesson?.id || '',
      classResourceId: selectedResource?.id || '',
      classResourceTitle: selectedResource?.title || '',
      classResourceType: selectedResource?.type || '',
      classResourceFileName: selectedResource?.fileName || '',
      classResourcePinnedAt: new Date().toISOString(),
    };
    try {
      await updateData({ ...data, contentLibrary: nextContentLibrary, sessions: nextSessions, lessonRecordings, settings });
    } catch (error) {
      if (boardAsset?.id) await deleteAsset(boardAsset.id).catch(() => {});
      setShareNotice(error?.message || 'تعذر حفظ تسجيل الحصة.');
      return null;
    }
    await Promise.all(droppedRecordings.flatMap((item) => [item.boardAssetId, item.videoAssetId]
      .filter(Boolean)
      .map((assetId) => deleteAsset(assetId).catch(() => {}))));
    if (copyLink) {
      if (!share.url) setShareNotice(`تم حفظ تسجيل الحصة، لكن ${shareError}`);
      else setShareNotice(await copyToClipboard(share.url) ? 'تم نسخ رابط الطالب بنجاح.' : 'تم تجهيز الرابط لكن تعذر نسخه.');
    } else {
      setShareNotice(shareError ? `تم حفظ تسجيل الحصة دون رابط: ${shareError}` : 'تم حفظ تسجيل الحصة والكتابة فوق المورد.');
    }
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
    try {
      const payload = buildChallengePayload();
      const share = await buildShareLink('game', payload, { cloudSync: data.settings?.cloudSync });
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
    } catch (error) {
      setChallengeNotice(error?.message || 'تعذر إنشاء تحدي الحصة.');
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
    if (!activeLesson && lessons.length) {
      setActiveLessonId(lessons[0].id);
      return;
    }
    if (activeLesson && String(activeLessonId) !== String(activeLesson.id)) setActiveLessonId(activeLesson.id);
  }, [activeLesson, activeLessonId, lessons]);

  useEffect(() => {
    if (!resources.length) return;
    if (!selectedResource || !resources.some((item) => String(item.id) === String(selectedResourceId))) {
      setSelectedResourceId(resources[0].id);
    }
  }, [resources, selectedResource, selectedResourceId]);

  useEffect(() => {
    setFlowIndex(0);
    setNotes(activeLesson?.notes || selectedResource?.notes || '');
  }, [activeLesson?.id, selectedResource?.id]);

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

  const praise = async (student, type) => {
    setSelectedStudent(student);
    const phrase = buildEncouragementPhrase(type, student.name);
    setLastPraise(phrase);
    const spoken = await speakArabic(
      phrase,
      data.settings,
      ['excellent', 'correct', 'success'].includes(type)
        ? 'excited'
        : 'normal',
    );
    if (!spoken) {
      setShareNotice('تعذر تشغيل الصوت العربي. فعّل محرك تحويل النص إلى كلام باللغة العربية من إعدادات الجهاز.');
    }
  };

  const phrases = data.settings?.encouragementPhrases || [];
  const [newPhraseText, setNewPhraseText] = useState('');

  const sayPhrase = async (phrase) => {
    const text = selectedStudent
      ? `${String(phrase).replace(/[.!،,]+$/u, '')} يا ${selectedStudent.name}.`
      : phrase;
    setLastPraise(text);
    const spoken = await speakArabic(text, data.settings, 'excited');
    if (!spoken) {
      setShareNotice('الصوت العربي غير جاهز على الجهاز. افتح إعدادات تحويل النص إلى كلام وثبّت صوتًا عربيًا.');
    }
  };

  const addEncouragementPhrase = async () => {
    const text = newPhraseText.trim();
    if (!text) return;
    await updateData({ ...data, settings: { ...data.settings, encouragementPhrases: [...phrases, text] } });
    setNewPhraseText('');
  };

  const removeEncouragementPhrase = async (index) => {
    await updateData({ ...data, settings: { ...data.settings, encouragementPhrases: phrases.filter((_, i) => i !== index) } });
  };

  const adjustPoints = (student, delta) => {
    setPoints((previous) => ({ ...previous, [student.id]: (previous[student.id] || 0) + delta }));
  };

  const randomStudent = async () => {
    if (!students.length) return;
    const student = students[Math.floor(Math.random() * students.length)];
    setSelectedStudent(student);
    const phrase = `تم اختيار الطالب ${student.name}.`;
    setLastPraise(phrase);
    const spoken = await speakArabic(phrase, data.settings, 'calm');
    if (!spoken) setShareNotice('تعذر تشغيل الصوت العربي على هذا الجهاز.');
  };

  const openSelectedDocument = async () => {
    if (!selectedResource) return;
    try {
      setShareNotice('جارٍ تجهيز الملف للفتح…');
      await openResourceDocument(selectedResource, selectedResourceUrl);
      setShareNotice('تم إرسال الملف إلى عارض المستندات على الجهاز.');
    } catch (error) {
      setShareNotice(error?.message || 'تعذر فتح الملف على هذا الجهاز.');
    }
  };

  const saveBoard = async () => {
    const image = await composeBoardImage();
    const link = document.createElement('a');
    link.download = `شرح-${current?.title || 'الحصة'}-${today}.png`;
    link.href = image;
    link.click();
    setShareNotice('تم حفظ لقطة كاملة تشمل المورد والكتابة فوقه.');
  };

  const saveLessonState = async () => {
    if (!current) return;
    await persistCurrentBoardLayer();
    await recordLesson({ copyLink: false });
  };

  const cleanupRecordingResources = () => {
    try {
      recordingCleanupRef.current?.();
    } catch {
      // Recording resources are best-effort cleanup only.
    }
    recordingCleanupRef.current = () => {};
  };

  const saveCapturedRecording = async ({
    blob = null,
    name = '',
    type = '',
    durationSeconds = 0,
  } = {}) => {
    let asset = null;
    if (blob?.size) {
      asset = await importAssetBlob(blob, {
        name: name || `تسجيل-${current?.title || 'الحصة'}-${today}-${Date.now()}`,
        type: type || blob.type || 'video/webm',
        kind: 'lesson-recording',
      });
    }
    await recordLesson({
      copyLink: false,
      screenRecording: {
        ...(asset || {}),
        name: asset?.name || name,
        type: asset?.type || type,
        size: asset?.size || blob?.size || 0,
        durationSeconds: Math.max(1, Number(durationSeconds || recordingSeconds || 1)),
        timeline: recordingTimelineRef.current,
      },
    });
    return asset;
  };

  const resetRecordingState = () => {
    setRecordingActive(false);
    setRecordingPaused(false);
    setRecordingBackend('');
    recordingBackendRef.current = '';
    mediaRecorderRef.current = null;
  };

  const stopActiveRecording = async () => {
    const backend = recordingBackendRef.current;
    if (backend === 'native') {
      setShareNotice('جارٍ إنهاء تسجيل Android وحفظ الفيديو داخل قائمة التسجيلات…');
      try {
        const captured = await stopNativeScreenRecording();
        await saveCapturedRecording(captured);
        setShareNotice('تم حفظ فيديو الحصة داخل قائمة التسجيلات بالترتيب الزمني.');
      } catch (error) {
        await saveCapturedRecording({ durationSeconds: recordingSeconds }).catch(() => null);
        setShareNotice(error?.message || 'تعذر حفظ فيديو Android؛ تم حفظ سجل الحصة الزمني.');
      } finally {
        resetRecordingState();
        cleanupRecordingResources();
      }
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (backend === 'web' && recorder && recorder.state !== 'inactive') {
      await new Promise((resolve) => {
        recordingStopResolverRef.current = resolve;
        recorder.stop();
      });
      return;
    }

    if (recordingActive || backend === 'timeline') {
      try {
        await saveCapturedRecording({ durationSeconds: recordingSeconds });
        setShareNotice('تم حفظ سجل الحصة والسبورة بالترتيب الزمني.');
      } finally {
        resetRecordingState();
        cleanupRecordingResources();
      }
    }
  };

  const endClass = async () => {
    if (recordingActive || recordingBackendRef.current) {
      await stopActiveRecording();
    } else {
      await recordLesson({ copyLink: false });
    }
    navigate('dashboard');
  };

  const toggleRecordingPause = async () => {
    const backend = recordingBackendRef.current;
    try {
      if (backend === 'native') {
        if (recordingPaused) await resumeNativeScreenRecording();
        else await pauseNativeScreenRecording();
        setRecordingPaused((value) => !value);
        setShareNotice(recordingPaused ? 'تم استكمال تسجيل الحصة.' : 'تم إيقاف تسجيل الحصة مؤقتًا.');
        return;
      }
      const recorder = mediaRecorderRef.current;
      if (backend === 'web' && recorder) {
        if (recorder.state === 'recording') recorder.pause();
        else if (recorder.state === 'paused') recorder.resume();
        return;
      }
      if (backend === 'timeline') {
        setRecordingPaused((value) => !value);
        setShareNotice(recordingPaused ? 'تم استكمال تسجيل سير الحصة.' : 'تم إيقاف تسجيل سير الحصة مؤقتًا.');
      }
    } catch (error) {
      setShareNotice(error?.message || 'تعذر تغيير حالة التسجيل.');
    }
  };

  const toggleClassRecording = async () => {
    if (recordingActive || recordingBackendRef.current) {
      await stopActiveRecording();
      return;
    }

    setRecordingSeconds(0);
    recordingStartedAtRef.current = Date.now();
    recordingTimelineRef.current = [{
      atSeconds: 0,
      type: 'recording-started',
      contentMode,
      resourceId: selectedResource?.id || '',
      resourceTitle: selectedResource?.title || '',
      page: classPage || 1,
      createdAt: new Date().toISOString(),
    }];

    if (nativeScreenRecordingAvailable()) {
      try {
        await startNativeScreenRecording({
          title: activeLesson?.title || current?.title || 'الحصة',
          withAudio: true,
        });
        recordingBackendRef.current = 'native';
        setRecordingBackend('native');
        setRecordingActive(true);
        setRecordingPaused(false);
        setShareNotice('بدأ تسجيل شاشة تطبيق Android وصوت المعلم. اضغط مرة أخرى للإيقاف والحفظ.');
        return;
      } catch (error) {
        setShareNotice(error?.message || 'تعذر بدء تسجيل Android؛ سيتم استخدام التسجيل البديل.');
      }
    }

    if (navigator.mediaDevices?.getDisplayMedia && globalThis.MediaRecorder) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15, max: 24 } },
          audio: true,
        });
        let microphoneStream = null;
        try {
          microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        } catch {
          setShareNotice('بدأ تسجيل الشاشة بدون ميكروفون المعلم؛ اسمح بالميكروفون لتسجيل الصوت.');
        }

        const combinedStream = new MediaStream();
        displayStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
        const AudioEngine = globalThis.AudioContext || globalThis.webkitAudioContext;
        const audioContext = AudioEngine ? new AudioEngine() : null;
        if (audioContext) {
          const mixedDestination = audioContext.createMediaStreamDestination();
          for (const stream of [displayStream, microphoneStream].filter(Boolean)) {
            if (!stream.getAudioTracks().length) continue;
            audioContext.createMediaStreamSource(stream).connect(mixedDestination);
          }
          mixedDestination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
        } else {
          const preferredAudio = microphoneStream?.getAudioTracks()?.[0]
            || displayStream.getAudioTracks()?.[0];
          if (preferredAudio) combinedStream.addTrack(preferredAudio);
        }

        const mimeCandidates = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];
        const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
        const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
        recordingChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data?.size) recordingChunksRef.current.push(event.data);
        };
        recorder.onpause = () => setRecordingPaused(true);
        recorder.onresume = () => setRecordingPaused(false);
        recorder.onerror = () => setShareNotice('حدث خطأ أثناء تسجيل الشاشة؛ سيتم حفظ سجل الحصة المتاح.');
        recorder.onstop = async () => {
          const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
          try {
            const blob = recordingChunksRef.current.length
              ? new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'video/webm' })
              : null;
            await saveCapturedRecording({
              blob,
              name: `تسجيل-${current?.title || 'الحصة'}-${today}-${Date.now()}.webm`,
              type: blob?.type || 'video/webm',
              durationSeconds,
            });
            setShareNotice(blob?.size
              ? 'تم حفظ فيديو الحصة داخل قائمة التسجيلات بالترتيب الزمني.'
              : 'تم حفظ سجل الحصة، لكن لم ينتج ملف فيديو من الجهاز.');
          } catch (error) {
            setShareNotice(error?.message || 'تعذر حفظ فيديو الحصة.');
          } finally {
            recordingChunksRef.current = [];
            cleanupRecordingResources();
            resetRecordingState();
            recordingStopResolverRef.current?.();
            recordingStopResolverRef.current = null;
          }
        };
        const stopFromSystem = () => {
          if (recorder.state !== 'inactive') recorder.stop();
        };
        displayStream.getVideoTracks()[0]?.addEventListener('ended', stopFromSystem, { once: true });
        recordingCleanupRef.current = () => {
          displayStream.getTracks().forEach((track) => track.stop());
          microphoneStream?.getTracks().forEach((track) => track.stop());
          combinedStream.getTracks().forEach((track) => track.stop());
          audioContext?.close?.().catch(() => null);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        recordingBackendRef.current = 'web';
        setRecordingBackend('web');
        setRecordingActive(true);
        setRecordingPaused(false);
        setShareNotice('بدأ تسجيل شاشة الحصة وصوت المعلم.');
        return;
      } catch (error) {
        cleanupRecordingResources();
        setShareNotice(error?.name === 'NotAllowedError'
          ? 'لم يتم منح إذن تسجيل الشاشة؛ بدأ حفظ سير الحصة النصي والسبورة.'
          : 'تعذر تسجيل الشاشة؛ بدأ حفظ سير الحصة النصي والسبورة.');
      }
    }

    recordingBackendRef.current = 'timeline';
    setRecordingBackend('timeline');
    setRecordingActive(true);
    setRecordingPaused(false);
    setShareNotice('بدأ تسجيل سير الحصة داخل المنصة. اضغط مرة أخرى للإيقاف والحفظ.');
  };

  stopRecordingOnUnmountRef.current = stopActiveRecording;

  useEffect(() => () => {
    if (recordingBackendRef.current) {
      void stopRecordingOnUnmountRef.current?.();
      return;
    }
    try {
      recordingCleanupRef.current?.();
    } catch {
      // Ignore cleanup failures while unmounting the class screen.
    }
  }, []);

  const undoBoard = () => {
    setBoardActions((currentActions) => {
      if (!currentActions.length) return currentActions;
      const last = currentActions[currentActions.length - 1];
      setRedoStack((redo) => [last, ...redo]);
      setSelectedBoardActionId(null);
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
    setSelectedBoardActionId(null);
  };

  const handleBoardAction = (action) => {
    const next = { ...action, id: Date.now() + Math.random() };
    setBoardActions((currentActions) => [...currentActions, next]);
    setSelectedBoardActionId(next.id);
    setRedoStack([]);
    if (action.kind === 'stroke') setTool(action.tool || 'pen');
  };

  const moveBoardActionHandler = (updated) => {
    setBoardActions((currentActions) => currentActions.map((action) => action.id === updated.id ? updated : action));
    setRedoStack([]);
  };

  const deleteSelectedBoardAction = () => {
    if (!selectedBoardActionId) return;
    setBoardActions((currentActions) => currentActions.filter((action) => action.id !== selectedBoardActionId));
    setSelectedBoardActionId(null);
    setRedoStack([]);
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
    { label: 'الدرس', value: activeLesson?.title || selectedResource?.lesson || selectedResource?.title || current.title },
    { label: 'خط سير الحصة', value: flowLabels[activeFlow] || activeFlow },
    { label: 'التاريخ', value: formatDateAr(today) },
  ];

  const currentCount = students.length;

  return (
    <section className={`page classmode-scene ${fullscreen ? 'fullscreen' : ''}`} ref={sceneRef}>
      <div className="classmode-top-header">
        <div className="classmode-header-brand">
          <img src={identity.logo || identity.icon} alt={identity.schoolName} />
          <div>
            <strong>{identity.schoolName}</strong>
            <small>{identity.teacherName} — {identity.teacherTitle}</small>
          </div>
        </div>
        <div className="classmode-header-tabs">
          <button type="button" className={contentMode === 'pdf' ? 'active' : ''} onClick={() => switchContentMode('pdf')} title="PDF"><FileText size={24} /><span>PDF</span></button>
          <button type="button" className={contentMode === 'board' ? 'active' : ''} onClick={() => switchContentMode('board')} title="السبورة"><PenTool size={24} /><span>السبورة</span></button>
          <button type="button" className={contentMode === 'images' ? 'active' : ''} onClick={() => switchContentMode('images')} title="الصور"><FileImage size={24} /><span>الصور</span></button>
          <button type="button" className={contentMode === 'videos' ? 'active' : ''} onClick={() => switchContentMode('videos')} title="الفيديوهات"><Video size={24} /><span>الفيديوهات</span></button>
          <button type="button" className={contentMode === 'maps' ? 'active' : ''} onClick={() => switchContentMode('maps')} title="الخرائط"><Map size={24} /><span>الخرائط</span></button>
        </div>
        <div className="classmode-header-meta">
          <div className="header-meta-item"><Clock size={18} /><div><b>{clockTime}</b><small>{formatDateAr(today)}</small></div></div>
          <div className="header-meta-item"><div><b>{selectedResource?.unit || current.title}</b><small>{selectedResource?.lesson || current.group}</small></div></div>
          <div className="header-meta-item book-icon"><BookOpen size={20} /></div>
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
              <button className="icon-action" onClick={() => navigate('dashboard')} type="button" title="الخروج من وضع الحصة"><X /></button>
              <button className="icon-action" onClick={() => setRunning((value) => !value)} type="button">{running ? <CirclePause /> : <CirclePlay />}</button>
              <button className="icon-action" onClick={() => setSeconds(0)} type="button"><TimerReset /></button>
              <button className="icon-action" onClick={toggleFullscreen} type="button"><Maximize2 /></button>
              <button className="secondary-btn" onClick={() => recordLesson({ copyLink: true })} type="button">رابط الطالب</button>
              <button className="danger-btn" onClick={endClass} type="button">إنهاء الحصة</button>
            </div>
          </div>

          <div className="classmode-resource-card">
            <div>
              <span className="eyebrow">الدرس المرتبط بالحصة</span>
              {lessons.length > 0 ? (
                <select className="classmode-lesson-select" value={activeLesson?.id || ''} onChange={(event) => void selectLesson(event.target.value)}>
                  {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}{lesson.lessonDate ? ` — ${lesson.lessonDate}` : ''}</option>)}
                </select>
              ) : <h3>{selectedResource?.title || current.title}</h3>}
              <p>{activeLesson?.unit || selectedResource?.unit || current.group} — {activeLesson?.title || selectedResource?.lesson || current.title}</p>
            </div>
            <div className="classmode-flow-row">
              {flow.map((step, index) => (
                <button key={step} className={index === flowIndex ? 'active' : ''} onClick={() => setFlowIndex(index)} type="button">{flowLabels[step] || step}</button>
              ))}
            </div>
            <div className="classmode-resource-actions">
              <button className="secondary-btn" onClick={() => switchContentMode('board')} type="button"><Presentation size={16} /> فتح السبورة</button>
              <button className="secondary-btn" onClick={() => recordLesson({ copyLink: true })} type="button"><ScanLine size={16} /> رابط الطالب</button>
              <button className="primary-btn" onClick={saveLessonState} type="button"><Save size={16} /> حفظ الملخص</button>
            </div>
          </div>

          {sessionQueue.length > 0 && (
            <div className="classmode-session-plan">
              <span className="eyebrow">خطة الحصة ({sessionQueue.length} عنصر)</span>
              <div className="classmode-session-plan-row">
                <button type="button" className="icon-action" onClick={() => goToQueueStep(-1)} disabled={sessionQueue.length < 2}><ArrowLeftRight size={16} /></button>
                <div className="classmode-session-plan-list">
                  {sessionQueue.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={String(item.id) === String(selectedResourceId) ? 'active' : ''}
                      onClick={() => { setSelectedResourceId(item.id); setFlowIndex(0); }}
                    >
                      <span className="pin-order">{index + 1}</span> {item.title}
                    </button>
                  ))}
                </div>
                <button type="button" className="icon-action" onClick={() => goToQueueStep(1)} disabled={sessionQueue.length < 2}><ArrowLeftRight size={16} /></button>
              </div>
            </div>
          )}

          <MediaNavigator
            resources={resources}
            selectedId={selectedResourceId}
            contentMode={contentMode}
            onSelect={(resourceId) => {
              setSelectedResourceId(resourceId);
              setFlowIndex(0);
            }}
          />

          <div className="classmode-board-frame">
            <div className="classmode-board-surface">
              {boardToolsVisible && <div className="classmode-board-sidebar-left">
                {toolOptions.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" className={tool === key ? 'active' : ''} onClick={() => setTool(key)} title={label}><Icon size={19} /><span>{label}</span></button>
                ))}
                <div className="classmode-left-toolbar-divider" />
                <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.15))} title="تكبير"><ZoomIn size={19} /><span>تكبير</span></button>
                <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.15))} title="تصغير"><ZoomOut size={19} /><span>تصغير</span></button>
                <button type="button" onClick={undoBoard} title="تراجع"><Undo2 size={19} /><span>تراجع</span></button>
                <button type="button" onClick={redoBoard} title="إعادة"><Redo2 size={19} /><span>إعادة</span></button>
                <button type="button" onClick={saveBoard} title="حفظ"><Save size={19} /><span>حفظ</span></button>
              </div>}

              <div className="classmode-board-stage">
                {contentMode === 'maps' ? (
                  <div className="classmode-map-embed">
                    <LessonMapStudio
                      grade={currentGrade}
                      lesson={activeLesson}
                      onSaveState={saveLessonMapState}
                    />
                  </div>
                ) : (
                <>
                {contentMode !== 'board' && displayResource && (
                  <div className="classmode-resource-preview" style={{ '--board-zoom': zoom }}>
                    <div className="resource-preview-head">
                      <strong>{displayResource.title}</strong>
                      <small>{displayResource.fileName || displayResource.mimeType || displayResource.type}</small>
                      {(displayResource.type === 'pdf' || displayResource.type === 'textbook') && (
                        <div className="classmode-page-nav">
                          <button type="button" onClick={() => setClassPage((p) => clampLessonPage((p || 1) - 1, displayResource, renderedPdf.pageCount || Infinity))} disabled={(classPage || 1) <= Number(displayResource.pageStart || 1)} title="الصفحة السابقة">‹</button>
                          <span>صفحة {classPage || 1}{displayResource.pageEnd ? ` / ${displayResource.pageEnd}` : renderedPdf.pageCount ? ` / ${renderedPdf.pageCount}` : ''}</span>
                          <button type="button" onClick={() => setClassPage((p) => clampLessonPage((p || 1) + 1, displayResource, renderedPdf.pageCount || Infinity))} disabled={(classPage || 1) >= Number(displayResource.pageEnd || renderedPdf.pageCount || Infinity)} title="الصفحة التالية">›</button>
                          {displayResource.type === 'textbook' && selectedExamUrl && (
                            <a href={selectedExamUrl} target="_blank" rel="noopener noreferrer" className="classmode-exam-link" title="فتح ملف الامتحانات"><FileText size={14} /> الامتحانات</a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="resource-preview-body">
                      {displayResource.type === 'image' && selectedResourceUrl && <img src={selectedResourceUrl} alt={displayResource.title} />}
                      {displayResource.type === 'video' && selectedResourceUrl && <video controls src={selectedResourceUrl} />}
                      {displayResource.type === 'audio' && selectedResourceUrl && <audio controls src={selectedResourceUrl} />}
                      {(displayResource.type === 'pdf' || displayResource.type === 'textbook') && selectedResourceUrl && (renderedPdf.dataUrl ? <img src={renderedPdf.dataUrl} alt={`${displayResource.title} — صفحة ${classPage || 1}`} /> : <iframe title={displayResource.title} src={`${selectedResourceUrl}#page=${classPage || 1}&toolbar=0&navpanes=0`} />)}
                      {renderedPdf.loading && <div className="classmode-pdf-status">جارٍ تجهيز صفحة PDF للكتابة عليها…</div>}
                      {renderedPdf.error && <div className="classmode-pdf-status error">{renderedPdf.error}</div>}
                      {!['image', 'video', 'audio', 'pdf', 'textbook'].includes(displayResource.type) && <div className="resource-placeholder classmode-document-placeholder"><Presentation size={42} /><strong>{displayResource.fileName || displayResource.title}</strong><small>{displayResource.type === 'slides' ? 'عرض PowerPoint مرتبط بالدرس' : 'مستند مرتبط بالدرس'}</small><button className="primary-btn" type="button" onClick={openSelectedDocument}>فتح الملف على الجهاز</button></div>}
                      {resourceAnnotations.length > 0 && <div className="resource-annotation-overlay">{resourceAnnotations.map((note) => <span key={note.id} style={{ background: note.color }}>{note.text}</span>)}</div>}
                    </div>
                  </div>
                )}

                {contentMode !== 'board' && !displayResource && contentMode !== 'maps' && (
                  <div className="classmode-empty-resource">
                    <File size={46} />
                    <h3>لا يوجد محتوى من هذا النوع في مكتبة المنصة</h3>
                    <p>أضف {contentMode === 'videos' ? 'فيديو' : contentMode === 'images' ? 'صورة' : contentMode === 'audio' ? 'ملفًا صوتيًا' : contentMode === 'files' ? 'ملفًا أو عرضًا' : 'ملف PDF'} داخل الدرس في المكتبة ليظهر هنا تلقائيًا.</p>
                    <button type="button" className="primary-btn" onClick={() => navigate('contentLibrary')}><BookOpen size={16} /> فتح المكتبة</button>
                  </div>
                )}

                {(contentMode === 'board' || (displayResource && ['pdf', 'images'].includes(contentMode))) && <CanvasOverlay
                  actions={boardActions}
                  onDrawAction={handleBoardAction}
                  onMoveAction={moveBoardActionHandler}
                  onSelectAction={setSelectedBoardActionId}
                  selectedActionId={selectedBoardActionId}
                  template={boardTemplate}
                  zoom={zoom}
                  boardRef={boardRef}

                  tool={tool}
                  selectedColor={annotationColor}
                  strokeWidth={strokeWidth}
                  shapeKind={shapeKind}
                  arrowMode={arrowMode}
                  textValue={boardText}
                  textStyle={textStyle}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  boardReady={boardReady}
                  setBoardReady={setBoardReady}
                  hasResourceHeader={Boolean(displayResource)}
                />}
                </>
                )}              </div>
            </div>
          </div>

          {boardToolsVisible && <div className="classmode-toolbar">
            <div className="classmode-tool-group compact classmode-color-row">
              {['#111827', '#2563eb', '#dc2626', '#d7ad35', '#7c3aed'].map((c) => (
                <button key={c} type="button" className={`classmode-swatch ${annotationColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setAnnotationColor(c)} title={c} />
              ))}
              <input type="color" value={annotationColor} onChange={(e) => setAnnotationColor(e.target.value)} title="لون مخصص" />
              <select value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} title="سُمك الخط">
                <option value={2}>2px</option>
                <option value={3}>3px</option>
                <option value={4}>4px</option>
                <option value={6}>6px</option>
                <option value={10}>10px</option>
              </select>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} title="نوع الخط">
                <option value="Tahoma, Arial, sans-serif">عربي واضح</option>
                <option value="Georgia, serif">تاريخي</option>
                <option value="Arial, sans-serif">بسيط</option>
                <option value="serif">مخطوط</option>
              </select>
              <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} title="حجم النص">
                <option value={20}>20</option>
                <option value={24}>24</option>
                <option value={30}>30</option>
                <option value={38}>38</option>
                <option value={48}>48</option>
              </select>
            </div>
            <div className="classmode-tool-group compact classmode-text-style-row">
              <button className={textStyle === 'plain' ? 'active' : ''} onClick={() => setTextStyle('plain')} type="button">نص عادي</button>
              <button className={textStyle === 'historical' ? 'active' : ''} onClick={() => { setTextStyle('historical'); setTool('text'); }} type="button">مصطلح تاريخي</button>
              <button className={textStyle === 'geography' ? 'active' : ''} onClick={() => { setTextStyle('geography'); setTool('text'); }} type="button">مصطلح جغرافي</button>
              <button className={textStyle === 'event' ? 'active' : ''} onClick={() => { setTextStyle('event'); setTool('text'); }} type="button">حدث مهم</button>
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
              <button onClick={deleteSelectedBoardAction} disabled={!selectedBoardActionId} type="button"><Eraser size={17} /> حذف المحدد</button>
              <button onClick={clearBoard} type="button"><RotateCcw size={17} /> مسح الكل</button>
              <button onClick={persistCurrentBoardLayer} type="button"><Save size={17} /> حفظ طبقة الكتابة</button>
            </div>
          </div>}
        </section>

        <aside className="classmode-side-column">
          <TeacherLivePanel
            cloudSync={data.settings?.cloudSync}
            roomMeta={{
              title: activeLesson?.title || current.title,
              grade: currentGrade,
              lesson: activeLesson?.title || selectedResource?.lesson || '',
              sessionId: current.id,
              lessonId: activeLesson?.id || null,
            }}
            liveState={{
              contentMode,
              contentModeLabel: contentMode === 'board'
                ? 'السبورة'
                : contentMode === 'pdf'
                  ? 'ملف PDF'
                  : contentMode === 'images'
                    ? 'الصور'
                    : contentMode === 'videos'
                      ? 'الفيديو'
                      : contentMode === 'maps'
                        ? 'الخرائط'
                        : 'ملف الدرس',
              resourceId: selectedResource?.id || '',
              resourceTitle: selectedResource?.title || activeLesson?.title || current.title,
              page: classPage || 1,
              boardRevision: boardActions.length,
              pointsRevision: Object.values(points).reduce((sum, value) => sum + Number(value || 0), 0),
              elapsedSeconds: seconds,
            }}
            buildSnapshot={composeBoardImage}
            onNotice={setShareNotice}
          />
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
                  <div key={student.id} className={`classmode-student-row ${selectedStudent?.id === student.id ? 'active' : ''}`}>
                    <button className="classmode-student-row-main" onClick={() => setSelectedStudent(student)} type="button">
                      <span className="student-code">{student.code}</span>
                      <div>
                        <strong>{student.name}</strong>
                        <small>{student.grade}</small>
                      </div>
                      <b className={`attendance-dot ${status || 'pending'}`}>{statusLabels[status] || 'لم يسجل'}</b>
                      <span className="student-score">{score}</span>
                    </button>
                    <div className="classmode-student-row-actions">
                      <button type="button" className={`student-attendance-mini present ${status === 'present' ? 'selected' : ''}`} title="حاضر" onClick={(event) => { event.stopPropagation(); mark(student, 'present'); }}>ح</button>
                      <button type="button" className={`student-attendance-mini late ${status === 'late' ? 'selected' : ''}`} title="متأخر" onClick={(event) => { event.stopPropagation(); mark(student, 'late'); }}>ت</button>
                      <button type="button" className={`student-attendance-mini absent ${status === 'absent' ? 'selected' : ''}`} title="غائب" onClick={(event) => { event.stopPropagation(); mark(student, 'absent'); }}>غ</button>
                      <button type="button" className="student-point-btn student-point-minus" title="خصم نقطة" onClick={(event) => { event.stopPropagation(); adjustPoints(student, -1); }}><Minus size={14} /></button>
                      <button type="button" className="student-point-btn" title="إضافة نقطة واحدة" onClick={(event) => { event.stopPropagation(); adjustPoints(student, 1); }}><Plus size={14} /></button>
                      <button type="button" className="student-praise-btn" title="جملة تشجيعية" onClick={(event) => { event.stopPropagation(); praise(student, 'excellent'); }}><Sparkles size={14} /></button>
                    </div>
                  </div>
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

          <article className="panel classmode-side-panel classmode-phrases-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">التشجيع</span><h3>الجمل التشجيعية</h3></div><Sparkles size={18} /></div>
            <div className="classmode-phrase-list">
              {phrases.map((phrase, index) => (
                <div key={`${phrase}-${index}`} className="classmode-phrase-row">
                  <button type="button" onClick={() => sayPhrase(phrase)}>{phrase}</button>
                  <button type="button" className="icon-action phrase-remove" onClick={() => removeEncouragementPhrase(index)} title="حذف"><X size={14} /></button>
                </div>
              ))}
            </div>
            <div className="classmode-phrase-add">
              <input value={newPhraseText} onChange={(e) => setNewPhraseText(e.target.value)} placeholder="أضف جملة تشجيعية جديدة" onKeyDown={(e) => e.key === 'Enter' && addEncouragementPhrase()} />
              <button type="button" className="secondary-btn" onClick={addEncouragementPhrase}><Plus size={16} /> إضافة جملة جديدة</button>
            </div>
          </article>

          <article className="panel classmode-side-panel">
            <div className="panel-heading compact"><div><span className="eyebrow">الأنشطة</span><h3>خطة سير الحصة</h3></div><MailCheck size={18} /></div>
            <div className="classmode-activity-list">
              {flow.map((step, index) => <button key={step} className={index === flowIndex ? 'active' : ''} onClick={() => setFlowIndex(index)} type="button">{flowLabels[step] || step}</button>)}
            </div>
            <div className="classmode-resource-summary">{activeLesson?.notes || selectedResource?.notes || 'اختر موردًا لتظهر الملاحظات هنا.'}{activeLesson?.homework && <><br/><strong>الواجب: </strong>{activeLesson.homework}</>}</div>
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
                <LessonRecordingItem
                  key={recording.id}
                  recording={recording}
                  onNotice={setShareNotice}
                />
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

      <div className="classmode-bottom-actions">
        <button type="button" className="secondary-btn" onClick={() => navigate('dashboard')}><X size={16} /> خروج من وضع الحصة</button>
        <div className="classmode-bottom-actions-mid">
          <button type="button" className={`secondary-btn ${recordingActive ? 'recording-active' : ''}`} onClick={toggleClassRecording}><CircleDot size={16} /> {recordingActive ? `إيقاف التسجيل ${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}` : 'تسجيل الحصة'}</button>
          {recordingActive && recordingBackend && (
            <button type="button" className="secondary-btn" onClick={toggleRecordingPause}>{recordingPaused ? <CirclePlay size={16} /> : <CirclePause size={16} />} {recordingPaused ? 'استكمال' : 'إيقاف مؤقت'}</button>
          )}
          <button type="button" className="secondary-btn" onClick={saveBoard}><Camera size={16} /> لقطة شاشة</button>
          <button type="button" className="secondary-btn" onClick={() => setView('students')}><Users size={16} /> عرض الطلاب</button>
          <button type="button" className="secondary-btn" onClick={() => navigate('contentLibrary')}><BookOpen size={16} /> المكتبة</button>
          <button type="button" className="secondary-btn" onClick={() => navigate('settings')}><LayoutGrid size={16} /> الإعدادات</button>
        </div>
        <button type="button" className="danger-btn classmode-end-btn" onClick={endClass}>إنهاء الحصة</button>
      </div>
      {view === 'students' && students.length > 0 && (
        <div className="classmode-student-drawer-backdrop" role="presentation" onClick={() => setView('board')}>
          <aside className="classmode-student-drawer" role="dialog" aria-modal="true" aria-label="طلاب الحصة" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span className="eyebrow">طلاب الحصة ({students.length})</span><h3>الحضور والنقاط الفورية</h3></div>
              <button className="icon-action" type="button" onClick={() => setView('board')} title="إغلاق"><X size={18} /></button>
            </header>
            <div className="classmode-student-drawer-list">
              {students.map((student) => {
                const status = attendanceMap[student.id];
                return (
                  <div className="classmode-student-drawer-row" key={student.id}>
                    <div><strong>{student.name}</strong><small>{student.code} — {student.grade}</small></div>
                    <div className="drawer-attendance-actions">
                      <button className={status === 'present' ? 'selected present' : 'present'} onClick={() => mark(student, 'present')} type="button">حاضر</button>
                      <button className={status === 'late' ? 'selected late' : 'late'} onClick={() => mark(student, 'late')} type="button">متأخر</button>
                      <button className={status === 'absent' ? 'selected absent' : 'absent'} onClick={() => mark(student, 'absent')} type="button">غائب</button>
                    </div>
                    <div className="drawer-point-actions">
                      <button type="button" onClick={() => adjustPoints(student, -1)}><Minus size={15} /></button>
                      <b>{points[student.id] || 0}</b>
                      <button type="button" onClick={() => adjustPoints(student, 1)}><Plus size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <footer>
              <button className="secondary-btn" onClick={() => navigate('gradeScanner')} type="button">رصد الدرجات</button>
              <button className="secondary-btn" onClick={() => navigate('games')} type="button">الألعاب التعليمية</button>
              <button className="primary-btn" onClick={() => setView('board')} type="button">العودة إلى السبورة</button>
            </footer>
          </aside>
        </div>
      )}
    </section>
  );
}
