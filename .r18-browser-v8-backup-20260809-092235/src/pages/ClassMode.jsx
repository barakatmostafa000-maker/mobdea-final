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
  Radio,
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
  Mic,
  MicOff,
  Volume2,
  Map as MapIcon,
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
  readNativeScreenRecording,
  releaseNativeScreenRecording,
  resumeNativeScreenRecording,
  startNativeScreenRecording,
  stopNativeScreenRecording,
} from '../services/screenRecording';
import { buildShareLink, copyToClipboard } from '../services/share';
import { questionBank } from '../data/questionBank';
import { queueAbsenceNotification } from '../services/notifications';
import { deleteAsset, importAssetBlob, importLegacyDataUrl } from '../services/assetStore';
import { useAssetUrl } from '../hooks/useAssetUrl';
import { useAssetSource } from '../hooks/useAssetSource';
import { usePdfPage } from '../hooks/usePdfPage';
import { todayISO, formatDateAr } from '../utils/time';
import LessonMapStudio from '../components/maps/LessonMapStudio';
import MediaRenderer from '../components/classmode/MediaRenderer';
import LessonRecordingItem from '../components/classmode/LessonRecordingItem';
import ClassroomGamePanel from '../components/classmode/ClassroomGamePanel';
import ClassModeViewport from '../components/classmode/ClassModeViewport';
import { appendQuestionHistory, selectQuestionRound } from '../services/questionRotation';
import { rankStudentsByPoints } from '../services/studentRanking';
import TeacherLivePanel from '../components/live/TeacherLivePanel';
import OnlineGameHostPanel from '../components/live/OnlineGameHostPanel';
import { getAllLibraryGrades,
  getLessonsForGrade, getLessonModeResources, resolveDefaultLesson, clampLessonPage, inferMediaType } from '../services/libraryModel';

const statusLabels = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'غياب بعذر' };
const defaultEncouragementPhrases = [
  'أحسنت يا بطل',
  'إجابة ممتازة',
  'تفكيرك رائع',
  'أبدعت وواصل التقدم',
  'مشاركة مميزة',
  'تفوق رائع',
  'فخور بك',
  'استمر يا مبدع',
];
const defaultCorrectivePhrases = [
  'ركز وحاول مرة أخرى',
  'انتبه إلى السؤال جيدًا',
  'اهدأ وفكر قبل الإجابة',
  'راجع إجابتك مرة أخرى',
  'أحتاج منك تركيزًا أكبر',
  'لا تتعجل في الإجابة',
  'حاول أن تشارك معنا',
  'انتبه للشرح من فضلك',
];
const toolOptions = [
  { key: 'select', label: 'تحديد', icon: MousePointer2 },
  { key: 'pen', label: 'قلم', icon: PenTool },
  { key: 'normal-text', label: 'كتابة عادية', icon: Type },
  { key: 'historical-term', label: 'مصطلح تاريخي', icon: BookOpen },
  { key: 'geographical-term', label: 'مصطلح جغرافي', icon: MapIcon },
  { key: 'important-event', label: 'حدث مهم', icon: Clock },
  { key: 'date-term', label: 'تاريخ', icon: CircleDot },
  { key: 'person-term', label: 'شخصية', icon: Users },
  { key: 'place-term', label: 'مكان', icon: MapIcon },
  { key: 'shape', label: 'أشكال', icon: Shapes },
  { key: 'historical-symbol', label: 'رموز تاريخية', icon: Sparkles },
  { key: 'eraser', label: 'ممحاة', icon: Eraser },
  { key: 'highlighter', label: 'هايلايتر', icon: Highlighter },
  { key: 'arrow', label: 'سهم', icon: ArrowUpRight },
  { key: 'move', label: 'تحريك', icon: Move },
];
const TEXT_TOOL_STYLES = Object.freeze({
  'normal-text': 'plain',
  'historical-term': 'historical',
  'geographical-term': 'geography',
  'important-event': 'event',
  'date-term': 'date',
  'person-term': 'person',
  'place-term': 'place',
  'definition-term': 'definition',
  'note-term': 'note',
});
const TEXT_STYLE_TO_TOOL = Object.freeze(Object.fromEntries(Object.entries(TEXT_TOOL_STYLES).map(([key, value]) => [value, key])));
const shapeOptions = [
  { key: 'rect', label: 'مستطيل' },
  { key: 'circle', label: 'دائرة' },
  { key: 'triangle', label: 'مثلث' },
  { key: 'line', label: 'خط' },
];
const historicalSymbolOptions = [
  { key: 'pyramid', label: 'هرم' },
  { key: 'column', label: 'عمود أثري' },
  { key: 'scroll', label: 'مخطوطة' },
  { key: 'obelisk', label: 'مسلة' },
  { key: 'crown', label: 'تاج' },
  { key: 'compass', label: 'بوصلة' },
];
const boardTemplates = [
  { key: 'history', label: 'تاريخي', icon: BookOpen },
  { key: 'geography', label: 'جغرافي', icon: MapIcon },
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
  slides: ['slides'],
  files: ['file', 'document', 'link'],
  maps: [],
  games: [],
  board: [],
};

function resourceMediaType(resource) {
  if (!resource) return '';
  if (resource.type === 'textbook') return 'textbook';
  if (resource.type === 'exams') return 'pdf';
  return inferMediaType({
    type: resource.type,
    mimeType: resource.mimeType,
    fileName: resource.fileName,
    name: resource.title,
  });
}

function resourceContentMode(resource) {
  if (!resource) return 'board';
  const type = resourceMediaType(resource);
  if (type === 'image') return 'images';
  if (type === 'video') return 'videos';
  if (type === 'audio') return 'audio';
  if (type === 'slides') return 'slides';
  if (['file', 'document', 'link'].includes(type)) return 'files';
  if (['pdf', 'textbook'].includes(type)) return 'pdf';
  return 'board';
}

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

function BoardThemeDecor({ template }) {
  if (!['history', 'geography', 'manuscript'].includes(template)) return null;
  return (
    <svg className={`classmode-board-theme-art theme-${template}`} viewBox="0 0 1200 720" preserveAspectRatio="none" aria-hidden="true">
      {template === 'history' && <>
        <defs>
          <linearGradient id="historyGold" x1="0" x2="1"><stop offset="0" stopColor="#4d2a11"/><stop offset=".25" stopColor="#f2cf74"/><stop offset=".52" stopColor="#8d581f"/><stop offset=".78" stopColor="#f5d98b"/><stop offset="1" stopColor="#4b2910"/></linearGradient>
          <linearGradient id="historyStone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3d9a8"/><stop offset=".4" stopColor="#b98750"/><stop offset=".72" stopColor="#78502e"/><stop offset="1" stopColor="#3f2819"/></linearGradient>
          <linearGradient id="historyPapyrus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffecc0"/><stop offset=".48" stopColor="#e9c98c"/><stop offset="1" stopColor="#b77d3c"/></linearGradient>
          <radialGradient id="historyVignette"><stop offset="0" stopColor="#fff6d9" stopOpacity=".28"/><stop offset=".7" stopColor="#5c3516" stopOpacity=".02"/><stop offset="1" stopColor="#351b0a" stopOpacity=".22"/></radialGradient>
          <pattern id="papyrusFibres" width="52" height="22" patternUnits="userSpaceOnUse"><path d="M0 5c13-3 26 3 52 0M0 16c16 3 31-3 52 0" stroke="#805323" strokeWidth="1" opacity=".16" fill="none"/></pattern>
          <filter id="historyRelief" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="11" stdDeviation="9" floodColor="#1d0c03" floodOpacity=".46"/><feDropShadow dx="0" dy="2" stdDeviation="1.2" floodColor="#fff1bb" floodOpacity=".25"/></filter>
          <filter id="historySoftShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#241006" floodOpacity=".32"/></filter>
        </defs>
        <rect x="12" y="12" width="1176" height="696" rx="24" fill="url(#historyVignette)" stroke="url(#historyGold)" strokeWidth="6" opacity=".72"/>
        <rect x="27" y="27" width="1146" height="666" rx="18" fill="url(#papyrusFibres)" stroke="#7f5126" strokeWidth="2" opacity=".42"/>
        <g filter="url(#historyRelief)" opacity=".38">
          <g transform="translate(58 128)">
            <path d="M0 22h122l-13 24H13Z" fill="url(#historyStone)" stroke="#68421f" strokeWidth="3"/>
            <path d="M22 46h78v360H22Z" fill="url(#historyStone)" stroke="#68421f" strokeWidth="3"/>
            <path d="M12 406h100l18 31H-6Z" fill="url(#historyStone)" stroke="#68421f" strokeWidth="3"/>
            <path d="M38 58v334M57 58v334M76 58v334" stroke="#f3d9aa" strokeWidth="3" opacity=".35"/>
          </g>
          <g transform="translate(1020 128)">
            <path d="M0 22h122l-13 24H13Z" fill="url(#historyStone)" stroke="#68421f" strokeWidth="3"/>
            <path d="M22 46h78v360H22Z" fill="url(#historyStone)" stroke="#68421f" strokeWidth="3"/>
            <path d="M12 406h100l18 31H-6Z" fill="url(#historyStone)" stroke="#68421f" strokeWidth="3"/>
            <path d="M38 58v334M57 58v334M76 58v334" stroke="#f3d9aa" strokeWidth="3" opacity=".35"/>
          </g>
        </g>
        <g transform="translate(790 510)" filter="url(#historyRelief)" opacity=".34">
          <ellipse cx="160" cy="132" rx="205" ry="18" fill="#241006" opacity=".22"/>
          <path d="M0 130 92 0l72 130Z" fill="url(#historyStone)" stroke="#6b431f" strokeWidth="4"/>
          <path d="M92 0 164 130 112 112Z" fill="#5a351e" opacity=".62"/>
          <path d="M120 130 215 30l92 100Z" fill="url(#historyStone)" stroke="#6b431f" strokeWidth="4"/>
          <path d="M215 30 307 130 238 112Z" fill="#4e2e1a" opacity=".58"/>
        </g>
        <g transform="translate(275 560)" filter="url(#historySoftShadow)" opacity=".31">
          <path d="M0 38c32-28 67-28 99 0 32 27 64 27 96 0 32-27 65-27 98 0" fill="none" stroke="#3e6d8f" strokeWidth="10" strokeLinecap="round"/>
          <path d="M0 36c32-20 67-20 99 0 32 20 64 20 96 0 32-20 65-20 98 0" fill="none" stroke="#a9d7e5" strokeWidth="2.5" opacity=".55"/>
        </g>
        <g transform="translate(875 125)" filter="url(#historyRelief)" opacity=".35">
          <circle cx="90" cy="90" r="72" fill="#11161b" stroke="url(#historyGold)" strokeWidth="6"/>
          <circle cx="90" cy="90" r="57" fill="none" stroke="#e7c66d" strokeWidth="2" opacity=".6"/>
          <path d="M90 26 104 78 90 154 76 78Z" fill="url(#historyGold)"/>
          <path d="M26 90 78 76 154 90 78 104Z" fill="#d9b75f" opacity=".86"/>
        </g>
        <g transform="translate(198 92)" filter="url(#historySoftShadow)" opacity=".38">
          <path d="M20 14h260c18 0 31 13 31 30v78c0 17-13 30-31 30H20c-18 0-31-13-31-30V44c0-17 13-30 31-30Z" fill="url(#historyPapyrus)" stroke="#74461f" strokeWidth="3"/>
          <rect x="-18" y="6" width="25" height="154" rx="10" fill="url(#historyGold)"/>
          <rect x="293" y="6" width="25" height="154" rx="10" fill="url(#historyGold)"/>
          <path d="M42 58h214M42 82h192M42 106h218" stroke="#75491f" strokeWidth="4" opacity=".36"/>
          <circle cx="246" cy="121" r="19" fill="#8f281f" stroke="#e9bd73" strokeWidth="3"/>
        </g>
        <g opacity=".16" fill="#70421c"><circle cx="420" cy="83" r="5"/><rect x="440" y="77" width="22" height="11" rx="2"/><path d="m482 88 12-20 12 20Z"/><circle cx="532" cy="82" r="8" fill="none" stroke="#70421c" strokeWidth="3"/></g>
      </>}
      {template === 'geography' && <>
        <g fill="none" stroke="#2d7562" opacity=".13"><ellipse cx="1010" cy="165" rx="105" ry="78" strokeWidth="4"/><ellipse cx="1010" cy="165" rx="65" ry="78" strokeWidth="3"/><path d="M905 165h210M1010 87v156" strokeWidth="3"/></g>
        <g fill="none" stroke="#2d7562" opacity=".11" strokeWidth="3"><path d="M80 555c90-72 170-68 250 5s160 75 250-8 170-76 265 6 175 80 270-6"/><path d="M105 585c80-52 160-48 235 4s155 55 235-6 160-56 250 5 165 59 260-8"/></g>
        <g fill="none" stroke="#467b68" opacity=".09"><ellipse cx="250" cy="300" rx="180" ry="110"/><ellipse cx="250" cy="300" rx="140" ry="82"/><ellipse cx="250" cy="300" rx="90" ry="50"/></g>
        <path d="M740 620 800 520l55 55 62-130 78 175" fill="#4c806b" opacity=".10"/>
        <g transform="translate(1060 540)" opacity=".22" fill="none" stroke="#2d7562" strokeWidth="5"><circle r="54"/><path d="M0-48 13-8 0 48-13-8ZM-48 0-8-13 48 0-8 13Z"/></g>
      </>}
      {template === 'manuscript' && <>
        <path d="M70 110c60-38 145-30 198 5M930 610c65 32 145 26 205-12" fill="none" stroke="#7e5126" strokeWidth="7" opacity=".11"/>
        <path d="M48 104h145c35 0 50 35 18 56H48c-30 0-35-40 0-56Zm1104 512H1002c-36 0-50-35-18-56h168c31 0 36 40 0 56Z" fill="#a86f32" opacity=".08" stroke="#7e5126" strokeWidth="4"/>
        <g stroke="#7e5126" opacity=".075" strokeWidth="2"><path d="M90 180h1020M90 220h1020M90 260h1020M90 300h1020M90 340h1020M90 380h1020M90 420h1020M90 460h1020M90 500h1020"/></g>
        <path d="M1020 150c-75 85-110 190-135 320m0 0 48-35m-48 35-15-55" fill="none" stroke="#603b1d" strokeWidth="9" opacity=".11" strokeLinecap="round"/>
      </>}
    </svg>
  );
}

function drawBoardThemeMotifs(ctx, template, width, height) {
  ctx.save();
  if (template === 'history') {
    ctx.globalAlpha = .11; ctx.strokeStyle = '#7b4b1f'; ctx.fillStyle = '#a87335'; ctx.lineWidth = 5;
    const pyramid = (x, base, w, h) => { ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + w / 2, base - h); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    pyramid(width - 250, height - 36, 170, 215); pyramid(45, height - 36, 140, 165);
    ctx.beginPath(); ctx.arc(width - 145, 145, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .16; ctx.strokeRect(24, 100, width - 48, height - 132);
  } else if (template === 'geography') {
    ctx.globalAlpha = .105; ctx.strokeStyle = '#2d7562'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(width - 170, 165, 108, 78, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(width - 170, 165, 62, 78, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - 278, 165); ctx.lineTo(width - 62, 165); ctx.moveTo(width - 170, 87); ctx.lineTo(width - 170, 243); ctx.stroke();
    for (let radius = 55; radius <= 165; radius += 35) { ctx.beginPath(); ctx.ellipse(230, 310, radius, radius * .55, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = .12; ctx.fillStyle = '#4c806b'; ctx.beginPath(); ctx.moveTo(width - 470, height - 32); ctx.lineTo(width - 390, height - 160); ctx.lineTo(width - 330, height - 90); ctx.lineTo(width - 255, height - 245); ctx.lineTo(width - 155, height - 32); ctx.closePath(); ctx.fill();
  } else if (template === 'manuscript') {
    ctx.globalAlpha = .08; ctx.strokeStyle = '#7e5126'; ctx.lineWidth = 2;
    for (let y = 175; y < height - 80; y += 42) { ctx.beginPath(); ctx.moveTo(85, y); ctx.lineTo(width - 85, y); ctx.stroke(); }
    ctx.globalAlpha = .11; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(width - 165, 145); ctx.quadraticCurveTo(width - 260, 260, width - 300, height - 150); ctx.stroke();
  }
  ctx.restore();
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

async function drawBoardIdentity(ctx, template, width, height, meta = {}) {
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
  ctx.globalAlpha = 0.045;
  ctx.strokeStyle = template === 'geography' ? '#1f6b55' : '#6d421d';
  ctx.lineWidth = 2;
  for (let x = 40; x < width; x += 90) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 35; y < height; y += 75) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.restore();
  drawBoardThemeMotifs(ctx, template, width, height);

  ctx.save();
  ctx.strokeStyle = template === 'geography' ? 'rgba(31,107,85,.22)' : 'rgba(109,66,29,.24)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.restore();

  try {
    const logo = await dataUrlToImage(identity.logo);
    const target = Math.min(width, height) * 0.30;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.drawImage(logo, (width - target) / 2, (height - target) / 2, target, target);
    ctx.restore();
  } catch {
    // Optional watermark.
  }

  const ribbonHeight = 82;
  const ribbonGradient = ctx.createLinearGradient(0, 0, width, 0);
  ribbonGradient.addColorStop(0, '#080a0f');
  ribbonGradient.addColorStop(.5, '#17120a');
  ribbonGradient.addColorStop(1, '#080a0f');
  ctx.save();
  ctx.fillStyle = ribbonGradient;
  ctx.fillRect(0, 0, width, ribbonHeight);
  ctx.strokeStyle = '#d7ad35';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, ribbonHeight - 3); ctx.lineTo(width, ribbonHeight - 3); ctx.stroke();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e7bf62';
  ctx.font = '700 18px Tahoma, Arial, sans-serif';
  ctx.fillText('الصف', width - 36, 23);
  ctx.fillStyle = '#fff7df';
  ctx.font = '700 25px Tahoma, Arial, sans-serif';
  ctx.fillText(String(meta.grade || 'غير محدد'), width - 36, 55);
  ctx.fillStyle = '#e7bf62';
  ctx.font = '700 18px Tahoma, Arial, sans-serif';
  ctx.fillText('الدرس', width - 390, 23);
  ctx.fillStyle = '#fff7df';
  ctx.font = '700 25px Tahoma, Arial, sans-serif';
  ctx.fillText(String(meta.lesson || 'حصة جديدة').slice(0, 38), width - 390, 55);
  ctx.restore();

  try {
    const portrait = await dataUrlToImage(identity.portrait);
    const size = 66;
    const centerX = 44;
    const centerY = ribbonHeight / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(portrait, centerX - size / 2, centerY - size / 2, size, size);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#d7ad35'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(centerX, centerY, size / 2 + 2, 0, Math.PI * 2); ctx.stroke();
    ctx.direction = 'rtl'; ctx.textAlign = 'left';
    ctx.fillStyle = '#f3d783'; ctx.font = '700 22px Tahoma, Arial, sans-serif';
    ctx.fillText(identity.teacherName, 88, 34);
    ctx.fillStyle = '#fff7df'; ctx.font = '600 16px Tahoma, Arial, sans-serif';
    ctx.fillText(identity.teacherTitle, 88, 59);
    ctx.restore();
  } catch {
    // Portrait is decorative.
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
    const lineHeight = Math.max(31, Number(stamp.fontSize || 22) * 1.35);
    const measuredWidth = Math.max(...lines.map((line) => ctx.measureText(line || ' ').width), 0);
    const boxWidth = Math.min(620, Math.max(230, measuredWidth + 48));
    const boxHeight = Math.max(62, lines.length * lineHeight + 22);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    if (style !== 'plain') {
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(20,12,5,.42)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      if (style === 'historical') {
        const paper = ctx.createLinearGradient(-boxWidth, 0, 0, boxHeight);
        paper.addColorStop(0, '#c99a54');
        paper.addColorStop(.15, '#f0d49b');
        paper.addColorStop(.82, '#f8e7bd');
        paper.addColorStop(1, '#b77b37');
        ctx.fillStyle = paper;
        ctx.strokeStyle = '#87501f';
        ctx.shadowColor = 'rgba(45,25,8,.28)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth, -12, boxWidth, boxHeight, 10);
        else ctx.rect(-boxWidth, -12, boxWidth, boxHeight);
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#a96d2d';
        ctx.fillRect(-boxWidth + 12, -6, 9, boxHeight - 12);
        ctx.fillRect(-18, -6, 9, boxHeight - 12);
        const seal = ctx.createRadialGradient(-boxWidth + 38, boxHeight - 22, 2, -boxWidth + 38, boxHeight - 22, 17);
        seal.addColorStop(0, '#e56b4b'); seal.addColorStop(.55, '#a92e24'); seal.addColorStop(1, '#5b1716');
        ctx.fillStyle = seal; ctx.beginPath(); ctx.arc(-boxWidth + 38, boxHeight - 22, 16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f0c27a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-boxWidth + 38, boxHeight - 22, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(91,51,18,.3)';
        ctx.beginPath(); ctx.moveTo(-boxWidth + 34, boxHeight - 9); ctx.lineTo(-34, boxHeight - 9); ctx.stroke();
        ctx.fillStyle = '#3d2816';
      } else if (style === 'geography') {
        const mapFill = ctx.createLinearGradient(-boxWidth, -12, 0, boxHeight);
        mapFill.addColorStop(0, '#dcebd3');
        mapFill.addColorStop(.55, '#f4ecd2');
        mapFill.addColorStop(1, '#b9d8cb');
        ctx.fillStyle = mapFill;
        ctx.strokeStyle = '#276a58';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth, -12, boxWidth, boxHeight, 8);
        else ctx.rect(-boxWidth, -12, boxWidth, boxHeight);
        ctx.fill(); ctx.stroke();
        ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = '#2b6f63'; ctx.lineWidth = 1;
        for (let gx = -boxWidth + 26; gx < -10; gx += 42) { ctx.beginPath(); ctx.moveTo(gx, -9); ctx.lineTo(gx, boxHeight - 16); ctx.stroke(); }
        for (let gy = 12; gy < boxHeight - 12; gy += 30) { ctx.beginPath(); ctx.moveTo(-boxWidth + 8, gy); ctx.lineTo(-10, gy); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = '#1f6b55';
        ctx.beginPath(); ctx.arc(-boxWidth + 34, boxHeight / 2 - 4, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e9d699'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-boxWidth + 34, boxHeight / 2 - 4, 16, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#e9d699'; ctx.beginPath(); ctx.moveTo(-boxWidth + 34, boxHeight / 2 - 16); ctx.lineTo(-boxWidth + 39, boxHeight / 2 - 1); ctx.lineTo(-boxWidth + 34, boxHeight / 2 + 7); ctx.lineTo(-boxWidth + 29, boxHeight / 2 - 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#173f37';
      } else if (style === 'event') {
        ctx.fillStyle = 'rgba(17,24,39,.96)';
        ctx.strokeStyle = '#d7ad35';
        ctx.beginPath();
        ctx.moveTo(-boxWidth + 16, -12); ctx.lineTo(-16, -12); ctx.lineTo(0, 4); ctx.lineTo(0, boxHeight - 28); ctx.lineTo(-16, boxHeight - 12); ctx.lineTo(-boxWidth + 16, boxHeight - 12); ctx.lineTo(-boxWidth, boxHeight - 28); ctx.lineTo(-boxWidth, 4); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d7ad35';
        ctx.font = '700 28px Tahoma, Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText('★', -boxWidth + 32, boxHeight / 2 - 2);
        ctx.textAlign = 'right';
        ctx.font = `${stamp.fontWeight || 700} ${stamp.fontSize || 22}px ${stamp.fontFamily || 'Tahoma, Arial, sans-serif'}`;
        ctx.fillStyle = '#fff5d6';
      } else if (style === 'date') {
        ctx.fillStyle = '#6b3f22'; ctx.strokeStyle = '#e4bd72';
        ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth, -12, boxWidth, boxHeight, 999); else ctx.rect(-boxWidth, -12, boxWidth, boxHeight); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e4bd72'; ctx.beginPath(); ctx.arc(-boxWidth + 30, boxHeight / 2 - 6, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff4d8';
      } else if (style === 'person') {
        ctx.fillStyle = '#2e2239'; ctx.strokeStyle = '#d2a957';
        ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth, -12, boxWidth, boxHeight, 18); else ctx.rect(-boxWidth, -12, boxWidth, boxHeight); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d2a957'; ctx.beginPath(); ctx.arc(-boxWidth + 32, boxHeight / 2 - 12, 10, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(-boxWidth + 32, boxHeight / 2 + 13, 17, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff7df';
      } else if (style === 'place') {
        ctx.fillStyle = '#173f37'; ctx.strokeStyle = '#e2c56e';
        ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth, -12, boxWidth, boxHeight, 12); else ctx.rect(-boxWidth, -12, boxWidth, boxHeight); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e2c56e'; ctx.beginPath(); ctx.arc(-boxWidth + 34, boxHeight / 2 - 12, 11, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-boxWidth + 34, boxHeight / 2 + 18); ctx.lineTo(-boxWidth + 22, boxHeight / 2 - 4); ctx.lineTo(-boxWidth + 46, boxHeight / 2 - 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff7df';
      } else if (style === 'definition') {
        const definitionFill = ctx.createLinearGradient(-boxWidth, -12, 0, boxHeight);
        definitionFill.addColorStop(0, '#1b2130');
        definitionFill.addColorStop(1, '#35250f');
        ctx.fillStyle = definitionFill; ctx.strokeStyle = '#d7ad35';
        ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth, -12, boxWidth, boxHeight, 16); else ctx.rect(-boxWidth, -12, boxWidth, boxHeight); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d7ad35'; ctx.font = '700 25px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('❖', -boxWidth + 34, boxHeight / 2 - 3);
        ctx.textAlign = 'right'; ctx.font = `${stamp.fontWeight || 700} ${stamp.fontSize || 22}px ${stamp.fontFamily || 'Tahoma, Arial, sans-serif'}`; ctx.fillStyle = '#fff6d8';
      } else if (style === 'note') {
        ctx.fillStyle = '#fff1a9'; ctx.strokeStyle = '#9d7621';
        ctx.beginPath(); ctx.moveTo(-boxWidth, -12); ctx.lineTo(-28, -12); ctx.lineTo(0, 16); ctx.lineTo(0, boxHeight - 12); ctx.lineTo(-boxWidth, boxHeight - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e1b947'; ctx.beginPath(); ctx.moveTo(-28, -12); ctx.lineTo(0, 16); ctx.lineTo(-28, 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4c3510';
      } else {
        ctx.fillStyle = 'rgba(57,36,18,.94)'; ctx.strokeStyle = '#d7ad35';
        ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth, -12, boxWidth, boxHeight, 14); else ctx.rect(-boxWidth, -12, boxWidth, boxHeight); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff7df';
      }
    }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    lines.forEach((line, index) => ctx.fillText(line, -20, 8 + index * lineHeight));
  } else if (stamp.kind === 'shape') {
    const kind = stamp.shape || 'rect';
    const fill = ctx.createLinearGradient(15, 5, 145, 115);
    fill.addColorStop(0, 'rgba(255,244,192,.40)');
    fill.addColorStop(.42, 'rgba(215,173,53,.24)');
    fill.addColorStop(1, 'rgba(72,44,12,.14)');
    ctx.fillStyle = fill;
    ctx.strokeStyle = stamp.color || '#d7ad35';
    ctx.lineWidth = Math.max(4, Number(stamp.width || 4));
    ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    if (kind === 'circle') {
      ctx.beginPath(); ctx.arc(80, 60, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = '#fff2b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(72, 51, 34, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke(); ctx.restore();
    } else if (kind === 'triangle') {
      ctx.beginPath(); ctx.moveTo(80, 10); ctx.lineTo(130, 102); ctx.lineTo(30, 102); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha = .45; ctx.strokeStyle = '#fff2b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(80, 20); ctx.lineTo(119, 93); ctx.stroke(); ctx.restore();
    } else if (kind === 'line') {
      ctx.shadowBlur = 7; ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(160, 60); ctx.stroke();
    } else {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(20, 20, 120, 86, 14); else ctx.rect(20, 20, 120, 86);
      ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha = .48; ctx.strokeStyle = '#fff2b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, 31); ctx.lineTo(128, 31); ctx.stroke(); ctx.restore();
    }
  } else if (stamp.kind === 'historical-symbol') {
    const kind = stamp.symbolKind || 'pyramid';
    const gold = ctx.createLinearGradient(20, 10, 145, 110);
    gold.addColorStop(0, '#fff0a6'); gold.addColorStop(.32, '#d8a83b'); gold.addColorStop(.68, '#8d5718'); gold.addColorStop(1, '#f0c968');
    const stone = ctx.createLinearGradient(20, 8, 130, 112);
    stone.addColorStop(0, '#f1d6a5'); stone.addColorStop(.45, '#b8864f'); stone.addColorStop(1, '#6d4427');
    const paper = ctx.createLinearGradient(10, 10, 150, 105);
    paper.addColorStop(0, '#fff0bf'); paper.addColorStop(.5, '#d8b779'); paper.addColorStop(1, '#9c672f');
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 7; ctx.lineWidth = 3;
    if (kind === 'pyramid') {
      ctx.fillStyle = stone; ctx.strokeStyle = '#6e431e';
      ctx.beginPath(); ctx.moveTo(18, 108); ctx.lineTo(82, 12); ctx.lineTo(148, 108); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(70,39,18,.35)'; ctx.beginPath(); ctx.moveTo(82, 12); ctx.lineTo(148,108); ctx.lineTo(96,94); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,194,.45)'; ctx.lineWidth = 2; for (let y = 40; y < 100; y += 18) { ctx.beginPath(); ctx.moveTo(35 + y*.28, y); ctx.lineTo(128 - y*.18, y); ctx.stroke(); }
    } else if (kind === 'column') {
      ctx.fillStyle = stone; ctx.strokeStyle = '#71451f';
      ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(54, 18, 54, 84, 8); else ctx.rect(54,18,54,84); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold; ctx.fillRect(42, 12, 78, 15); ctx.fillRect(38, 99, 86, 15);
      ctx.strokeStyle = 'rgba(255,242,200,.5)'; ctx.lineWidth = 2; for (let x = 64; x <= 98; x += 11) { ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x, 96); ctx.stroke(); }
    } else if (kind === 'scroll') {
      ctx.fillStyle = paper; ctx.strokeStyle = '#7b4a22';
      ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(24, 22, 116, 82, 13); else ctx.rect(24,22,116,82); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold; ctx.fillRect(16, 18, 15, 91); ctx.fillRect(133, 18, 15, 91);
      ctx.strokeStyle = 'rgba(91,52,21,.45)'; ctx.lineWidth = 2; for (let y=40;y<91;y+=13){ctx.beginPath();ctx.moveTo(43,y);ctx.lineTo(120,y);ctx.stroke();}
      ctx.fillStyle = '#8f2f25'; ctx.beginPath(); ctx.arc(82, 88, 11, 0, Math.PI*2); ctx.fill();
    } else if (kind === 'obelisk') {
      ctx.fillStyle = stone; ctx.strokeStyle = '#6c421f';
      ctx.beginPath(); ctx.moveTo(62, 27); ctx.lineTo(82, 5); ctx.lineTo(102,27); ctx.lineTo(108,104); ctx.lineTo(56,104); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,239,189,.34)'; ctx.beginPath(); ctx.moveTo(82,5); ctx.lineTo(102,27); ctx.lineTo(84,29); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d3a54e'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(47,105); ctx.lineTo(117,105); ctx.stroke();
    } else if (kind === 'crown') {
      ctx.fillStyle = gold; ctx.strokeStyle = '#704311';
      ctx.beginPath(); ctx.moveTo(22,42); ctx.lineTo(45,72); ctx.lineTo(64,34); ctx.lineTo(84,72); ctx.lineTo(108,30); ctx.lineTo(139,72); ctx.lineTo(132,104); ctx.lineTo(30,104); ctx.closePath(); ctx.fill(); ctx.stroke();
      [['#c2362b',52],['#1b6ca8',83],['#33875b',112]].forEach(([c,x])=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,82,8,0,Math.PI*2);ctx.fill();});
    } else {
      ctx.fillStyle = 'rgba(12,22,28,.94)'; ctx.strokeStyle = '#d7ad35'; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(82,62,48,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f7d97c'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(82,18);ctx.lineTo(91,55);ctx.lineTo(82,104);ctx.lineTo(73,55);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(38,62);ctx.lineTo(75,53);ctx.lineTo(126,62);ctx.lineTo(75,71);ctx.closePath();ctx.stroke();
      ctx.fillStyle='#f7d97c';ctx.font='700 16px Tahoma';ctx.textAlign='center';ctx.fillText('ش',82,16);ctx.fillText('ج',82,120);ctx.fillText('ق',137,67);ctx.fillText('غ',27,67);
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
  if (action.kind === 'text') {
    const lines = String(action.text || '').split('\n').slice(0, 5);
    const fontSize = Number(action.fontSize || 22);
    const width = Math.min(620, Math.max(230, Math.max(...lines.map((line) => line.length), 1) * fontSize * 0.72 + 48));
    return { x: action.x - width, y: action.y - 12, width, height: Math.max(62, lines.length * Math.max(31, fontSize * 1.35) + 22) };
  }
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

function CanvasOverlay({ actions, onDrawAction, onMoveAction, onSelectAction, selectedActionId, template, zoom, boardRef, tool, selectedColor, strokeWidth, shapeKind, historicalSymbol, arrowMode, textValue, textStyle, fontFamily, fontSize, boardReady, setBoardReady, hasResourceHeader = false }) {
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
    if (tool === 'text' || tool === 'shape' || tool === 'arrow' || tool === 'historical-symbol') {
      let stampText = textValue.trim();
      if (tool === 'text' && !stampText) stampText = window.prompt('اكتب النص الذي تريد وضعه على السبورة:', '') || '';
      if (tool === 'text' && !stampText.trim()) return;
      onDrawAction({
        kind: tool,
        x: point.x,
        y: point.y,
        text: stampText || `سهم ${arrowMode}`,
        shape: shapeKind,
        symbolKind: historicalSymbol,
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
          <BoardThemeDecor template={template} />
          <div className="classmode-history-ornament ornament-top" />
          <img className="classmode-board-watermark" src={identity.logo} alt="" />
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


function BoardLessonRibbon({ grade, lesson }) {
  return (
    <div className="classmode-board-lesson-ribbon" aria-label="بيانات الحصة الحالية">
      <div className="board-ribbon-seal" aria-hidden="true"><BookOpen size={24}/></div>
      <div className="board-ribbon-stat"><span>الصف</span><strong>{grade || 'غير محدد'}</strong></div>
      <i className="board-ribbon-divider" />
      <div className="board-ribbon-stat board-ribbon-lesson"><span>الدرس</span><strong>{lesson || 'حصة جديدة'}</strong></div>
      <i className="board-ribbon-divider" />
      <div className="board-ribbon-teacher"><span><strong>{identity.teacherName}</strong><small>{identity.teacherTitle}</small></span><img src={identity.portrait} alt={identity.teacherName}/></div>
    </div>
  );
}

export default function ClassMode({ data, updateData, navigate }) {
  const sessionList = Array.isArray(data.sessions) ? data.sessions : [];
  const current = sessionList.find((session) => session.current) || sessionList[0] || {
    id: 'standalone-class',
    title: 'حصة جديدة',
    group: '',
    grade: '',
    time: '',
    current: false,
  };
  const studentList = Array.isArray(data.students) ? data.students : [];
  const students = current.group
    ? studentList.filter((student) => student.group === current.group)
    : studentList;
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
  const [boardControlsOpen, setBoardControlsOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [phraseMenu, setPhraseMenu] = useState('');
  const [points, setPoints] = useState(() => Object.fromEntries(
    students.map((student) => [student.id, Math.max(0, Number(student.points || 0))]),
  ));
  const rankedStudents = useMemo(
    () => rankStudentsByPoints(students, points),
    [students, points],
  );
  useEffect(() => {
    setPoints((currentPoints) => {
      const next = { ...currentPoints };
      let changed = false;
      for (const student of students) {
        if (Object.prototype.hasOwnProperty.call(next, student.id)) continue;
        next[student.id] = Math.max(0, Number(student.points || 0));
        changed = true;
      }
      return changed ? next : currentPoints;
    });
  }, [students]);
  const [view, setView] = useState('board');
  const [tool, setTool] = useState('pen');
  const [notes, setNotes] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [stageFocus, setStageFocus] = useState(false);
  const [contentMode, setContentMode] = useState('pdf');
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.classList.add('mobdea-classmode-active');
    document.body.classList.add('mobdea-classmode-active');
    const orientation = globalThis.screen?.orientation;
    if (orientation?.lock) {
      Promise.resolve(orientation.lock('landscape')).catch(() => null);
    }
    return () => {
      document.documentElement.classList.remove('mobdea-classmode-active');
      document.body.classList.remove('mobdea-classmode-active');
      try { orientation?.unlock?.(); } catch { /* Browser may not expose orientation unlock. */ }
    };
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
  const [recordingWithAudio, setRecordingWithAudio] = useState(true);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [liveStartRequest, setLiveStartRequest] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingBackend, setRecordingBackend] = useState('');
  const [hasPendingNativeRecording, setHasPendingNativeRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);
  const recordingCleanupRef = useRef(() => {});
  const recordingStopResolverRef = useRef(null);
  const recordingStopTimerRef = useRef(null);
  const recordingTimelineRef = useRef([]);
  const recordingBackendRef = useRef('');
  const recordingFinalizedRef = useRef(false);
  const pendingNativeRecordingRef = useRef(null);
  const stopRecordingOnUnmountRef = useRef(() => Promise.resolve());
  const latestDataRef = useRef(data);
  const latestLessonPayloadRef = useRef(null);
  const latestComposeBoardImageRef = useRef(null);
  latestDataRef.current = data;
  useEffect(() => {
    recordingBackendRef.current = recordingBackend;
  }, [recordingBackend]);
  useEffect(() => {
    if (!recordingActive || recordingPaused) return undefined;
    const timer = setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recordingActive, recordingPaused]);
  const [shapeKind, setShapeKind] = useState('rect');
  const [historicalSymbol, setHistoricalSymbol] = useState('pyramid');
  const [arrowMode, setArrowMode] = useState('right');
  const [boardText, setBoardText] = useState('');
  const [textStyle, setTextStyle] = useState('plain');
  const [fontFamily, setFontFamily] = useState('Tahoma, Arial, sans-serif');
  const [fontSize, setFontSize] = useState(24);
  const [zoom, setZoom] = useState(1);
  const [mediaZoom, setMediaZoom] = useState(1);
  const resourcePageMemoryRef = useRef(new Map());
  const resourceZoomMemoryRef = useRef(new Map());
  const appliedPreferredResourceRef = useRef('');
  const [boardReady, setBoardReady] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const canvasTool = TEXT_TOOL_STYLES[tool] ? 'text' : tool;

  useEffect(() => {
    if (!shareNotice) return undefined;
    const timer = window.setTimeout(() => setShareNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);

  useEffect(() => {
    if (!lastPraise) return undefined;
    const timer = window.setTimeout(() => setLastPraise(''), 4200);
    return () => window.clearTimeout(timer);
  }, [lastPraise]);
  const [challengeMode, setChallengeMode] = useState('battle');
  const [challengePickIds, setChallengePickIds] = useState([]);
  const [challengeNotice, setChallengeNotice] = useState('');
  const [onlineGameStartRequest, setOnlineGameStartRequest] = useState(0);
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

  useEffect(() => {
    if (contentMode !== 'board' && stageFocus) setStageFocus(false);
  }, [contentMode, stageFocus]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && stageFocus) setStageFocus(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stageFocus]);

  const selectedResource = useMemo(
    () => resources.find((item) => String(item.id) === String(selectedResourceId)) || resources[0] || null,
    [resources, selectedResourceId]
  );
  const selectedStorageResource = selectedResource?.virtualLessonTextbook || selectedResource?.virtualLessonExams || selectedResource?.virtualLessonRecording ? activeLesson : selectedResource;
  const selectedResourceType = useMemo(() => resourceMediaType(selectedResource), [selectedResource]);
  const modeResources = useMemo(() => {
    const wantedTypes = modeResourceTypes[contentMode] || [];
    if (!wantedTypes.length) return [];
    return resources.filter((resource) => wantedTypes.includes(resourceMediaType(resource)));
  }, [contentMode, resources]);
  const displayResource = useMemo(() => {
    if (!modeResources.length) return null;
    const selected = modeResources.find((resource) => String(resource.id) === String(selectedResourceId)) || modeResources[0];
    return selected ? { ...selected, type: resourceMediaType(selected) } : null;
  }, [modeResources, selectedResourceId]);
  const displayResourceSource = useAssetSource(displayResource?.assetId, displayResource?.url);
  const displayResourceUrl = displayResourceSource.url;
  const selectedResourceSource = useAssetSource(selectedResource?.assetId, selectedResource?.url);
  const selectedResourceUrl = selectedResourceSource.url;
  const selectedExamUrl = useAssetUrl(displayResource?.examAssetId || selectedResource?.examAssetId, displayResource?.examUrl || selectedResource?.examUrl);
  const displayResourceIndex = Math.max(0, modeResources.findIndex((resource) => String(resource.id) === String(displayResource?.id)));
  const cycleModeResource = (direction) => {
    if (modeResources.length < 2) return;
    const next = (displayResourceIndex + direction + modeResources.length) % modeResources.length;
    setSelectedResourceId(modeResources[next].id);
    setFlowIndex(0);
  };

  const [classPage, setClassPage] = useState(null);
  useEffect(() => {
    const resourceKey = String(selectedResource?.id || '');
    const rememberedPage = resourceKey ? resourcePageMemoryRef.current.get(resourceKey) : null;
    setClassPage(clampLessonPage(rememberedPage || selectedResource?.pageStart || 1, selectedResource, 1));
    const rememberedZoom = resourceKey ? resourceZoomMemoryRef.current.get(resourceKey) : null;
    setMediaZoom(Number.isFinite(Number(rememberedZoom)) ? Number(rememberedZoom) : 1);
  }, [selectedResource?.id, selectedResource?.pageStart, selectedResource?.pageEnd]);
  useEffect(() => {
    const resourceKey = String(selectedResource?.id || '');
    if (!resourceKey || !classPage) return;
    resourcePageMemoryRef.current.set(resourceKey, Number(classPage));
  }, [selectedResource?.id, classPage]);
  useEffect(() => {
    const resourceKey = String(selectedResource?.id || '');
    if (!resourceKey) return;
    resourceZoomMemoryRef.current.set(resourceKey, Number(mediaZoom || 1));
  }, [selectedResource?.id, mediaZoom]);
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
  const nativeRuntime = Boolean(globalThis.Capacitor?.isNativePlatform?.());
  const [webPdfState, setWebPdfState] = useState({ dataUrl: '', pageCount: 0, loading: false, error: '' });
  useEffect(() => {
    setWebPdfState({ dataUrl: '', pageCount: 0, loading: false, error: '' });
  }, [displayResource?.id]);
  const nativePdfPage = usePdfPage(
    nativeRuntime && contentMode === 'pdf' && ['pdf', 'textbook'].includes(displayResource?.type)
      ? { blob: displayResourceSource.blob, url: displayResourceUrl, cacheKey: displayResource?.assetId || displayResource?.id || displayResourceUrl }
      : null,
    classPage || 1,
  );
  const renderedPdf = nativeRuntime ? nativePdfPage : webPdfState;
  const boardLayerKey = contentMode === 'board'
    ? `board:${current?.id || 'session'}`
    : `${displayResource?.id || selectedResource?.id || 'blank'}:${classPage || 1}`;
  const boardToolsAvailable = contentMode === 'board' || Boolean(displayResource && ['pdf', 'images'].includes(contentMode));
  const boardToolsVisible = boardToolsAvailable && boardControlsOpen;
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
    const nextResource = sessionQueue[next];
    setSelectedResourceId(nextResource.id);
    setContentMode(resourceContentMode(nextResource));
    setFlowIndex(0);
  };
  const switchContentMode = (mode) => {
    if (mode === 'board' || mode === 'maps' || mode === 'games') {
      setContentMode(mode);
      return;
    }
    const wantedTypes = modeResourceTypes[mode] || [];
    const match = wantedTypes.includes(selectedResourceType)
      ? selectedResource
      : resources.find((item) => wantedTypes.includes(item.type === 'textbook' ? 'textbook' : inferMediaType({ type: item.type, mimeType: item.mimeType, fileName: item.fileName, name: item.title })));
    if (match) setSelectedResourceId(match.id);
    setContentMode(mode);
  };
  const flow = useMemo(() => normalizeSequence(selectedResource?.sequence), [selectedResource]);
  const activeFlow = flow[flowIndex] || flow[0] || 'preview';
  const resourceAnnotations = Array.isArray(selectedResource?.annotations) ? selectedResource.annotations : [];
  const relatedQuestions = useMemo(() => {
    const baseBank = [...questionBank, ...(data.customQuestionBank || [])];
    const ids = normalizeTags(selectedResource?.relatedQuestionIds || selectedResource?.questionIds || []);
    const byIds = ids.length
      ? ids.map((id) => baseBank.find((question) => String(question.id) === String(id))).filter(Boolean)
      : [];
    if (byIds.length) return byIds;
    const lessonId = String(activeLesson?.id || selectedResource?.lessonId || '');
    const sourceId = String(selectedResource?.sourceResourceId || selectedResource?.id || '');
    const lessonTitle = String(activeLesson?.title || selectedResource?.lesson || '').trim();
    return baseBank
      .filter((question) => {
        if (lessonId && String(question.lessonId || '') === lessonId) return true;
        if (sourceId && [question.resourceId, question.sourceResourceId, question.sourceExamResourceId].some((value) => String(value || '') === sourceId)) return true;
        return Boolean(
          selectedResource
          && question.grade === selectedResource.grade
          && question.unit === selectedResource.unit
          && (!lessonTitle || String(question.lesson || '').trim() === lessonTitle)
        );
      });
  }, [activeLesson?.id, activeLesson?.title, data.customQuestionBank, selectedResource]);

  const rememberGameQuestions = async (questionIds) => {
    const ids = (Array.isArray(questionIds) ? questionIds : [questionIds]).filter(Boolean);
    if (!ids.length) return;
    await updateData((latest) => ({
      ...latest,
      gameQuestionHistory: appendQuestionHistory(latest.gameQuestionHistory || [], ids, 500),
    }));
  };
  const rememberGameQuestion = (questionId) => rememberGameQuestions([questionId]);
  const onlineGameQuestions = useMemo(() => selectQuestionRound(
    relatedQuestions,
    data.gameQuestionHistory || [],
    Math.min(10, relatedQuestions.length || 1),
  ), [data.gameQuestionHistory, relatedQuestions]);

  const recentRecordings = useMemo(() => (data.lessonRecordings || [])
    .slice()
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, 8), [data.lessonRecordings]);

  const saveSelectedResource = async (patch = {}) => {
    if (!selectedStorageResource) return;
    const normalizedPatch = selectedResource?.virtualLessonExams && Object.prototype.hasOwnProperty.call(patch, 'annotations')
      ? { ...patch, examAnnotations: patch.annotations, annotations: selectedStorageResource.annotations || [] }
      : patch;
    const targetId = selectedStorageResource.id;
    await updateData((latest) => ({
      ...latest,
      contentLibrary: (latest.contentLibrary || []).map((resource) =>
        String(resource.id) === String(targetId)
          ? { ...resource, ...normalizedPatch, updatedAt: new Date().toISOString() }
          : resource
      ),
    }));
  };

  const selectLesson = async (lessonId) => {
    const lesson = lessons.find((item) => String(item.id) === String(lessonId)) || null;
    if (!lesson) return;
    const nextResources = getLessonModeResources(data, currentGrade, lesson.id);
    setActiveLessonId(lesson.id);
    setSelectedResourceId(nextResources[0]?.id || '');
    setContentMode(nextResources.some((item) => ['pdf', 'textbook'].includes(item.type)) ? 'pdf' : 'board');
    setFlowIndex(0);
    await updateData((latest) => ({
      ...latest,
      settings: {
        ...latest.settings,
        classLessonId: lesson.id,
        classResourceId: nextResources[0]?.id || '',
      },
    }));
  };

  const saveLessonMapState = async (mapState) => {
    if (!activeLesson) return;
    const lessonId = activeLesson.id;
    await updateData((latest) => ({
      ...latest,
      contentLibrary: (latest.contentLibrary || []).map((resource) =>
        String(resource.id) === String(lessonId)
          ? { ...resource, mapState, updatedAt: new Date().toISOString() }
          : resource
      ),
    }));
  };

  const composeBoardImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f6f0e1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (contentMode === 'board') {
      await drawBoardIdentity(ctx, boardTemplate, canvas.width, canvas.height, { grade: currentGrade, lesson: activeLesson?.title || selectedResource?.lesson || current.title });
    }

    const backgroundSource = contentMode === 'images' && displayResource?.type === 'image'
      ? displayResourceUrl
      : (contentMode === 'pdf' && ['pdf', 'textbook'].includes(displayResource?.type) ? renderedPdf.dataUrl : '');
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
    // Draw ink on a transparent layer so the eraser removes annotations only;
    // it must never punch transparent holes through the PDF/image/board base.
    const inkCanvas = document.createElement('canvas');
    inkCanvas.width = canvas.width;
    inkCanvas.height = canvas.height;
    const inkContext = inkCanvas.getContext('2d');
    boardActions.forEach((action) => drawBoardAction(inkContext, action, false));
    ctx.drawImage(inkCanvas, 0, 0);
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
    storageResourceId: selectedStorageResource?.id || '',
    boardLayerKey,
    contentMode,
    createdAt: new Date().toISOString(),
  });
  latestLessonPayloadRef.current = buildLessonPayload;
  latestComposeBoardImageRef.current = composeBoardImage;

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
      const sessionId = current.id;
      await updateData((latest) => ({
        ...latest,
        sessions: (latest.sessions || []).map((session) => session.id === sessionId
          ? { ...session, boardLayers: { ...(session.boardLayers || {}), [boardLayerKey]: layer }, updatedAt: new Date().toISOString() }
          : session),
      }));
    }
    setShareNotice('تم حفظ طبقة الكتابة وربطها بالحصة.');
  };

  const recordLesson = async ({ copyLink = false, screenRecording = null } = {}) => {
    const boardImage = await (latestComposeBoardImageRef.current || composeBoardImage)();
    const payload = (latestLessonPayloadRef.current || buildLessonPayload)({ boardImage });
    const latestData = latestDataRef.current || data;
    let share = { url: '', token: null };
    let shareError = '';
    try {
      share = await buildShareLink('lesson', payload, { cloudSync: latestData.settings?.cloudSync });
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
      microphoneEnabled: screenRecording?.microphoneEnabled !== false,
      timeline: Array.isArray(screenRecording?.timeline)
        ? screenRecording.timeline.slice(0, 1000)
        : [],
      shareToken: share.token || '',
      shareUrl: share.url || '',
      visibleToStudents: true,
      studentIds: students.map((student) => student.id),
      publishedAt: new Date().toISOString(),
    };
    let droppedRecordings = [];
    try {
      await updateData((latest) => {
        const allRecordings = [recording, ...(latest.lessonRecordings || [])];
        droppedRecordings = allRecordings.slice(120);
        const boardLayer = Array.isArray(payload.boardActions) ? payload.boardActions.slice(-500) : [];
        const nextSessions = (latest.sessions || []).map((session) =>
          String(session.id) === String(payload.sessionId) ? {
            ...session,
            summary: payload.summary,
            updatedAt: new Date().toISOString(),
            recordingId: recording.id,
            recordingShareUrl: share.url || '',
            boardLayers: payload.contentMode !== 'board' && payload.resource
              ? session.boardLayers
              : { ...(session.boardLayers || {}), [payload.boardLayerKey]: boardLayer },
          } : session
        );
        const nextContentLibrary = payload.contentMode !== 'board' && payload.storageResourceId
          ? (latest.contentLibrary || []).map((resource) =>
            String(resource.id) === String(payload.storageResourceId)
              ? { ...resource, boardLayers: { ...(resource.boardLayers || {}), [payload.boardLayerKey]: boardLayer }, updatedAt: new Date().toISOString() }
              : resource
          )
          : latest.contentLibrary;
        return {
          ...latest,
          contentLibrary: nextContentLibrary,
          sessions: nextSessions,
          lessonRecordings: allRecordings.slice(0, 120),
          settings: {
            ...latest.settings,
            classLessonId: payload.lessonId || '',
            classResourceId: payload.resource?.id || '',
            classResourceTitle: payload.resource?.title || '',
            classResourceType: payload.resource?.type || '',
            classResourceFileName: payload.resource?.fileName || '',
            classResourcePinnedAt: new Date().toISOString(),
          },
        };
      });
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
      lessonId: activeLesson?.id || null,
      questionIds: relatedQuestions.map((question) => question.id),
      questionCount: relatedQuestions.length,
      sourceKind: selectedResource?.sourceKind || (selectedResource?.virtualLessonTextbook ? 'textbook' : selectedResource?.virtualLessonExams ? 'exams' : selectedResource?.type || ''),
      sourceFileName: selectedResource?.fileName || selectedResource?.sourceExamFileName || '',
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
    const preferredId = String(data.settings?.classLessonId || '');
    if (preferredId && lessons.some((lesson) => String(lesson.id) === preferredId)) {
      if (String(activeLessonId) !== preferredId) setActiveLessonId(preferredId);
      return;
    }
    if (!activeLesson && lessons.length) {
      setActiveLessonId(lessons[0].id);
      return;
    }
    if (activeLesson && String(activeLessonId) !== String(activeLesson.id)) setActiveLessonId(activeLesson.id);
  }, [activeLesson, activeLessonId, data.settings?.classLessonId, lessons]);

  useEffect(() => {
    const preferredResourceId = String(data.settings?.classResourceId || '');
    if (!preferredResourceId || !resources.some((item) => String(item.id) === preferredResourceId)) return;
    if (appliedPreferredResourceRef.current === preferredResourceId) return;
    appliedPreferredResourceRef.current = preferredResourceId;
    const preferred = resources.find((item) => String(item.id) === preferredResourceId);
    if (String(selectedResourceId) !== preferredResourceId) setSelectedResourceId(preferredResourceId);
    if (!['board', 'maps', 'games'].includes(contentMode)) setContentMode(resourceContentMode(preferred));
  }, [data.settings?.classResourceId, resources, selectedResourceId, contentMode]);

  useEffect(() => {
    if (!resources.length) return;
    if (!selectedResource || !resources.some((item) => String(item.id) === String(selectedResourceId))) {
      setSelectedResourceId(resources[0].id);
      if (!['board', 'maps', 'games'].includes(contentMode)) setContentMode(resourceContentMode(resources[0]));
    }
  }, [resources, selectedResource, selectedResourceId, contentMode]);

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
    (Array.isArray(data.attendance) ? data.attendance : [])
      .filter((item) => item.date === today && item.sessionId === current?.id)
      .map((item) => [item.studentId, item.status])
  ), [data.attendance, today, current?.id]);

  const counts = useMemo(() => Object.values(attendanceMap).reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}), [attendanceMap]);

  const mark = (student, status) => {
    const session = current;
    updateData((latest) => {
      const existing = (latest.attendance || []).find((item) => item.studentId === student.id && item.date === today && item.sessionId === session?.id);
      const attendance = existing
        ? (latest.attendance || []).map((item) => (item.id === existing.id ? { ...item, status } : item))
        : [...(latest.attendance || []), { id: Date.now() + Math.random(), studentId: student.id, sessionId: session?.id || null, date: today, status }];
      const next = { ...latest, attendance };
      return status === 'absent' ? queueAbsenceNotification(next, student, session, today) : next;
    });
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

  const savedPhrases = data.settings?.encouragementPhrases || [];
  const phrases = savedPhrases.length ? savedPhrases : defaultEncouragementPhrases;
  const correctivePhrases = data.settings?.correctivePhrases?.length ? data.settings.correctivePhrases : defaultCorrectivePhrases;
  const [newPhraseText, setNewPhraseText] = useState('');
  const [newCorrectivePhraseText, setNewCorrectivePhraseText] = useState('');

  const sayPhrase = async (phrase, tone = 'excited') => {
    const text = selectedStudent
      ? `${String(phrase).replace(/[.!،,]+$/u, '')} يا ${selectedStudent.name}.`
      : phrase;
    setLastPraise(text);
    setPhraseMenu('');
    const spoken = await speakArabic(text, data.settings, tone);
    if (!spoken) {
      setShareNotice('الصوت العربي غير جاهز على الجهاز. افتح إعدادات تحويل النص إلى كلام وثبّت صوتًا عربيًا.');
    }
  };

  const savePhrase = async (kind, rawText) => {
    const text = String(rawText || '').trim();
    if (!text) return;
    const key = kind === 'corrective' ? 'correctivePhrases' : 'encouragementPhrases';
    const currentPhrases = kind === 'corrective' ? correctivePhrases : phrases;
    const next = [...new Set([...currentPhrases, text])];
    await updateData((latest) => ({ ...latest, settings: { ...latest.settings, [key]: next } }));
    if (kind === 'corrective') setNewCorrectivePhraseText('');
    else setNewPhraseText('');
  };

  const addEncouragementPhrase = async () => savePhrase('positive', newPhraseText);

  const removeEncouragementPhrase = async (index) => {
    await updateData({ ...data, settings: { ...data.settings, encouragementPhrases: phrases.filter((_, i) => i !== index) } });
  };

  const adjustPoints = (student, delta) => {
    if (!student?.id || !Number.isFinite(Number(delta))) return;
    const change = Number(delta);
    setPoints((previous) => ({
      ...previous,
      [student.id]: Math.max(0, Number(previous[student.id] || 0) + change),
    }));
    void updateData((latest) => ({
      ...latest,
      students: (latest.students || []).map((item) => String(item.id) === String(student.id)
        ? { ...item, points: Math.max(0, Number(item.points || 0) + change), updatedAt: new Date().toISOString() }
        : item),
    }));
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
    nativePath = '',
    name = '',
    type = '',
    durationSeconds = 0,
  } = {}) => {
    if (recordingFinalizedRef.current) return null;
    recordingFinalizedRef.current = true;
    let asset = null;
    try {
      if (blob?.size) {
        asset = await importAssetBlob(blob, {
          name: name || `تسجيل-${current?.title || 'الحصة'}-${today}-${Date.now()}`,
          type: type || blob.type || 'video/webm',
          kind: 'lesson-recording',
        });
      }
      const saved = await recordLesson({
        copyLink: false,
        screenRecording: {
          ...(asset || {}),
          name: asset?.name || name,
          type: asset?.type || type,
          size: asset?.size || blob?.size || 0,
          durationSeconds: Math.max(1, Number(durationSeconds || recordingSeconds || 1)),
          microphoneEnabled: recordingWithAudio,
          timeline: recordingTimelineRef.current,
        },
      });
      if (!saved) throw new Error('تعذر إضافة التسجيل إلى قائمة التسجيلات.');
      if (nativePath) await releaseNativeScreenRecording(nativePath).catch(() => null);
      return asset;
    } catch (error) {
      recordingFinalizedRef.current = false;
      if (asset?.id) await deleteAsset(asset.id).catch(() => null);
      throw error;
    }
  };

  const resetRecordingState = () => {
    setRecordingActive(false);
    setRecordingPaused(false);
    setRecordingBackend('');
    recordingBackendRef.current = '';
    mediaRecorderRef.current = null;
    if (recordingStopTimerRef.current) {
      clearTimeout(recordingStopTimerRef.current);
      recordingStopTimerRef.current = null;
    }
  };

  const stopActiveRecording = async () => {
    const backend = recordingBackendRef.current;
    if (backend === 'native') {
      setShareNotice('جارٍ إنهاء تسجيل Android وحفظ الفيديو داخل قائمة التسجيلات…');
      let captured = null;
      try {
        captured = await stopNativeScreenRecording();
        await saveCapturedRecording(captured);
        pendingNativeRecordingRef.current = null;
        setHasPendingNativeRecording(false);
        setShareNotice('تم حفظ فيديو الحصة داخل قائمة التسجيلات بالترتيب الزمني.');
      } catch (error) {
        if (captured?.nativePath) {
          pendingNativeRecordingRef.current = {
            nativePath: captured.nativePath,
            name: captured.name,
            type: captured.type,
            durationSeconds: captured.durationSeconds,
          };
          setHasPendingNativeRecording(true);
          setShareNotice(`${error?.message || 'تعذر إدخال الفيديو إلى مخزن المنصة.'} ملف Android محفوظ مؤقتًا؛ اضغط «إعادة حفظ الفيديو».`);
        } else {
          await saveCapturedRecording({ durationSeconds: recordingSeconds }).catch(() => null);
          setShareNotice(error?.message || 'تعذر إخراج ملف فيديو من Android؛ تم حفظ سجل الحصة الزمني فقط.');
        }
      } finally {
        resetRecordingState();
        cleanupRecordingResources();
      }
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (backend === 'web' && recorder && recorder.state !== 'inactive') {
      setShareNotice('جارٍ إنهاء تسجيل الشاشة وإضافته إلى قائمة التسجيلات…');
      await new Promise((resolve) => {
        recordingStopResolverRef.current = () => {
          if (recordingStopTimerRef.current) clearTimeout(recordingStopTimerRef.current);
          recordingStopTimerRef.current = null;
          resolve();
        };
        recordingStopTimerRef.current = setTimeout(resolve, 12000);
        try {
          if (recorder.state === 'paused') recorder.resume();
          recorder.requestData?.();
          recorder.stop();
        } catch {
          resolve();
        }
      });
      if (!recordingFinalizedRef.current) {
        try {
          await saveCapturedRecording({ durationSeconds: recordingSeconds });
          setShareNotice('تم حفظ سجل الحصة في قائمة التسجيلات؛ لم يكتمل ملف الفيديو من المتصفح.');
        } finally {
          resetRecordingState();
          cleanupRecordingResources();
        }
      }
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

  const retryPendingNativeRecording = async () => {
    const pending = pendingNativeRecordingRef.current;
    if (!pending || recordingBusy) return;
    setRecordingBusy(true);
    setShareNotice('جارٍ إعادة قراءة ملف Android المؤقت وحفظه داخل قائمة التسجيلات…');
    try {
      const captured = await readNativeScreenRecording(pending);
      recordingFinalizedRef.current = false;
      await saveCapturedRecording(captured);
      pendingNativeRecordingRef.current = null;
      setHasPendingNativeRecording(false);
      setShareNotice('تمت إعادة حفظ فيديو الحصة وربطه بالصف والدرس والطلاب.');
    } catch (error) {
      setShareNotice(`${error?.message || 'تعذرت إعادة حفظ الفيديو.'} لم يُحذف ملف Android المؤقت ويمكن المحاولة مرة أخرى.`);
    } finally {
      setRecordingBusy(false);
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
    if (recordingBusy) return;
    setRecordingBusy(true);
    try {
      if (recordingActive || recordingBackendRef.current) {
        await stopActiveRecording();
        return;
      }

      setRecordingSeconds(0);
      recordingFinalizedRef.current = false;
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
            withAudio: recordingWithAudio,
          });
          recordingBackendRef.current = 'native';
          setRecordingBackend('native');
          setRecordingActive(true);
          setRecordingPaused(false);
          setShareNotice(recordingWithAudio
            ? 'بدأ تسجيل شاشة تطبيق Android وصوت المعلم. اضغط مرة أخرى للإيقاف والحفظ.'
            : 'بدأ تسجيل شاشة تطبيق Android بدون ميكروفون. اضغط مرة أخرى للإيقاف والحفظ.');
          return;
        } catch (error) {
          setShareNotice(error?.message || 'تعذر بدء تسجيل Android؛ سيتم استخدام التسجيل البديل.');
        }
      }

      if (navigator.mediaDevices?.getDisplayMedia && globalThis.MediaRecorder) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 15, max: 18 },
            },
            audio: true,
          });
          let microphoneStream = null;
          if (recordingWithAudio) {
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
          const recorderOptions = {
            videoBitsPerSecond: 320_000,
            audioBitsPerSecond: 64_000,
            ...(mimeType ? { mimeType } : {}),
          };
          const recorder = new MediaRecorder(combinedStream, recorderOptions);
          recordingChunksRef.current = [];
          recorder.ondataavailable = (event) => {
            if (event.data?.size) recordingChunksRef.current.push(event.data);
          };
          recorder.onpause = () => setRecordingPaused(true);
          recorder.onresume = () => setRecordingPaused(false);
          recorder.onerror = () => setShareNotice('حدث خطأ أثناء تسجيل الشاشة؛ سيتم حفظ سجل الحصة المتاح.');
          recorder.onstop = async () => {
            const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
            if (recordingFinalizedRef.current) {
              recordingChunksRef.current = [];
              cleanupRecordingResources();
              resetRecordingState();
              recordingStopResolverRef.current?.();
              recordingStopResolverRef.current = null;
              return;
            }
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
          setShareNotice(recordingWithAudio ? 'بدأ تسجيل شاشة الحصة وصوت المعلم.' : 'بدأ تسجيل شاشة الحصة بدون ميكروفون.');
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
    } finally {
      setRecordingBusy(false);
    }
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

  const activateBoardTool = (nextTool) => {
    setTool(nextTool);
    if (TEXT_TOOL_STYLES[nextTool]) setTextStyle(TEXT_TOOL_STYLES[nextTool]);
    else if (nextTool !== 'select' && nextTool !== 'move') setTextStyle('plain');
    if (!['select', 'move'].includes(nextTool)) setSelectedBoardActionId(null);
  };

  const activateStyledText = (style) => {
    setTextStyle(style);
    setTool(TEXT_STYLE_TO_TOOL[style] || 'normal-text');
    setSelectedBoardActionId(null);
  };

  const handleBoardAction = (action) => {
    const next = { ...action, id: Date.now() + Math.random() };
    setBoardActions((currentActions) => [...currentActions, next]);
    setSelectedBoardActionId(next.id);
    setRedoStack([]);
    if (action.kind === 'stroke') setTool(action.tool || 'pen');
    if (action.kind === 'text' && action.textStyle && action.textStyle !== 'plain') {
      setTextStyle('plain');
      setBoardText('');
      setTool('select');
      setShareNotice('تمت إضافة البطاقة، وعادت السبورة إلى أداة التحديد. اختر «كتابة عادية» لكتابة نص جديد.');
    }
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
    <ClassModeViewport className={`page classmode-scene classmode-final-layout ${fullscreen ? 'fullscreen' : ''} ${stageFocus ? 'stage-focus-mode' : ''}`} sceneRef={sceneRef}>
      <ClassModeViewport.Header>
        <div className="classmode-top-header">
        <div className="classmode-header-brand">
          <img src={identity.logo || identity.icon} alt={identity.schoolName} />
          <div>
            <strong>{identity.schoolName}</strong>
            <small>{identity.teacherName} — {identity.teacherTitle}</small>
          </div>
        </div>
        <div className="classmode-header-tabs">
          <button type="button" className={contentMode === 'pdf' ? 'active' : ''} onClick={() => switchContentMode('pdf')} title="كتاب الشرح PDF"><FileText size={22} /><span>PDF</span></button>
          <button type="button" className={contentMode === 'board' ? 'active' : ''} onClick={() => switchContentMode('board')} title="السبورة"><PenTool size={22} /><span>السبورة</span></button>
          <button type="button" className={contentMode === 'maps' ? 'active' : ''} onClick={() => switchContentMode('maps')} title="الخرائط"><MapIcon size={22} /><span>الخرائط</span></button>
          <button type="button" className={contentMode === 'images' ? 'active' : ''} onClick={() => switchContentMode('images')} title="الصور"><FileImage size={22} /><span>الصور</span></button>
          <button type="button" className={contentMode === 'videos' ? 'active' : ''} onClick={() => switchContentMode('videos')} title="الفيديوهات"><Video size={22} /><span>الفيديو</span></button>
          <button type="button" className={contentMode === 'audio' ? 'active' : ''} onClick={() => switchContentMode('audio')} title="الصوتيات"><Volume2 size={22} /><span>الصوت</span></button>
          <button type="button" className={contentMode === 'slides' ? 'active' : ''} onClick={() => switchContentMode('slides')} title="PowerPoint"><Presentation size={22} /><span>PowerPoint</span></button>
          <button type="button" className={contentMode === 'games' ? 'active' : ''} onClick={() => switchContentMode('games')} title="ألعاب الدرس داخل الحصة"><Gamepad2 size={22} /><span>الألعاب</span></button>
        </div>
        <div className="classmode-header-meta">
          <div className="header-meta-item"><Clock size={18} /><div><b>{clockTime}</b><small>{formatDateAr(today)}</small></div></div>
          <div className="header-meta-item"><div><b>{selectedResource?.unit || current.title}</b><small>{selectedResource?.lesson || current.group}</small></div></div>
          <div className="header-meta-item book-icon"><BookOpen size={20} /></div>
        </div>
        </div>
      </ClassModeViewport.Header>
      <ClassModeViewport.Body>
        <ClassModeViewport.Stage>
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
              <button className="secondary-btn" onClick={() => setLiveStartRequest((value) => value + 1)} type="button">الحصة الأونلاين</button>
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
              <button className="secondary-btn" onClick={() => setLiveStartRequest((value) => value + 1)} type="button"><ScanLine size={16} /> رابط مباشر</button>
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
                      onClick={() => { setSelectedResourceId(item.id); setContentMode(resourceContentMode(item)); setFlowIndex(0); }}
                    >
                      <span className="pin-order">{index + 1}</span> {item.title}
                    </button>
                  ))}
                </div>
                <button type="button" className="icon-action" onClick={() => goToQueueStep(1)} disabled={sessionQueue.length < 2}><ArrowLeftRight size={16} /></button>
              </div>
            </div>
          )}

          <div className="classmode-board-frame">
            {boardToolsAvailable && (
              <button
                type="button"
                className={`classmode-board-tools-toggle ${boardControlsOpen ? 'active' : ''}`}
                onClick={() => setBoardControlsOpen((value) => !value)}
                aria-expanded={boardControlsOpen}
                title={boardControlsOpen ? 'إخفاء أدوات السبورة' : 'فتح أدوات السبورة'}
              >
                <LayoutGrid size={17} /><span>{boardControlsOpen ? 'إخفاء الأدوات' : 'أدوات السبورة'}</span>
              </button>
            )}
            {contentMode === 'board' && (
              <button
                type="button"
                className={`classmode-board-focus-toggle ${stageFocus ? 'active' : ''}`}
                onClick={() => setStageFocus((value) => !value)}
                title={stageFocus ? 'العودة لوضع الحصة' : 'ملء الشاشة بالسبورة'}
              >
                <Maximize2 size={17} /><span>{stageFocus ? 'عودة للحصة' : 'ملء السبورة'}</span>
              </button>
            )}
            <div className={`classmode-board-surface ${boardToolsVisible ? 'with-tools' : ''}`}>
              {boardToolsVisible && <div className="classmode-board-sidebar-left">
                {toolOptions.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" className={tool === key ? 'active' : ''} onClick={() => activateBoardTool(key)} title={label}><Icon size={19} /><span>{label}</span></button>
                ))}
                <div className="classmode-left-toolbar-divider" />
                <button type="button" onClick={() => contentMode === 'board' ? setZoom((value) => Math.min(2, value + 0.15)) : setMediaZoom((value) => Math.min(2.5, Number((value + 0.15).toFixed(2))))} title="تكبير"><ZoomIn size={19} /><span>تكبير</span></button>
                <button type="button" onClick={() => contentMode === 'board' ? setZoom((value) => Math.max(1, value - 0.15)) : setMediaZoom((value) => Math.max(1, Number((value - 0.15).toFixed(2))))} title="تصغير"><ZoomOut size={19} /><span>تصغير</span></button>
                <button type="button" onClick={undoBoard} title="تراجع"><Undo2 size={19} /><span>تراجع</span></button>
                <button type="button" onClick={redoBoard} title="إعادة"><Redo2 size={19} /><span>إعادة</span></button>
                <button type="button" onClick={saveBoard} title="حفظ"><Save size={19} /><span>حفظ</span></button>
              </div>}

              <div className={`classmode-board-stage ${contentMode === 'board' ? 'has-lesson-ribbon' : ''}`}>
                {contentMode === 'board' && <BoardLessonRibbon grade={currentGrade} lesson={activeLesson?.title || selectedResource?.lesson || current.title} />}
                {contentMode === 'games' ? (
                  <div className="classmode-games-stage">
                    <ClassroomGamePanel
                      questions={relatedQuestions}
                      students={students}
                      history={data.gameQuestionHistory || []}
                      selectedStudentId={selectedStudent?.id || ''}
                      onSelectStudent={(studentId) => setSelectedStudent(students.find((student) => String(student.id) === String(studentId)) || null)}
                      onAwardPoint={adjustPoints}
                      onQuestionUsed={rememberGameQuestion}
                      onCreateOnlineChallenge={() => setOnlineGameStartRequest((value) => value + 1)}
                    />
                    <OnlineGameHostPanel
                      cloudSync={data.settings?.cloudSync}
                      title={`تحدي ${activeLesson?.title || current.title}`}
                      grade={currentGrade}
                      unit={activeLesson?.unit || selectedResource?.unit || ''}
                      lessonId={activeLesson?.id || ''}
                      sourceKind={selectedResource?.sourceKind || selectedResource?.type || ''}
                      sourceFileName={selectedResource?.fileName || ''}
                      questions={onlineGameQuestions}
                      startRequest={onlineGameStartRequest}
                      onNotice={setChallengeNotice}
                      onQuestionsUsed={rememberGameQuestions}
                      onOpenSettings={() => setShareNotice('اضبط رابط الحصة من لوحة الحصة الأونلاين داخل نفس الشاشة.')}
                      onFinish={(result) => updateData((latest) => ({ ...latest, gameResults: [result, ...(latest.gameResults || [])].slice(0, 300) }))}
                    />
                  </div>
                ) : contentMode === 'maps' ? (
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
                  <div className="classmode-resource-preview" style={{ '--board-zoom': mediaZoom }}>
                    <div className="resource-preview-head">
                      <strong>{displayResource.title}</strong>
                      <small>{displayResource.fileName || displayResource.mimeType || displayResource.type}</small>
                      {modeResources.length > 1 && (
                        <div className="classmode-inline-media-switcher" role="group" aria-label="التبديل بين ملفات النوع الحالي">
                          <button type="button" onClick={() => cycleModeResource(-1)} title="الملف السابق">‹</button>
                          <select value={displayResource.id} onChange={(event) => { setSelectedResourceId(event.target.value); setFlowIndex(0); }} aria-label="اختيار ملف الدرس">
                            {modeResources.map((resource, index) => <option key={resource.id} value={resource.id}>{index + 1}. {resource.title || resource.fileName || 'ملف'}</option>)}
                          </select>
                          <span>{displayResourceIndex + 1}/{modeResources.length}</span>
                          <button type="button" onClick={() => cycleModeResource(1)} title="الملف التالي">›</button>
                        </div>
                      )}
                      {(displayResource.type === 'pdf' || displayResource.type === 'textbook') && (
                        <div className="classmode-page-nav">
                          <button type="button" onClick={() => setClassPage((p) => clampLessonPage((p || 1) - 1, displayResource, renderedPdf.pageCount || Infinity))} disabled={(classPage || 1) <= Number(displayResource.pageStart || 1)} title="الصفحة السابقة">‹</button>
                          <span>صفحة {classPage || 1}{displayResource.pageEnd ? ` / ${displayResource.pageEnd}` : renderedPdf.pageCount ? ` / ${renderedPdf.pageCount}` : ''}</span>
                          <button type="button" onClick={() => setClassPage((p) => clampLessonPage((p || 1) + 1, displayResource, renderedPdf.pageCount || Infinity))} disabled={(classPage || 1) >= Number(displayResource.pageEnd || renderedPdf.pageCount || Infinity)} title="الصفحة التالية">›</button>
                          <span className="classmode-pdf-zoom-controls" role="group" aria-label="تكبير صفحة PDF">
                            <button type="button" onClick={() => setMediaZoom((value) => Math.max(1, Number((value - 0.15).toFixed(2))))} disabled={mediaZoom <= 1} title="تصغير صفحة PDF"><ZoomOut size={14}/></button>
                            <b>{Math.round(mediaZoom * 100)}%</b>
                            <button type="button" onClick={() => setMediaZoom((value) => Math.min(2.5, Number((value + 0.15).toFixed(2))))} disabled={mediaZoom >= 2.5} title="تكبير صفحة PDF"><ZoomIn size={14}/></button>
                            <button type="button" onClick={() => setMediaZoom(1)} disabled={Math.abs(mediaZoom - 1) < 0.01} title="إعادة التكبير إلى 100%"><RotateCcw size={14}/></button>
                          </span>
                          {displayResource.type === 'textbook' && selectedExamUrl && (
                            <a href={selectedExamUrl} target="_blank" rel="noopener noreferrer" className="classmode-exam-link" title="فتح ملف الامتحانات"><FileText size={14} /> الامتحانات</a>
                          )}
                        </div>
                      )}
                    </div>
                    <MediaRenderer
                      resource={displayResource}
                      source={displayResourceSource}
                      pdfPage={renderedPdf}
                      page={classPage || 1}
                      annotations={resourceAnnotations}
                      onOpenExternal={openSelectedDocument}
                      onPdfStateChange={setWebPdfState}
                    />
                  </div>
                )}

                {contentMode !== 'board' && !displayResource && contentMode !== 'maps' && (
                  <div className="classmode-empty-resource">
                    <File size={46} />
                    <h3>لا يوجد محتوى من هذا النوع في مكتبة المنصة</h3>
                    <p>أضف {contentMode === 'videos' ? 'فيديو' : contentMode === 'images' ? 'صورة' : contentMode === 'audio' ? 'ملفًا صوتيًا' : contentMode === 'slides' ? 'عرض PowerPoint' : contentMode === 'files' ? 'ملفًا' : 'ملف PDF'} داخل الدرس في المكتبة ليظهر هنا تلقائيًا.</p>
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
                  zoom={contentMode === 'board' ? zoom : mediaZoom}
                  boardRef={boardRef}

                  tool={canvasTool}
                  selectedColor={annotationColor}
                  strokeWidth={strokeWidth}
                  shapeKind={shapeKind}
                  historicalSymbol={historicalSymbol}
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
              <select className="classmode-font-select" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} title="نوع الخط العربي">
                <option value="Tahoma, Arial, sans-serif">واضح — شرح يومي</option>
                <option value="'Noto Naskh Arabic', 'Traditional Arabic', serif">نسخ — نصوص ودروس</option>
                <option value="'Aref Ruqaa', 'Arabic Typesetting', serif">رقعة — عناوين سريعة</option>
                <option value="'Noto Kufi Arabic', 'Droid Arabic Kufi', sans-serif">كوفي — عناوين قوية</option>
                <option value="Georgia, 'Times New Roman', serif">تراثي — تاريخ وحضارات</option>
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
              <button className={textStyle === 'plain' && tool === 'normal-text' ? 'active' : ''} onClick={() => activateStyledText('plain')} type="button"><Type size={15} /> كتابة عادية</button>
              <button className={textStyle === 'historical' ? 'active' : ''} onClick={() => activateStyledText('historical')} type="button"><BookOpen size={15} /> مصطلح تاريخي</button>
              <button className={textStyle === 'geography' ? 'active' : ''} onClick={() => activateStyledText('geography')} type="button"><MapIcon size={15} /> مصطلح جغرافي</button>
              <button className={textStyle === 'event' ? 'active' : ''} onClick={() => activateStyledText('event')} type="button"><Clock size={15} /> حدث مهم</button>
              <button className={textStyle === 'date' ? 'active' : ''} onClick={() => activateStyledText('date')} type="button"><CircleDot size={15} /> تاريخ</button>
              <button className={textStyle === 'person' ? 'active' : ''} onClick={() => activateStyledText('person')} type="button"><Users size={15} /> شخصية</button>
              <button className={textStyle === 'place' ? 'active' : ''} onClick={() => activateStyledText('place')} type="button"><MapIcon size={15} /> مكان</button>
              <button className={textStyle === 'definition' ? 'active' : ''} onClick={() => activateStyledText('definition')} type="button"><BookOpen size={15} /> تعريف</button>
              <button className={textStyle === 'note' ? 'active' : ''} onClick={() => activateStyledText('note')} type="button"><StickyNote size={15} /> ملاحظة</button>
            </div>
            <div className="classmode-tool-group compact classmode-historical-symbol-row" aria-label="رموز تاريخية مجسمة">
              {historicalSymbolOptions.map((item) => (
                <button key={item.key} className={tool === 'historical-symbol' && historicalSymbol === item.key ? 'active' : ''} onClick={() => { setHistoricalSymbol(item.key); activateBoardTool('historical-symbol'); }} type="button"><Sparkles size={14}/>{item.label}</button>
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
              <button onClick={deleteSelectedBoardAction} disabled={!selectedBoardActionId} type="button"><Eraser size={17} /> حذف المحدد</button>
              <button onClick={clearBoard} type="button"><RotateCcw size={17} /> مسح الكل</button>
              <button onClick={persistCurrentBoardLayer} type="button"><Save size={17} /> حفظ طبقة الكتابة</button>
            </div>
          </div>}
          </section>
        </ClassModeViewport.Stage>

        <ClassModeViewport.Students>
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
                        : contentMode === 'audio'
                          ? 'الصوت'
                      : contentMode === 'maps'
                        ? 'الخرائط'
                        : contentMode === 'slides'
                          ? 'PowerPoint'
                          : contentMode === 'games'
                            ? 'ألعاب الدرس'
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
            onOpenSettings={() => navigate('settings')}
            onSaveCloudSync={async (cloudSync) => updateData({ ...data, settings: { ...data.settings, cloudSync } })}
            startRequest={liveStartRequest}
          />
          <article className="panel classmode-side-panel classmode-students-panel">
            <div className="panel-heading compact">
              <div><span className="eyebrow">الطلاب والنقاط</span><h3>الترتيب الحالي</h3></div>
              <Trophy size={20} />
            </div>
            <div className="classmode-students-list">
              {rankedStudents.map((student) => {
                const status = attendanceMap[student.id];
                const score = points[student.id] || 0;
                return (
                  <div key={student.id} className={`classmode-student-row ${selectedStudent?.id === student.id ? 'active' : ''}`}>
                    <button className="classmode-student-row-main" onClick={() => { setSelectedStudent(student); setPhraseMenu(''); }} type="button">
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
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="classmode-student-commandbar">
              <div className={`classmode-command-selected ${selectedStudent ? 'has-student' : ''}`}>
                <span>الطالب المحدد</span>
                <strong>{selectedStudent?.name || 'اضغط على اسم طالب أولًا'}</strong>
              </div>
              <div className="classmode-command-buttons">
                <button
                  type="button"
                  className={phraseMenu === 'positive' ? 'active positive' : 'positive'}
                  disabled={!selectedStudent}
                  onClick={() => setPhraseMenu((current) => current === 'positive' ? '' : 'positive')}
                  title="فتح مكتبة الجمل التشجيعية"
                >
                  <Sparkles size={18} /><span>تشجيع</span>
                </button>
                <button
                  type="button"
                  className={phraseMenu === 'corrective' ? 'active corrective' : 'corrective'}
                  disabled={!selectedStudent}
                  onClick={() => setPhraseMenu((current) => current === 'corrective' ? '' : 'corrective')}
                  title="فتح مكتبة الجمل التنبيهية"
                >
                  <MailCheck size={18} /><span>تنبيه</span>
                </button>
              </div>
              {phraseMenu && selectedStudent && (
                <div className={`classmode-command-popover ${phraseMenu}`}>
                  <header>
                    <div><small>{phraseMenu === 'positive' ? 'مكتبة التحفيز' : 'مكتبة التوجيه'}</small><strong>{phraseMenu === 'positive' ? 'اختر جملة تشجيعية' : 'اختر جملة تنبيهية'}</strong></div>
                    <button type="button" onClick={() => setPhraseMenu('')} title="إغلاق"><X size={15} /></button>
                  </header>
                  <div className="classmode-command-phrases">
                    {(phraseMenu === 'positive' ? phrases : correctivePhrases).map((phrase, index) => (
                      <button
                        type="button"
                        key={`${phraseMenu}-${phrase}-${index}`}
                        onClick={() => sayPhrase(phrase, phraseMenu === 'positive' ? 'excited' : 'calm')}
                      >
                        <Volume2 size={14} /><span>{phrase}</span>
                      </button>
                    ))}
                  </div>
                  <div className="classmode-command-add-phrase">
                    <input
                      value={phraseMenu === 'positive' ? newPhraseText : newCorrectivePhraseText}
                      onChange={(event) => phraseMenu === 'positive' ? setNewPhraseText(event.target.value) : setNewCorrectivePhraseText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        void savePhrase(phraseMenu, phraseMenu === 'positive' ? newPhraseText : newCorrectivePhraseText);
                      }}
                      placeholder={phraseMenu === 'positive' ? 'أضف جملة تشجيعية' : 'أضف جملة تنبيهية'}
                    />
                    <button type="button" onClick={() => void savePhrase(phraseMenu, phraseMenu === 'positive' ? newPhraseText : newCorrectivePhraseText)}><Plus size={14}/> إضافة</button>
                  </div>
                </div>
              )}
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
                <button key={resource.id} className={String(selectedResourceId) === String(resource.id) ? 'active' : ''} onClick={() => { setSelectedResourceId(resource.id); setContentMode(resourceContentMode(resource)); }} type="button">
                  {resource.type === 'image' ? <FileImage size={16} /> : resource.type === 'video' ? <Video size={16} /> : resource.type === 'map' ? <MapIcon size={16} /> : resource.type === 'audio' ? <Volume2 size={16} /> : <FileText size={16} />}
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
              {rankedStudents.map((student) => {
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
        </ClassModeViewport.Students>
      </ClassModeViewport.Body>

      <ClassModeViewport.Footer>
        <div className="classmode-bottom-actions" role="toolbar" aria-label="أوامر وضع الحصة">
        <button type="button" className="secondary-btn classmode-exit-btn" onClick={() => navigate('dashboard')} title="الخروج من وضع الحصة" aria-label="الخروج من وضع الحصة"><X size={17} /><span className="action-label">خروج</span></button>
        <div className="classmode-bottom-actions-mid">
          <button
            type="button"
            className={`secondary-btn classmode-mic-record-btn ${recordingWithAudio ? 'active' : ''}`}
            disabled={recordingActive || recordingBusy}
            onClick={() => setRecordingWithAudio((value) => !value)}
            title={recordingActive ? 'لا يمكن تغيير الميكروفون بعد بدء التسجيل' : recordingWithAudio ? 'الميكروفون مفعّل — اضغط لتعطيله قبل التسجيل' : 'الميكروفون متوقف — اضغط لتفعيله قبل التسجيل'}
            aria-label={recordingWithAudio ? 'تعطيل ميكروفون تسجيل الحصة' : 'تفعيل ميكروفون تسجيل الحصة'}
          >
            {recordingWithAudio ? <Mic size={17} /> : <MicOff size={17} />}
            <span className="action-label">{recordingWithAudio ? 'المايك يعمل' : 'المايك مغلق'}</span>
          </button>
          <button type="button" className={`secondary-btn classmode-record-btn ${recordingActive ? 'recording-active' : ''}`} disabled={recordingBusy} onClick={toggleClassRecording} title={recordingActive ? 'إيقاف التسجيل وحفظه' : 'بدء تسجيل الحصة'} aria-label={recordingActive ? 'إيقاف التسجيل وحفظه' : 'بدء تسجيل الحصة'}><CircleDot size={17} /><span className="action-label">{recordingBusy ? 'جارٍ التشغيل…' : recordingActive ? `إيقاف ${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}` : 'تسجيل الحصة'}</span></button>
          {recordingActive && recordingBackend && (
            <button type="button" className="secondary-btn classmode-pause-record-btn" onClick={toggleRecordingPause} title={recordingPaused ? 'استكمال التسجيل' : 'إيقاف التسجيل مؤقتًا'} aria-label={recordingPaused ? 'استكمال التسجيل' : 'إيقاف التسجيل مؤقتًا'}>{recordingPaused ? <CirclePlay size={17} /> : <CirclePause size={17} />}<span className="action-label">{recordingPaused ? 'استكمال' : 'إيقاف مؤقت'}</span></button>
          )}
          {hasPendingNativeRecording && (
            <button type="button" className="secondary-btn classmode-retry-record-btn" disabled={recordingBusy} onClick={retryPendingNativeRecording} title="إعادة حفظ ملف تسجيل Android المؤقت" aria-label="إعادة حفظ فيديو الحصة"><Save size={17} /><span className="action-label">إعادة حفظ الفيديو</span></button>
          )}
          <button type="button" className="secondary-btn" onClick={saveBoard} title="حفظ لقطة من السبورة" aria-label="حفظ لقطة من السبورة"><Camera size={17} /><span className="action-label">لقطة شاشة</span></button>
          <button type="button" className="secondary-btn" onClick={() => setView('students')} title="عرض الطلاب" aria-label="عرض الطلاب"><Users size={17} /><span className="action-label">الطلاب</span></button>
          <button type="button" className="secondary-btn classmode-live-shortcut" onClick={() => setLiveStartRequest(Date.now())} title="إنشاء أو نسخ رابط الحصة الأونلاين" aria-label="رابط الحصة الأونلاين"><Radio size={17} /><span className="action-label">الحصة أونلاين</span></button>
          <button type="button" className="secondary-btn" onClick={() => navigate('sessions')} title="قائمة تسجيلات الحصص" aria-label="قائمة تسجيلات الحصص"><Presentation size={17} /><span className="action-label">التسجيلات</span></button>
          <button type="button" className="secondary-btn" onClick={() => navigate('contentLibrary')} title="مكتبة المحتوى" aria-label="مكتبة المحتوى"><BookOpen size={17} /><span className="action-label">المكتبة</span></button>
          <button type="button" className="secondary-btn" onClick={() => navigate('settings')} title="إعدادات المنصة" aria-label="إعدادات المنصة"><LayoutGrid size={17} /><span className="action-label">الإعدادات</span></button>
        </div>
        <button type="button" className="danger-btn classmode-end-btn" onClick={endClass} title="إنهاء الحصة وحفظها" aria-label="إنهاء الحصة وحفظها"><span className="action-label">إنهاء الحصة</span></button>
        </div>
      </ClassModeViewport.Footer>
      <ClassModeViewport.Overlays>
        {(lastPraise || shareNotice) && (
          <div className={`spoken-banner ${lastPraise ? 'is-voice' : 'is-notice'}`} role="status" aria-live="polite">
            <span>{lastPraise ? `🔊 ${lastPraise}` : shareNotice}</span>
            <button type="button" onClick={() => { setLastPraise(''); setShareNotice(''); }} aria-label="إغلاق الرسالة"><X size={15} /></button>
          </div>
        )}
        {view === 'students' && students.length > 0 && (
          <div className="classmode-student-drawer-backdrop" role="presentation" onClick={() => setView('board')}>
            <aside className="classmode-student-drawer" role="dialog" aria-modal="true" aria-label="طلاب الحصة" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span className="eyebrow">طلاب الحصة ({students.length})</span><h3>الحضور والنقاط الفورية</h3></div>
              <button className="icon-action" type="button" onClick={() => setView('board')} title="إغلاق"><X size={18} /></button>
            </header>
            <div className="classmode-student-drawer-list">
              {rankedStudents.map((student) => {
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
      </ClassModeViewport.Overlays>
    </ClassModeViewport>
  );
}
