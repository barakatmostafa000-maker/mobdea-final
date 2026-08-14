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
import { COUNTRY_CARD_CATEGORIES, COUNTRY_CARD_MAP, DEFAULT_COUNTRY_CARD, countryCardsForCategory } from '../data/countryCards';
import { queueAbsenceNotification } from '../services/notifications';
import { deleteAsset, importAssetBlob, importLegacyDataUrl } from '../services/assetStore';
import { useAssetUrl } from '../hooks/useAssetUrl';
import { useAssetSource } from '../hooks/useAssetSource';
import { usePdfPage } from '../hooks/usePdfPage';
import { todayISO, formatDateAr } from '../utils/time';
import { recognizeHandwritingStrokes } from '../services/handwritingRecognition';
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
  { key: 'shape', label: 'أشكال', icon: Shapes },
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
  { key: 'pyramid', label: 'هرم مجسم' },
  { key: 'column', label: 'عمود أثري' },
  { key: 'scroll', label: 'مخطوطة' },
  { key: 'obelisk', label: 'مسلة' },
  { key: 'crown', label: 'تاج ملكي' },
  { key: 'compass', label: 'بوصلة أثرية' },
  { key: 'sphinx', label: 'أبو الهول' },
  { key: 'temple', label: 'بوابة معبد' },
  { key: 'mobdea-seal', label: 'ختم المُبدع' },
];
const geographicalSymbolOptions = [
  { key: 'mountain', label: 'جبل مجسم' },
  { key: 'plateau', label: 'هضبة مجسمة' },
  { key: 'river', label: 'نهر' },
  { key: 'globe', label: 'كرة أرضية' },
  { key: 'compass-rose', label: 'وردة بوصلة' },
  { key: 'contours', label: 'خطوط كنتور' },
  { key: 'latlon', label: 'طول وعرض' },
  { key: 'map-sheet', label: 'خريطة مطوية' },
];
const boardFontOptions = [
  { value: "'Noto Naskh Arabic', 'Traditional Arabic', serif", probe: 'Noto Naskh Arabic', label: 'نسخ حقيقي — واضح وسلس' },
  { value: "'Aref Ruqaa', 'Arabic Typesetting', serif", probe: 'Aref Ruqaa', label: 'رقعة حقيقي — كتابة سريعة' },
  { value: "'Amiri', 'Traditional Arabic', serif", probe: 'Amiri', label: 'أميري — تاريخي أنيق' },
  { value: "'Noto Kufi Arabic', Tahoma, sans-serif", probe: 'Noto Kufi Arabic', label: 'كوفي حقيقي — عناوين قوية' },
  { value: "'Reem Kufi', 'Noto Kufi Arabic', sans-serif", probe: 'Reem Kufi', label: 'ريم كوفي — عرض مميز' },
];

const BOARD_CANVAS_WIDTH = 1536;
const BOARD_CANVAS_HEIGHT = 1024;
const BOARD_TEXT_PRESETS = Object.freeze([
  { key: 'main', label: 'رئيسي', size: 60, weight: 900, lineHeight: 1.22 },
  { key: 'heading', label: 'عنوان', size: 44, weight: 800, lineHeight: 1.28 },
  { key: 'explanation', label: 'شرح', size: 31, weight: 700, lineHeight: 1.4 },
  { key: 'note', label: 'ملاحظة', size: 23, weight: 700, lineHeight: 1.35 },
]);
const BOARD_TEXT_PRESET_MAP = Object.freeze(Object.fromEntries(BOARD_TEXT_PRESETS.map((item) => [item.key, item])));


const BOARD_CARD_TEMPLATES = Object.freeze([
  { key: 'geographical-term', label: 'مصطلح جغرافي', asset: '/whiteboard/cards/geographical-term.png', ratio: 1.5, fields: [
    { key: 'title', label: 'اسم المصطلح', placeholder: 'اسم المصطلح', x: 25, y: 7, w: 50, h: 13, tone: 'navy', size: 34 },
    { key: 'body', label: 'التعريف', placeholder: 'اكتب التعريف هنا…', x: 24, y: 43, w: 58, h: 30, tone: 'ink', size: 27 },
  ]},
  { key: 'historical-term', label: 'مصطلح تاريخي', asset: '/whiteboard/cards/historical-term.png', ratio: 1.5, fields: [
    { key: 'title', label: 'اسم المصطلح', placeholder: 'اسم المصطلح', x: 31, y: 16, w: 38, h: 11, tone: 'brown', size: 32 },
    { key: 'body', label: 'التعريف', placeholder: 'اكتب التعريف هنا…', x: 24, y: 46, w: 54, h: 29, tone: 'ink', size: 27 },
  ]},
  { key: 'event', label: 'حدث مهم', asset: '/whiteboard/cards/event.png', ratio: 0.667, fields: [
    { key: 'title', label: 'اسم الحدث', placeholder: 'اسم الحدث', x: 13, y: 18, w: 74, h: 13, tone: 'gold', size: 35 },
    { key: 'date', label: 'التاريخ', placeholder: 'التاريخ', x: 28, y: 32, w: 44, h: 8, tone: 'gold', size: 24 },
    { key: 'body', label: 'الوصف/النتيجة', placeholder: 'اكتب وصف الحدث ونتيجته…', x: 17, y: 51, w: 66, h: 28, tone: 'ink', size: 25 },
  ]},
  { key: 'date', label: 'تاريخ / سنة', asset: '/whiteboard/cards/date.png', ratio: 1.5, fields: [
    { key: 'date', label: 'التاريخ أو السنة', placeholder: 'التاريخ / السنة', x: 27, y: 25, w: 46, h: 18, tone: 'gold', size: 42 },
    { key: 'body', label: 'الحدث المرتبط', placeholder: 'الحدث المرتبط', x: 27, y: 69, w: 46, h: 11, tone: 'cream', size: 25 },
  ]},
  { key: 'place', label: 'مكان', asset: '/whiteboard/cards/place.png', ratio: 1.5, imageZone: { x: 9, y: 31, w: 34, h: 50, radius: 16 }, fields: [
    { key: 'title', label: 'اسم المكان', placeholder: 'اسم المكان', x: 34, y: 10, w: 35, h: 10, tone: 'cream', size: 31 },
    { key: 'subtitle', label: 'الوصف/الأهمية', placeholder: 'الوصف / الأهمية', x: 47, y: 30, w: 39, h: 9, tone: 'cream', size: 24 },
    { key: 'body', label: 'معلومات', placeholder: 'اكتب أهم المعلومات هنا…', x: 49, y: 43, w: 38, h: 36, tone: 'ink', size: 22 },
  ]},
  { key: 'timeline', label: 'تسلسل أحداث', asset: '/whiteboard/cards/timeline.png', ratio: 1.5, fields: [
    { key: 'title', label: 'العنوان', placeholder: 'العنوان', x: 37, y: 8, w: 26, h: 10, tone: 'brown', size: 30 },
    { key: 'one', label: 'الحدث الأول', placeholder: 'الحدث الأول', x: 10, y: 54, w: 18, h: 10, tone: 'brown', size: 20 },
    { key: 'two', label: 'الحدث الثاني', placeholder: 'الحدث الثاني', x: 31, y: 54, w: 18, h: 10, tone: 'brown', size: 20 },
    { key: 'three', label: 'الحدث الثالث', placeholder: 'الحدث الثالث', x: 52, y: 54, w: 18, h: 10, tone: 'brown', size: 20 },
    { key: 'four', label: 'الحدث الرابع', placeholder: 'الحدث الرابع', x: 73, y: 54, w: 18, h: 10, tone: 'brown', size: 20 },
  ]},
  { key: 'note', label: 'ملاحظة', asset: '/whiteboard/cards/note.png', ratio: 1.5, fields: [
    { key: 'body', label: 'نص الملاحظة', placeholder: 'نص الملاحظة', x: 18, y: 42, w: 64, h: 27, tone: 'ink', size: 31 },
  ]},
  { key: 'historical-witness', label: 'شاهد تاريخي', asset: '/whiteboard/cards/historical-witness.png', ratio: 1.5, imageZone: { x: 9, y: 27, w: 38, h: 57, radius: 8 }, fields: [
    { key: 'type', label: 'نوع الشاهد', placeholder: 'نوع الشاهد', x: 58, y: 31, w: 29, h: 9, tone: 'cream', size: 22 },
    { key: 'evidence', label: 'الدليل/التحليل', placeholder: 'اكتب الدليل أو التحليل…', x: 55, y: 61, w: 34, h: 20, tone: 'ink', size: 21 },
  ]},
  { key: 'person', label: 'شخصية', asset: '/whiteboard/cards/person.png', ratio: 1.5, imageZone: { x: 10, y: 24, w: 31, h: 53, radius: 50 }, fields: [
    { key: 'title', label: 'اسم الشخصية', placeholder: 'اسم الشخصية', x: 47, y: 11, w: 39, h: 13, tone: 'brown', size: 32 },
    { key: 'role', label: 'الدور/أهم المعلومات', placeholder: 'الدور / أهم المعلومات', x: 51, y: 36, w: 35, h: 9, tone: 'cream', size: 22 },
    { key: 'body', label: 'التفاصيل', placeholder: 'اكتب أهم المعلومات هنا…', x: 53, y: 53, w: 35, h: 28, tone: 'ink', size: 21 },
  ]},
  { key: 'cause-result', label: 'سبب ونتيجة', asset: '/whiteboard/cards/cause-result.png', ratio: 1.5, fields: [
    { key: 'cause', label: 'السبب', placeholder: 'اكتب السبب', x: 55, y: 35, w: 34, h: 24, tone: 'ink', size: 25 },
    { key: 'result', label: 'النتيجة', placeholder: 'اكتب النتيجة', x: 10, y: 35, w: 34, h: 24, tone: 'ink', size: 25 },
    { key: 'summary', label: 'التفسير المختصر', placeholder: 'التفسير المختصر', x: 19, y: 76, w: 62, h: 10, tone: 'ink', size: 21 },
  ]},
  { key: 'thinking-question', label: 'سؤال تفكير', asset: '/whiteboard/cards/thinking-question.png', ratio: 1.5, fields: [
    { key: 'question', label: 'السؤال', placeholder: 'اكتب السؤال هنا', x: 18, y: 42, w: 62, h: 28, tone: 'ink', size: 31 },
  ]},
  { key: 'comparison', label: 'مقارنة', asset: '/whiteboard/cards/comparison.png', ratio: 1.5, fields: [
    { key: 'title', label: 'وجه المقارنة', placeholder: 'وجه المقارنة', x: 35, y: 8, w: 30, h: 10, tone: 'cream', size: 27 },
    { key: 'first', label: 'العنصر الأول', placeholder: 'العنصر الأول', x: 64, y: 24, w: 26, h: 10, tone: 'brown', size: 25 },
    { key: 'second', label: 'العنصر الثاني', placeholder: 'العنصر الثاني', x: 10, y: 24, w: 26, h: 10, tone: 'cream', size: 25 },
    { key: 'firstBody', label: 'تفاصيل العنصر الأول', placeholder: '• ...\\n• ...\\n• ...', x: 61, y: 42, w: 31, h: 33, tone: 'ink', size: 21 },
    { key: 'secondBody', label: 'تفاصيل العنصر الثاني', placeholder: '• ...\\n• ...\\n• ...', x: 8, y: 42, w: 31, h: 33, tone: 'ink', size: 21 },
    { key: 'summary', label: 'أوجه الشبه/الاختلاف', placeholder: 'أوجه الشبه / الاختلاف', x: 30, y: 87, w: 40, h: 8, tone: 'brown', size: 20 },
  ]},
]);
const BOARD_CARD_TEMPLATE_MAP = Object.freeze(Object.fromEntries(BOARD_CARD_TEMPLATES.map((item) => [item.key, item])));

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
        <g transform="translate(430 632)" opacity=".38" filter="url(#historySoftShadow)">
          <rect x="0" y="0" width="340" height="48" rx="24" fill="#2a170b" stroke="url(#historyGold)" strokeWidth="2"/>
          <text x="170" y="21" textAnchor="middle" fill="#f6d77d" fontSize="17" fontWeight="800" fontFamily="Tahoma, Arial">{identity.teacherName}</text>
          <text x="170" y="39" textAnchor="middle" fill="#fff1c0" fontSize="11" fontWeight="600" fontFamily="Tahoma, Arial">{identity.teacherTitle}</text>
        </g>
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
  if (template === 'history') {
    try {
      const reference = await dataUrlToImage('/identity/class-board-history-v14.jpg');
      const ratio = Math.min(width / reference.width, height / reference.height);
      const drawWidth = reference.width * ratio;
      const drawHeight = reference.height * ratio;
      ctx.drawImage(reference, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      return;
    } catch {
      // Fall through to the vector parchment only if the supplied reference is unavailable.
    }
  }
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
    const lineHeight = Math.max(31, Number(stamp.fontSize || 22) * Number(stamp.lineHeight || 1.35));
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
    if (style !== 'plain') {
      const styleLabels = {
        historical: 'مصطلح تاريخي', geography: 'مصطلح جغرافي', event: 'حدث مهم', date: 'تاريخ',
        person: 'شخصية', place: 'مكان', definition: 'تعريف', note: 'ملاحظة',
      };
      ctx.save();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.globalAlpha = .92;
      ctx.direction = 'rtl'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '700 10px Tahoma, Arial, sans-serif';
      ctx.fillStyle = style === 'note' ? '#785516' : style === 'geography' ? '#2a6858' : '#b67a2c';
      ctx.fillText(styleLabels[style] || 'بطاقة تعليمية', -boxWidth + 18, boxHeight - 3);
      ctx.restore();
    }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = `${stamp.fontWeight || 700} ${stamp.fontSize || 22}px ${stamp.fontFamily || 'Tahoma, Arial, sans-serif'}`;
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
    const gold = ctx.createLinearGradient(16, 8, 152, 118);
    gold.addColorStop(0, '#fff4b5'); gold.addColorStop(.2, '#e9c45d'); gold.addColorStop(.48, '#9b621e'); gold.addColorStop(.72, '#f4d274'); gold.addColorStop(1, '#694015');
    const stone = ctx.createLinearGradient(18, 5, 145, 116);
    stone.addColorStop(0, '#fff0c3'); stone.addColorStop(.28, '#d7af78'); stone.addColorStop(.58, '#9a6a3d'); stone.addColorStop(1, '#4b2b19');
    const darkStone = ctx.createLinearGradient(30, 20, 145, 115);
    darkStone.addColorStop(0, '#9c6a3b'); darkStone.addColorStop(1, '#3c2113');
    const paper = ctx.createLinearGradient(10, 10, 150, 105);
    paper.addColorStop(0, '#fff1c7'); paper.addColorStop(.5, '#ddb979'); paper.addColorStop(1, '#9b622e');
    ctx.shadowColor = 'rgba(24,10,2,.58)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(25,10,3,.24)'; ctx.beginPath(); ctx.ellipse(83, 111, 69, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === 'pyramid') {
      ctx.fillStyle = stone; ctx.strokeStyle = '#6e431e';
      ctx.beginPath(); ctx.moveTo(16, 106); ctx.lineTo(82, 10); ctx.lineTo(92, 106); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = darkStone; ctx.beginPath(); ctx.moveTo(82,10); ctx.lineTo(151,106); ctx.lineTo(92,106); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha=.45; ctx.strokeStyle='#fff0ba'; ctx.lineWidth=1.5;
      for (let y=36;y<101;y+=15){ctx.beginPath();ctx.moveTo(31+y*.32,y);ctx.lineTo(132-y*.23,y);ctx.stroke();}
      ctx.restore();
      ctx.fillStyle='#f7d47a'; ctx.beginPath(); ctx.moveTo(77,18);ctx.lineTo(82,10);ctx.lineTo(87,18);ctx.closePath();ctx.fill();
    } else if (kind === 'column') {
      ctx.fillStyle=darkStone; ctx.strokeStyle='#65401f'; ctx.fillRect(51,30,61,72); ctx.strokeRect(51,30,61,72);
      ctx.fillStyle=stone; ctx.fillRect(47,29,49,72); ctx.strokeRect(47,29,49,72);
      ctx.fillStyle=gold; ctx.beginPath(); ctx.moveTo(35,18);ctx.lineTo(124,18);ctx.lineTo(116,34);ctx.lineTo(43,34);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath(); ctx.moveTo(31,101);ctx.lineTo(128,101);ctx.lineTo(140,114);ctx.lineTo(20,114);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.save();ctx.globalAlpha=.45;ctx.strokeStyle='#fff2c9';ctx.lineWidth=2;for(let x=57;x<92;x+=10){ctx.beginPath();ctx.moveTo(x,36);ctx.lineTo(x,95);ctx.stroke();}ctx.restore();
    } else if (kind === 'scroll') {
      ctx.fillStyle=paper;ctx.strokeStyle='#75461f';ctx.beginPath();if(typeof ctx.roundRect==='function')ctx.roundRect(25,22,116,82,12);else ctx.rect(25,22,116,82);ctx.fill();ctx.stroke();
      ctx.fillStyle=gold;ctx.beginPath();ctx.ellipse(25,63,12,45,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(141,63,12,45,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='rgba(78,43,16,.45)';ctx.lineWidth=2;for(let y=42;y<88;y+=12){ctx.beginPath();ctx.moveTo(44,y);ctx.lineTo(120,y);ctx.stroke();}
      const wax=ctx.createRadialGradient(83,91,2,83,91,15);wax.addColorStop(0,'#e66c52');wax.addColorStop(.55,'#a62d25');wax.addColorStop(1,'#551515');ctx.fillStyle=wax;ctx.beginPath();ctx.arc(83,91,14,0,Math.PI*2);ctx.fill();
    } else if (kind === 'obelisk') {
      ctx.fillStyle=stone;ctx.strokeStyle='#68401d';ctx.beginPath();ctx.moveTo(58,28);ctx.lineTo(80,5);ctx.lineTo(82,104);ctx.lineTo(50,104);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=darkStone;ctx.beginPath();ctx.moveTo(80,5);ctx.lineTo(105,28);ctx.lineTo(112,104);ctx.lineTo(82,104);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=gold;ctx.beginPath();ctx.moveTo(38,104);ctx.lineTo(124,104);ctx.lineTo(135,115);ctx.lineTo(27,115);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.save();ctx.globalAlpha=.38;ctx.strokeStyle='#f1d18c';ctx.lineWidth=2;ctx.strokeRect(61,45,12,18);ctx.strokeRect(59,69,15,17);ctx.restore();
    } else if (kind === 'crown') {
      ctx.fillStyle=gold;ctx.strokeStyle='#704311';ctx.beginPath();ctx.moveTo(20,45);ctx.lineTo(45,72);ctx.lineTo(62,31);ctx.lineTo(83,72);ctx.lineTo(108,27);ctx.lineTo(142,72);ctx.lineTo(132,104);ctx.lineTo(30,104);ctx.closePath();ctx.fill();ctx.stroke();
      [['#d44333',48],['#2877bd',78],['#3a9c6c',108],['#8c4dcc',128]].forEach(([c,x])=>{const g=ctx.createRadialGradient(x-2,78,1,x,80,9);g.addColorStop(0,'#fff');g.addColorStop(.2,c);g.addColorStop(1,'#381313');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,82,8,0,Math.PI*2);ctx.fill();});
      ctx.strokeStyle='rgba(255,246,185,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(38,94);ctx.lineTo(125,94);ctx.stroke();
    } else if (kind === 'sphinx') {
      ctx.fillStyle=darkStone;ctx.strokeStyle='#68401d';ctx.beginPath();ctx.ellipse(88,79,55,25,-.06,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle=stone;ctx.beginPath();ctx.ellipse(71,72,42,21,-.06,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillRect(34,83,80,18);ctx.strokeRect(34,83,80,18);
      ctx.fillStyle=stone;ctx.beginPath();ctx.arc(42,57,17,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle=gold;ctx.beginPath();ctx.moveTo(26,54);ctx.lineTo(42,38);ctx.lineTo(59,54);ctx.lineTo(53,66);ctx.lineTo(31,66);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#3b2114';ctx.beginPath();ctx.arc(37,56,2.4,0,Math.PI*2);ctx.arc(47,56,2.4,0,Math.PI*2);ctx.fill();
    } else if (kind === 'temple') {
      ctx.fillStyle=darkStone;ctx.strokeStyle='#5f391b';ctx.beginPath();ctx.moveTo(20,32);ctx.lineTo(146,32);ctx.lineTo(134,47);ctx.lineTo(31,47);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=stone;for(const x of [35,65,96,126]){ctx.fillRect(x,45,18,58);ctx.strokeRect(x,45,18,58);ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle='#ffe9bc';ctx.beginPath();ctx.moveTo(x+5,49);ctx.lineTo(x+5,98);ctx.stroke();ctx.restore();}
      ctx.fillStyle=gold;ctx.beginPath();ctx.moveTo(16,21);ctx.lineTo(150,21);ctx.lineTo(143,34);ctx.lineTo(23,34);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillRect(18,103,132,11);ctx.strokeRect(18,103,132,11);
    } else if (kind === 'mobdea-seal') {
      const seal=ctx.createRadialGradient(82,58,8,82,62,55);seal.addColorStop(0,'#241608');seal.addColorStop(.62,'#0b0d10');seal.addColorStop(.82,'#b67b1f');seal.addColorStop(1,'#422508');ctx.fillStyle=seal;ctx.strokeStyle='#f0cf72';ctx.lineWidth=5;ctx.beginPath();ctx.arc(82,62,52,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#9f6a1d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(82,62,41,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f5d47c';ctx.textAlign='center';ctx.font='900 22px Georgia, Tahoma, serif';ctx.fillText('المُبدع',82,56);ctx.font='700 11px Tahoma, Arial, sans-serif';ctx.fillText('مصطفى بركات',82,76);ctx.fillStyle='#fff0b4';ctx.beginPath();ctx.arc(82,88,3,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle='rgba(12,22,28,.96)';ctx.strokeStyle='#d7ad35';ctx.lineWidth=5;ctx.beginPath();ctx.arc(82,62,48,0,Math.PI*2);ctx.fill();ctx.stroke();
      const needle=ctx.createLinearGradient(70,18,94,105);needle.addColorStop(0,'#fff1aa');needle.addColorStop(.52,'#d5a234');needle.addColorStop(.53,'#9a2f27');needle.addColorStop(1,'#5d1717');ctx.fillStyle=needle;ctx.beginPath();ctx.moveTo(82,15);ctx.lineTo(92,62);ctx.lineTo(82,109);ctx.lineTo(72,62);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#f7d97c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(36,62);ctx.lineTo(128,62);ctx.moveTo(82,17);ctx.lineTo(82,107);ctx.stroke();ctx.fillStyle='#f7d97c';ctx.beginPath();ctx.arc(82,62,6,0,Math.PI*2);ctx.fill();
    }
  } else if (stamp.kind === 'geographical-symbol') {
    const kind = stamp.symbolKind || 'mountain';
    ctx.shadowColor='rgba(0,15,17,.55)';ctx.shadowBlur=18;ctx.shadowOffsetY=9;ctx.lineWidth=3;
    ctx.fillStyle='rgba(0,20,24,.25)';ctx.beginPath();ctx.ellipse(84,108,70,10,0,0,Math.PI*2);ctx.fill();
    if (kind === 'mountain') {
      const left=ctx.createLinearGradient(18,22,95,108);left.addColorStop(0,'#edf0d8');left.addColorStop(.22,'#7f9a66');left.addColorStop(1,'#31492d');
      const right=ctx.createLinearGradient(82,15,148,110);right.addColorStop(0,'#8fa16e');right.addColorStop(1,'#182b21');ctx.fillStyle=left;ctx.strokeStyle='#263d2a';ctx.beginPath();ctx.moveTo(13,105);ctx.lineTo(78,17);ctx.lineTo(95,105);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=right;ctx.beginPath();ctx.moveTo(78,17);ctx.lineTo(151,105);ctx.lineTo(95,105);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#f8f7ec';ctx.beginPath();ctx.moveTo(61,41);ctx.lineTo(78,17);ctx.lineTo(96,40);ctx.lineTo(88,36);ctx.lineTo(82,47);ctx.lineTo(74,36);ctx.lineTo(68,44);ctx.closePath();ctx.fill();
    } else if (kind === 'plateau') {
      const top=ctx.createLinearGradient(40,25,120,58);top.addColorStop(0,'#d8b477');top.addColorStop(1,'#8f6337');const side=ctx.createLinearGradient(35,50,130,110);side.addColorStop(0,'#9b6a3d');side.addColorStop(1,'#4b3020');ctx.fillStyle=top;ctx.strokeStyle='#5b3b23';ctx.beginPath();ctx.moveTo(30,38);ctx.lineTo(116,27);ctx.lineTo(144,48);ctx.lineTo(52,59);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(52,59);ctx.lineTo(144,48);ctx.lineTo(132,103);ctx.lineTo(44,105);ctx.closePath();ctx.fill();ctx.stroke();ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle='#f5d6a2';ctx.beginPath();ctx.moveTo(43,48);ctx.lineTo(117,39);ctx.stroke();ctx.restore();
    } else if (kind === 'river') {
      const water=ctx.createLinearGradient(20,15,145,110);water.addColorStop(0,'#b9f3ff');water.addColorStop(.28,'#2fb8df');water.addColorStop(.62,'#1a73b8');water.addColorStop(1,'#0b315e');ctx.strokeStyle=water;ctx.lineWidth=20;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(25,22);ctx.bezierCurveTo(145,35,23,73,143,105);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(27,22);ctx.bezierCurveTo(145,35,23,73,143,105);ctx.stroke();
    } else if (kind === 'globe') {
      const sphere=ctx.createRadialGradient(63,42,4,80,62,52);sphere.addColorStop(0,'#bcecf2');sphere.addColorStop(.36,'#3e9eb7');sphere.addColorStop(.72,'#1e657d');sphere.addColorStop(1,'#0a3144');ctx.fillStyle=sphere;ctx.strokeStyle='#c8e9d0';ctx.beginPath();ctx.arc(82,62,51,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.save();ctx.globalAlpha=.62;ctx.fillStyle='#79a969';ctx.beginPath();ctx.moveTo(57,35);ctx.lineTo(74,29);ctx.lineTo(83,41);ctx.lineTo(76,50);ctx.lineTo(60,49);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(94,59);ctx.lineTo(119,50);ctx.lineTo(127,68);ctx.lineTo(111,82);ctx.lineTo(99,78);ctx.closePath();ctx.fill();ctx.strokeStyle='#d8f4f3';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(82,62,28,51,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(31,62);ctx.lineTo(133,62);ctx.stroke();ctx.restore();
    } else if (kind === 'compass-rose') {
      ctx.fillStyle='#10202b';ctx.strokeStyle='#e6c463';ctx.lineWidth=4;ctx.beginPath();ctx.arc(82,62,50,0,Math.PI*2);ctx.fill();ctx.stroke();const rg=ctx.createLinearGradient(65,16,99,108);rg.addColorStop(0,'#fff1a4');rg.addColorStop(.48,'#d6a536');rg.addColorStop(.5,'#b93c30');rg.addColorStop(1,'#671e1b');ctx.fillStyle=rg;ctx.beginPath();ctx.moveTo(82,10);ctx.lineTo(93,52);ctx.lineTo(134,62);ctx.lineTo(93,72);ctx.lineTo(82,114);ctx.lineTo(71,72);ctx.lineTo(30,62);ctx.lineTo(71,52);ctx.closePath();ctx.fill();ctx.fillStyle='#f7df87';ctx.beginPath();ctx.arc(82,62,6,0,Math.PI*2);ctx.fill();
    } else if (kind === 'contours') {
      ctx.fillStyle='rgba(24,75,62,.12)';ctx.strokeStyle='#357965';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(82,62,64,45,-.12,0,Math.PI*2);ctx.fill();ctx.stroke();for(const [rx,ry,rot] of [[51,34,.08],[39,26,-.08],[28,18,.14],[16,10,-.1]]){ctx.beginPath();ctx.ellipse(82,62,rx,ry,rot,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#d7ad35';ctx.beginPath();ctx.arc(82,62,5,0,Math.PI*2);ctx.fill();
    } else if (kind === 'latlon') {
      const sphere=ctx.createRadialGradient(60,42,4,82,62,52);sphere.addColorStop(0,'#c9f2e8');sphere.addColorStop(.65,'#438b75');sphere.addColorStop(1,'#173e37');ctx.fillStyle=sphere;ctx.strokeStyle='#e7d27b';ctx.beginPath();ctx.arc(82,62,50,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(237,248,225,.75)';ctx.lineWidth=1.8;for(const ry of [17,34]){ctx.beginPath();ctx.ellipse(82,62,49,ry,0,0,Math.PI*2);ctx.stroke();}for(const rx of [18,34]){ctx.beginPath();ctx.ellipse(82,62,rx,49,0,0,Math.PI*2);ctx.stroke();}
    } else {
      const a=ctx.createLinearGradient(20,20,145,100);a.addColorStop(0,'#e7d49a');a.addColorStop(.45,'#b4c88a');a.addColorStop(1,'#68895d');ctx.fillStyle=a;ctx.strokeStyle='#476146';ctx.beginPath();ctx.moveTo(18,28);ctx.lineTo(61,20);ctx.lineTo(102,31);ctx.lineTo(146,19);ctx.lineTo(139,103);ctx.lineTo(99,109);ctx.lineTo(58,98);ctx.lineTo(18,108);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(61,20);ctx.lineTo(58,98);ctx.moveTo(102,31);ctx.lineTo(99,109);ctx.stroke();ctx.strokeStyle='#2a6b79';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(33,77);ctx.bezierCurveTo(62,45,80,91,129,48);ctx.stroke();
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
  if (action.kind === 'board-card' || action.kind === 'country-card') return { x: action.x || 0, y: action.y || 0, width: action.width || 620, height: action.height || 414 };
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
    return { x: action.x - width, y: action.y - 12, width, height: Math.max(62, lines.length * Math.max(31, fontSize * Number(action.lineHeight || 1.35)) + 22) };
  }
  return { x: action.x, y: action.y, width: 170, height: 115 };
}

function moveBoardAction(action, dx, dy) {
  if (action.kind === 'stroke') return { ...action, points: (action.points || []).map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) };
  return { ...action, x: action.x + dx, y: action.y + dy };
}

function recentHandwritingStrokes(actions = []) {
  const picked = [];
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    const isWritingStroke = action?.kind === 'stroke' && action?.tool === 'pen' && Array.isArray(action.points) && action.points.length > 1;
    if (isWritingStroke) {
      picked.unshift(action);
      if (picked.length >= 90) break;
      continue;
    }
    if (picked.length) break;
  }
  return picked;
}

function handwritingSnapshot(strokes = []) {
  const points = strokes.flatMap((stroke) => stroke.points || []);
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const padding = 34;
  const sourceWidth = Math.max(80, maxX - minX + padding * 2);
  const sourceHeight = Math.max(55, maxY - minY + padding * 2);
  const scale = Math.min(3.5, Math.max(2, 1100 / Math.max(sourceWidth, sourceHeight)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(300, Math.ceil(sourceWidth * scale));
  canvas.height = Math.max(180, Math.ceil(sourceHeight * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#050505';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    const strokePoints = stroke.points || [];
    if (strokePoints.length < 2) continue;
    ctx.lineWidth = Math.max(7, Number(stroke.width || 4) * scale * 1.45);
    ctx.beginPath();
    ctx.moveTo((strokePoints[0].x - minX + padding) * scale, (strokePoints[0].y - minY + padding) * scale);
    for (let index = 1; index < strokePoints.length - 1; index += 1) {
      const point = strokePoints[index];
      const next = strokePoints[index + 1];
      const x = (point.x - minX + padding) * scale;
      const y = (point.y - minY + padding) * scale;
      const midX = ((point.x + next.x) / 2 - minX + padding) * scale;
      const midY = ((point.y + next.y) / 2 - minY + padding) * scale;
      ctx.quadraticCurveTo(x, y, midX, midY);
    }
    const last = strokePoints[strokePoints.length - 1];
    ctx.lineTo((last.x - minX + padding) * scale, (last.y - minY + padding) * scale);
    ctx.stroke();
  }
  return {
    dataUrl: canvas.toDataURL('image/png'),
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
    ids: new Set(strokes.map((stroke) => stroke.id)),
  };
}

function drawBoardAction(ctx, action, selected = false) {
  if (action.kind === 'board-card' || action.kind === 'country-card') return;
  if (action.kind === 'stroke') {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = action.tool === 'highlighter' ? 0.3 : 1;
    ctx.globalCompositeOperation = action.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = action.tool === 'eraser' ? 'rgba(0,0,0,1)' : action.color || '#111827';
    ctx.lineWidth = action.tool === 'eraser' ? 22 : action.tool === 'highlighter' ? 16 : action.width || 4;
    const points = action.points || [];
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, Math.max(1.5, ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fillStyle = action.tool === 'eraser' ? '#000' : action.color || '#111827';
      ctx.fill();
    } else if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length - 1; index += 1) {
        const point = points[index];
        const next = points[index + 1];
        ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
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


function BoardCardOverlay({ action, selected, onSelect, onChange }) {
  const template = BOARD_CARD_TEMPLATE_MAP[action.templateKey];
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  if (!template) return null;
  const updateFields = () => {
    const next = { ...(action.fields || {}) };
    for (const field of template.fields) {
      const current = String(next[field.key] ?? '');
      const value = window.prompt(field.label, current);
      if (value === null) return;
      next[field.key] = value;
    }
    onChange({ ...action, fields: next });
  };
  const changeMedia = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...action, mediaDataUrl: String(reader.result || '') });
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  const onMoveStart = (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); onSelect(action.id);
    const point = event.touches?.[0] || event;
    dragRef.current = { x: point.clientX, y: point.clientY, startX: action.x, startY: action.y };
    const onMove = (moveEvent) => {
      if (!dragRef.current) return;
      const p = moveEvent.touches?.[0] || moveEvent;
      const host = event.currentTarget.parentElement?.getBoundingClientRect?.();
      if (!host?.width || !host?.height) return;
      const dx = ((p.clientX - dragRef.current.x) / host.width) * BOARD_CANVAS_WIDTH;
      const dy = ((p.clientY - dragRef.current.y) / host.height) * BOARD_CANVAS_HEIGHT;
      onChange({ ...action, x: Math.max(0, Math.min(BOARD_CANVAS_WIDTH - action.width, dragRef.current.startX + dx)), y: Math.max(0, Math.min(BOARD_CANVAS_HEIGHT - action.height, dragRef.current.startY + dy)) });
    };
    const onEnd = () => { dragRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onEnd); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onEnd, { once: true });
  };
  const onResizeStart = (event) => {
    event.preventDefault(); event.stopPropagation(); onSelect(action.id);
    const host = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect?.();
    const point = event.touches?.[0] || event;
    resizeRef.current = { x: point.clientX, width: action.width };
    const onMove = (moveEvent) => {
      const p = moveEvent.touches?.[0] || moveEvent;
      if (!resizeRef.current || !host?.width) return;
      const delta = ((p.clientX - resizeRef.current.x) / host.width) * BOARD_CANVAS_WIDTH;
      const width = Math.max(280, Math.min(1050, resizeRef.current.width + delta));
      onChange({ ...action, width, height: width / template.ratio });
    };
    const onEnd = () => { resizeRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onEnd); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onEnd, { once: true });
  };
  return (
    <div
      className={`board-card-overlay ${selected ? 'selected' : ''}`}
      style={{ left: `${(action.x / BOARD_CANVAS_WIDTH) * 100}%`, top: `${(action.y / BOARD_CANVAS_HEIGHT) * 100}%`, width: `${(action.width / BOARD_CANVAS_WIDTH) * 100}%`, aspectRatio: String(template.ratio) }}
      onPointerDown={onMoveStart}
      onDoubleClick={(event) => { event.stopPropagation(); updateFields(); }}
    >
      <img src={template.asset} alt={template.label} draggable="false" />
      {template.imageZone && action.mediaDataUrl && <img className="board-card-user-media" src={action.mediaDataUrl} alt="" draggable="false" style={{ left:`${template.imageZone.x}%`, top:`${template.imageZone.y}%`, width:`${template.imageZone.w}%`, height:`${template.imageZone.h}%`, borderRadius:`${template.imageZone.radius || 8}%` }} />}
      {template.fields.map((field) => {
        const value = String(action.fields?.[field.key] || '');
        if (!value) return null;
        return <div key={field.key} className={`board-card-field tone-${field.tone || 'ink'}`} style={{ left:`${field.x}%`, top:`${field.y}%`, width:`${field.w}%`, height:`${field.h}%`, fontSize:`clamp(10px, ${(field.size || 24) / BOARD_CANVAS_WIDTH * 100}vw, ${field.size || 24}px)` }}>{value.split('\\n').map((line, index) => <span key={index}>{line}</span>)}</div>;
      })}
      {selected && <div className="board-card-actions" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={updateFields}>تعديل النص</button>{template.imageZone && <label className="board-card-media-button">تغيير الصورة<input type="file" accept="image/*" hidden onChange={changeMedia}/></label>}<span className="board-card-resize-handle" onPointerDown={onResizeStart} title="تغيير الحجم">↘</span></div>}
    </div>
  );
}


async function drawBoardCardToCanvas(ctx, action) {
  const template = BOARD_CARD_TEMPLATE_MAP[action.templateKey];
  if (!template) return;
  const x = Number(action.x || 0); const y = Number(action.y || 0);
  const width = Number(action.width || 650); const height = Number(action.height || width / template.ratio);
  try {
    const frame = await dataUrlToImage(template.asset);
    ctx.drawImage(frame, x, y, width, height);
  } catch { return; }
  if (template.imageZone && action.mediaDataUrl) {
    try {
      const media = await dataUrlToImage(action.mediaDataUrl);
      const z = template.imageZone;
      const mx=x+width*z.x/100, my=y+height*z.y/100, mw=width*z.w/100, mh=height*z.h/100;
      const scale=Math.max(mw/media.width,mh/media.height); const dw=media.width*scale, dh=media.height*scale;
      ctx.save(); ctx.beginPath(); ctx.rect(mx,my,mw,mh); ctx.clip(); ctx.drawImage(media,mx+(mw-dw)/2,my+(mh-dh)/2,dw,dh); ctx.restore();
    } catch { /* optional media */ }
  }
  ctx.save(); ctx.direction='rtl'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for (const field of template.fields) {
    const value=String(action.fields?.[field.key] || '').trim(); if (!value) continue;
    const fx=x+width*(field.x+field.w/2)/100; const fy=y+height*(field.y+field.h/2)/100;
    const fw=width*field.w/100; const fh=height*field.h/100; const size=Math.max(12,(field.size||24)*(width/650));
    if (field.tone==='ink') { ctx.fillStyle='rgba(255,246,220,.82)'; ctx.fillRect(fx-fw/2,fy-fh/2,fw,fh); ctx.fillStyle='#2e1609'; }
    else if (field.tone==='brown') { ctx.fillStyle='rgba(115,61,14,.90)'; ctx.fillRect(fx-fw/2,fy-fh/2,fw,fh); ctx.fillStyle='#fff4c8'; }
    else if (field.tone==='navy') { ctx.fillStyle='rgba(31,48,72,.94)'; ctx.fillRect(fx-fw/2,fy-fh/2,fw,fh); ctx.fillStyle='#fff3b7'; }
    else if (field.tone==='gold') { ctx.fillStyle='rgba(39,26,18,.86)'; ctx.fillRect(fx-fw/2,fy-fh/2,fw,fh); ctx.fillStyle='#ffe68c'; }
    else { ctx.fillStyle='rgba(84,43,10,.88)'; ctx.fillRect(fx-fw/2,fy-fh/2,fw,fh); ctx.fillStyle='#fff4c8'; }
    ctx.font=`800 ${size}px 'Noto Naskh Arabic','Amiri','Traditional Arabic',serif`;
    const lines=value.split(/\\n/).slice(0,6); const lineHeight=size*1.22; const startY=fy-((lines.length-1)*lineHeight)/2;
    lines.forEach((line,index)=>ctx.fillText(line,fx,startY+index*lineHeight,fw-10));
  }
  ctx.restore();
}


const COUNTRY_CARD_STANDARD_FIELDS = Object.freeze([
  { key: 'info1', label: 'المعلومة الأولى', x: 45, y: 32.5, w: 32, h: 9 },
  { key: 'info2', label: 'المعلومة الثانية', x: 45, y: 43.0, w: 32, h: 9 },
  { key: 'info3', label: 'المعلومة الثالثة', x: 45, y: 53.5, w: 32, h: 9 },
  { key: 'info4', label: 'المعلومة الرابعة', x: 45, y: 64.0, w: 32, h: 9 },
]);
const COUNTRY_CARD_DEFAULT_FIELDS = Object.freeze([
  { key: 'title', label: 'اسم الدولة', x: 29, y: 28, w: 43, h: 10, title: true },
  { key: 'info1', label: 'المعلومة الأولى', x: 54, y: 47.5, w: 31, h: 8 },
  { key: 'info2', label: 'المعلومة الثانية', x: 54, y: 57.5, w: 31, h: 8 },
  { key: 'info3', label: 'المعلومة الثالثة', x: 54, y: 67.5, w: 31, h: 8 },
  { key: 'info4', label: 'المعلومة الرابعة', x: 54, y: 77.2, w: 31, h: 8 },
]);

function countryCardFields(card) {
  return card?.isDefault ? COUNTRY_CARD_DEFAULT_FIELDS : COUNTRY_CARD_STANDARD_FIELDS;
}

function countryCardFontSize(action, value, title = false) {
  const width = Number(action.width || 650);
  const base = title ? width * 0.052 : width * 0.036;
  const length = String(value || '').trim().length;
  const shrink = length > 42 ? 0.66 : length > 30 ? 0.76 : length > 20 ? 0.86 : 1;
  return Math.max(title ? 16 : 13, Math.min(title ? 38 : 27, base * shrink));
}

function CountryCardOverlay({ action, selected, onSelect, onChange }) {
  const card = COUNTRY_CARD_MAP[action.cardKey];
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  if (!card) return null;
  const fields = countryCardFields(card);
  const onMoveStart = (event) => {
    if (event.target?.closest?.('textarea,input,button,.country-card-resize-handle')) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); onSelect(action.id);
    const point = event.touches?.[0] || event;
    dragRef.current = { x: point.clientX, y: point.clientY, startX: action.x, startY: action.y };
    const host = event.currentTarget.parentElement?.getBoundingClientRect?.();
    const onMove = (moveEvent) => {
      if (!dragRef.current || !host?.width || !host?.height) return;
      const p = moveEvent.touches?.[0] || moveEvent;
      const dx = ((p.clientX - dragRef.current.x) / host.width) * BOARD_CANVAS_WIDTH;
      const dy = ((p.clientY - dragRef.current.y) / host.height) * BOARD_CANVAS_HEIGHT;
      onChange({
        ...action,
        x: Math.max(0, Math.min(BOARD_CANVAS_WIDTH - action.width, dragRef.current.startX + dx)),
        y: Math.max(0, Math.min(BOARD_CANVAS_HEIGHT - action.height, dragRef.current.startY + dy)),
      });
    };
    const onEnd = () => { dragRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onEnd); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onEnd, { once: true });
  };
  const onResizeStart = (event) => {
    event.preventDefault(); event.stopPropagation(); onSelect(action.id);
    const host = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect?.();
    resizeRef.current = { x: event.clientX, width: action.width };
    const onMove = (moveEvent) => {
      if (!resizeRef.current || !host?.width) return;
      const delta = ((moveEvent.clientX - resizeRef.current.x) / host.width) * BOARD_CANVAS_WIDTH;
      const width = Math.max(360, Math.min(1120, resizeRef.current.width + delta));
      onChange({ ...action, width, height: width * 0.75 });
    };
    const onEnd = () => { resizeRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onEnd); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onEnd, { once: true });
  };
  return (
    <div
      className={`board-card-overlay country-card-overlay ${selected ? 'selected' : ''}`}
      style={{ left: `${(action.x / BOARD_CANVAS_WIDTH) * 100}%`, top: `${(action.y / BOARD_CANVAS_HEIGHT) * 100}%`, width: `${(action.width / BOARD_CANVAS_WIDTH) * 100}%`, aspectRatio: '4 / 3' }}
      onPointerDown={onMoveStart}
    >
      <img src={card.asset} alt={card.name} draggable="false" />
      {fields.map((field) => {
        const value = String(action.fields?.[field.key] || '');
        const style = { left:`${field.x}%`, top:`${field.y}%`, width:`${field.w}%`, height:`${field.h}%`, fontSize:`${countryCardFontSize(action, value || field.label, field.title)}px` };
        if (selected) return <textarea key={field.key} className={`country-card-field-editor ${field.title ? 'title' : ''}`} dir="rtl" rows={1} value={value} placeholder={field.label} style={style} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onChange({ ...action, fields: { ...(action.fields || {}), [field.key]: event.target.value } })} />;
        if (!value) return null;
        return <div key={field.key} className={`country-card-field-text ${field.title ? 'title' : ''}`} style={style}>{value}</div>;
      })}
      {selected && <div className="country-card-actions" onPointerDown={(event) => event.stopPropagation()}><strong>{card.name}</strong><span className="country-card-resize-handle" onPointerDown={onResizeStart} title="تغيير الحجم">↘</span></div>}
    </div>
  );
}

function fitCountryCanvasText(ctx, value, maxWidth, requestedSize, fontFamily, weight = 800) {
  let size = requestedSize;
  const text = String(value || '').trim();
  while (size > 11) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

async function drawCountryCardToCanvas(ctx, action) {
  const card = COUNTRY_CARD_MAP[action.cardKey];
  if (!card) return;
  const x = Number(action.x || 0); const y = Number(action.y || 0);
  const width = Number(action.width || 690); const height = Number(action.height || width * 0.75);
  try {
    const image = await dataUrlToImage(card.asset);
    ctx.drawImage(image, x, y, width, height);
  } catch { return; }
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8e7b0';
  ctx.shadowColor = 'rgba(0,0,0,.78)';
  ctx.shadowBlur = 3;
  const family = "'Noto Naskh Arabic','Amiri','Traditional Arabic',serif";
  for (const field of countryCardFields(card)) {
    const value = String(action.fields?.[field.key] || '').trim();
    if (!value) continue;
    const fx = x + width * field.x / 100; const fy = y + height * field.y / 100;
    const fw = width * field.w / 100; const fh = height * field.h / 100;
    const requested = countryCardFontSize(action, value, field.title);
    const size = fitCountryCanvasText(ctx, value, fw - 10, requested, family, field.title ? 900 : 800);
    ctx.font = `${field.title ? 900 : 800} ${size}px ${family}`;
    ctx.textAlign = field.title ? 'center' : 'right';
    ctx.fillStyle = field.title ? '#ffe7a3' : '#f7e5ad';
    const textX = field.title ? fx + fw / 2 : fx + fw - 4;
    ctx.fillText(value, textX, fy + fh / 2, fw - 8);
  }
  ctx.restore();
}

function CanvasOverlay({ actions, onDrawAction, onMoveAction, onSelectAction, selectedActionId, template, zoom, boardRef, tool, selectedColor, strokeWidth, shapeKind, historicalSymbol, geographicalSymbol, arrowMode, textValue, textStyle, fontFamily, fontSize, fontWeight = 700, textPreset = 'explanation', boardReady, setBoardReady, hasResourceHeader = false, onAddCard, onAddCountryCard }) {
  const canvasRef = useRef(null);
  const currentStroke = useRef(null);
  const drawing = useRef(false);
  const moving = useRef(null);
  const [textEditor, setTextEditor] = useState(null);

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
    let cancelled = false;
    const fonts = globalThis.document?.fonts;
    if (!fonts?.ready) return undefined;
    Promise.resolve(fonts.ready).then(() => { if (!cancelled) render(); }).catch(() => {});
    return () => { cancelled = true; };
  }, [fontFamily, actions]);

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
    try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture is optional. */ }
    const point = getPoint(event);
    if (tool === 'select' || tool === 'move') {
      const action = findAction(point);
      onSelectAction(action?.id || null);
      if (tool === 'move' && action) moving.current = { action, start: point };
      return;
    }
    if (tool === 'text') {
      setTextEditor({ x: point.x, y: point.y, value: String(textValue || '') });
      return;
    }
    if (tool === 'shape' || tool === 'arrow' || tool === 'historical-symbol' || tool === 'geographical-symbol') {
      onDrawAction({
        kind: tool,
        x: point.x,
        y: point.y,
        text: `سهم ${arrowMode}`,
        shape: shapeKind,
        symbolKind: tool === 'geographical-symbol' ? geographicalSymbol : historicalSymbol,
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
      points: [{ ...point, pressure: Number(event.pressure || 0.5), t: Math.max(1, Math.round(Number(event.timeStamp || performance.now()))) }],
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
    const nativeEvent = event.nativeEvent || event;
    const samples = nativeEvent.getCoalescedEvents?.() || [nativeEvent];
    for (const sample of samples) {
      const point = getPoint(sample);
      const previous = currentStroke.current.points[currentStroke.current.points.length - 1];
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 1.2) {
        currentStroke.current.points.push({ ...point, pressure: Number(sample.pressure || 0.5), t: Math.max(1, Math.round(Number(sample.timeStamp || performance.now()))) });
      }
    }
    render(currentStroke.current);
  };

  const onPointerUp = (event) => {
    try { event?.currentTarget?.releasePointerCapture?.(event.pointerId); } catch { /* Pointer capture may already be released. */ }
    if (moving.current) {
      moving.current = null;
      return;
    }
    if (drawing.current && currentStroke.current) onDrawAction(currentStroke.current);
    currentStroke.current = null;
    drawing.current = false;
  };

  const commitTextEditor = () => {
    const value = String(textEditor?.value || '').trim();
    if (!value) {
      setTextEditor(null);
      return;
    }
    onDrawAction({
      kind: 'text',
      x: textEditor.x,
      y: textEditor.y,
      text: value,
      color: selectedColor,
      textStyle,
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight: BOARD_TEXT_PRESET_MAP[textPreset]?.lineHeight || 1.35,
      textPreset,
    });
    setTextEditor(null);
  };

  return (
    <div
      ref={boardRef}
      className={`class-board-canvas-shell tool-${tool} board-theme-${template} ${hasResourceHeader ? 'has-resource-head' : ''}`}
      style={{ '--board-zoom': zoom }}
      onDragOver={(event) => {
        const types = event.dataTransfer?.types || [];
        if (types.includes('application/x-mobdea-board-card') || types.includes('application/x-mobdea-country-card')) event.preventDefault();
      }}
      onDrop={(event) => {
        const templateKey = event.dataTransfer?.getData('application/x-mobdea-board-card');
        const countryKey = event.dataTransfer?.getData('application/x-mobdea-country-card');
        if (!templateKey && !countryKey) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * BOARD_CANVAS_WIDTH;
        const y = ((event.clientY - rect.top) / rect.height) * BOARD_CANVAS_HEIGHT;
        if (countryKey && onAddCountryCard) onAddCountryCard(countryKey, x, y);
        else if (templateKey && onAddCard) onAddCard(templateKey, x, y);
      }}
    >
      {!hasResourceHeader && template === 'history' && (
        <div className="classmode-board-identity classmode-board-reference-identity" aria-hidden="true">
          <img className="classmode-board-reference-image" src="/identity/class-board-history-v14.jpg" alt="" />
        </div>
      )}
      {!hasResourceHeader && ['geography', 'manuscript'].includes(template) && (
        <div className="classmode-board-identity" aria-hidden="true">
          <BoardThemeDecor template={template} />
          <div className="classmode-history-ornament ornament-top" />
          <img className="classmode-board-watermark" src={identity.logo} alt="" />
          <div className="classmode-history-ornament ornament-bottom" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={BOARD_CANVAS_WIDTH}
        height={BOARD_CANVAS_HEIGHT}
        className="class-board-canvas"
        style={hasResourceHeader || ['history', 'geography', 'manuscript'].includes(template) ? undefined : { ...boardBackground(template) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(event) => { if (drawing.current) onPointerUp(event); }}
      />
      <div className="board-card-layer" aria-label="البطاقات على السبورة">
        {actions.filter((action) => action.kind === 'board-card').map((action) => <BoardCardOverlay key={action.id} action={action} selected={action.id === selectedActionId} onSelect={onSelectAction} onChange={onMoveAction} />)}
        {actions.filter((action) => action.kind === 'country-card').map((action) => <CountryCardOverlay key={action.id} action={action} selected={action.id === selectedActionId} onSelect={onSelectAction} onChange={onMoveAction} />)}
      </div>
      {textEditor && (
        <div
          className="classmode-inline-text-editor"
          style={{ left: `${(textEditor.x / BOARD_CANVAS_WIDTH) * 100}%`, top: `${(textEditor.y / BOARD_CANVAS_HEIGHT) * 100}%` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            autoFocus
            dir="rtl"
            value={textEditor.value}
            onChange={(event) => setTextEditor((current) => ({ ...current, value: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setTextEditor(null);
              if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commitTextEditor(); }
            }}
            placeholder="اكتب هنا…"
            style={{ fontFamily, fontSize: `${Math.max(18, fontSize * .72)}px`, fontWeight }}
          />
          <div><button type="button" onClick={commitTextEditor}>إضافة</button><button type="button" onClick={() => setTextEditor(null)}>إلغاء</button></div>
        </div>
      )}

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
  const [geographicalSymbol, setGeographicalSymbol] = useState('mountain');
  const [arrowMode, setArrowMode] = useState('right');
  const [boardText, setBoardText] = useState('');
  const [textStyle, setTextStyle] = useState('plain');
  const [fontFamily, setFontFamily] = useState(boardFontOptions[0].value);
  const [fontSize, setFontSize] = useState(BOARD_TEXT_PRESET_MAP.explanation.size);
  const [textPreset, setTextPreset] = useState('explanation');
  const [zoom, setZoom] = useState(1);
  const [mediaZoom, setMediaZoom] = useState(1);
  const resourcePageMemoryRef = useRef(new Map());
  const resourceZoomMemoryRef = useRef(new Map());
  const appliedPreferredResourceRef = useRef('');
  const [boardReady, setBoardReady] = useState(false);
  const [handwritingBusy, setHandwritingBusy] = useState(false);
  const [cardsDrawerOpen, setCardsDrawerOpen] = useState(false);
  const [cardDrawerSection, setCardDrawerSection] = useState('education');
  const [countryCategory, setCountryCategory] = useState('arab');
  const [fontReady, setFontReady] = useState(true);
  const [fontLoadFailed, setFontLoadFailed] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const canvasTool = TEXT_TOOL_STYLES[tool] ? 'text' : tool;
  const activeTextPreset = BOARD_TEXT_PRESET_MAP[textPreset] || BOARD_TEXT_PRESET_MAP.explanation;
  const fontWeight = activeTextPreset.weight;
  const activeFontOption = boardFontOptions.find((item) => item.value === fontFamily) || boardFontOptions[0];

  useEffect(() => {
    if (!shareNotice) return undefined;
    const timer = window.setTimeout(() => setShareNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);

  useEffect(() => {
    let cancelled = false;
    const fonts = globalThis.document?.fonts;
    if (!fonts?.load) return undefined;
    const exactFamily = `"${activeFontOption.probe}"`;
    const fontSpec = `${fontWeight} ${fontSize}px ${exactFamily}`;
    setFontReady(false);
    setFontLoadFailed(false);
    Promise.resolve(fonts.load(fontSpec, 'المبدع تاريخ وجغرافيا'))
      .then((loadedFaces) => {
        if (cancelled) return;
        const loaded = (Array.isArray(loadedFaces) ? loadedFaces.length > 0 : true) && Boolean(fonts.check?.(fontSpec) ?? true);
        setFontReady(loaded);
        setFontLoadFailed(!loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setFontReady(false);
          setFontLoadFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [activeFontOption.probe, fontFamily, fontSize, fontWeight]);

  const updateSelectedTextFormatting = (patch) => {
    if (!selectedBoardActionId) return;
    setBoardActions((currentActions) => currentActions.map((action) =>
      action.id === selectedBoardActionId && action.kind === 'text' ? { ...action, ...patch } : action
    ));
    setRedoStack([]);
  };

  const selectTextPreset = (key) => {
    const preset = BOARD_TEXT_PRESET_MAP[key] || BOARD_TEXT_PRESET_MAP.explanation;
    setTextPreset(preset.key);
    setFontSize(preset.size);
    updateSelectedTextFormatting({
      textPreset: preset.key,
      fontSize: preset.size,
      fontWeight: preset.weight,
      lineHeight: preset.lineHeight,
    });
  };

  const selectBoardFont = (value) => {
    setFontFamily(value);
    updateSelectedTextFormatting({ fontFamily: value });
  };

  const selectBoardAction = (id) => {
    setSelectedBoardActionId(id);
    if (!id) return;
    const action = boardActions.find((item) => item.id === id);
    if (action?.kind !== 'text') return;
    if (action.fontFamily) setFontFamily(action.fontFamily);
    const preset = BOARD_TEXT_PRESET_MAP[action.textPreset] || BOARD_TEXT_PRESETS.find((item) => item.size === Number(action.fontSize));
    if (preset) {
      setTextPreset(preset.key);
      setFontSize(preset.size);
    }
  };

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
    try { await document.fonts?.ready; } catch { /* Export still works with the declared fallback fonts. */ }
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = contentMode === 'board' ? 800 : 720;
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
    inkCanvas.width = BOARD_CANVAS_WIDTH;
    inkCanvas.height = BOARD_CANVAS_HEIGHT;
    const inkContext = inkCanvas.getContext('2d');
    boardActions.filter((action) => !['board-card', 'country-card'].includes(action.kind)).forEach((action) => drawBoardAction(inkContext, action, false));
    for (const card of boardActions.filter((action) => action.kind === 'board-card')) await drawBoardCardToCanvas(inkContext, card);
    for (const card of boardActions.filter((action) => action.kind === 'country-card')) await drawCountryCardToCanvas(inkContext, card);
    ctx.drawImage(inkCanvas, 0, 0, canvas.width, canvas.height);
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
      if (last.kind === 'text' && Array.isArray(last.handwritingSourceStrokes) && last.handwritingSourceStrokes.length) {
        return [...currentActions.slice(0, -1), ...last.handwritingSourceStrokes];
      }
      return currentActions.slice(0, -1);
    });
  };

  const redoBoard = () => {
    setRedoStack((currentRedo) => {
      if (!currentRedo.length) return currentRedo;
      const [next, ...rest] = currentRedo;
      setBoardActions((currentActions) => {
        if (next.kind === 'text' && Array.isArray(next.handwritingSourceStrokes) && next.handwritingSourceStrokes.length) {
          const sourceIds = new Set(next.handwritingSourceStrokes.map((stroke) => stroke.id));
          return [...currentActions.filter((action) => !sourceIds.has(action.id)), next];
        }
        return [...currentActions, next];
      });
      return rest;
    });
  };

  const clearBoard = () => {
    setBoardActions([]);
    setRedoStack([]);
    setSelectedBoardActionId(null);
  };

  const convertRecentHandwriting = async () => {
    if (handwritingBusy) return;
    const strokes = recentHandwritingStrokes(boardActions);
    if (!strokes.length) {
      setShareNotice('اكتب كلمة أو جملة بالقلم أولًا، ثم اضغط «تصحيح خط اليد».');
      return;
    }
    const snapshot = handwritingSnapshot(strokes);
    if (!snapshot) {
      setShareNotice('تعذر تجهيز الكتابة اليدوية للتحويل.');
      return;
    }
    setHandwritingBusy(true);
    setShareNotice('جارٍ قراءة خط اليد وتنظيمه…');
    try {
      const result = await recognizeHandwritingStrokes(strokes, snapshot.dataUrl, {
        onProgress: (progress) => {
          if (progress?.status === 'recognizing text' && Number.isFinite(progress.progress)) {
            setShareNotice(`جارٍ قراءة خط اليد… ${Math.round(progress.progress * 100)}%`);
          }
        },
      });
      const text = String(result?.text || '').replace(/\s+/g, ' ').trim();
      const confidence = result?.confidence == null ? null : Number(result.confidence);
      if (!text || (Number.isFinite(confidence) && confidence < 22)) {
        setShareNotice('التعرّف لم يكن واضحًا بما يكفي؛ أبقيت خط اليد كما هو حتى لا يضيع كلامك.');
        return;
      }
      try { await document.fonts?.load?.(`${fontWeight} ${fontSize}px ${fontFamily}`, text); } catch { /* keep the declared fallback */ }
      const nextAction = {
        id: Date.now() + Math.random(),
        kind: 'text',
        text,
        x: Math.min(BOARD_CANVAS_WIDTH - 24, snapshot.bounds.maxX),
        y: Math.max(20, snapshot.bounds.minY),
        color: annotationColor,
        fontSize,
        fontFamily,
        fontWeight,
        lineHeight: activeTextPreset.lineHeight,
        textPreset,
        textStyle: 'plain',
        handwritingConfidence: Number.isFinite(confidence) ? confidence : null,
        handwritingSourceStrokes: strokes.map((stroke) => ({ ...stroke, points: (stroke.points || []).map((point) => ({ ...point })) })),
      };
      setBoardActions((current) => [
        ...current.filter((action) => !snapshot.ids.has(action.id)),
        nextAction,
      ]);
      setSelectedBoardActionId(null);
      setRedoStack([]);
      setTextStyle('plain');
      setTool('pen');
      const presetLabel = activeTextPreset.label;
      const fontLabel = boardFontOptions.find((item) => item.value === fontFamily)?.label || 'الخط المختار';
      setShareNotice(`تم تنسيق خط اليد كنمط «${presetLabel}» بخط «${fontLabel}»${Number.isFinite(confidence) ? ` — دقة ${Math.round(confidence)}%` : ''}.`);
    } catch (error) {
      setShareNotice(error?.message || 'تعذر تحويل خط اليد. أبقيت الكتابة الأصلية كما هي.');
    } finally {
      setHandwritingBusy(false);
    }
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

  const addBoardCard = (templateKey, dropX = BOARD_CANVAS_WIDTH / 2, dropY = BOARD_CANVAS_HEIGHT / 2) => {
    const template = BOARD_CARD_TEMPLATE_MAP[templateKey];
    if (!template) return;
    const width = template.ratio < 1 ? 390 : 650;
    const height = width / template.ratio;
    const fields = Object.fromEntries(template.fields.map((field) => [field.key, '']));
    const next = {
      id: Date.now() + Math.random(), kind: 'board-card', templateKey, fields,
      width, height,
      x: Math.max(0, Math.min(BOARD_CANVAS_WIDTH - width, dropX - width / 2)),
      y: Math.max(0, Math.min(BOARD_CANVAS_HEIGHT - height, dropY - height / 2)),
    };
    setBoardActions((current) => [...current, next]);
    setSelectedBoardActionId(next.id);
    setRedoStack([]);
    setTool('select');
    setTextStyle('plain');
    setCardsDrawerOpen(false);
  };

  const addCountryCard = (cardKey, dropX = BOARD_CANVAS_WIDTH / 2, dropY = BOARD_CANVAS_HEIGHT / 2) => {
    const card = COUNTRY_CARD_MAP[cardKey];
    if (!card) return;
    const width = 690;
    const height = width * 0.75;
    const fields = { info1: '', info2: '', info3: '', info4: '' };
    if (card.isDefault) fields.title = '';
    const next = {
      id: Date.now() + Math.random(),
      kind: 'country-card',
      cardKey,
      fields,
      width,
      height,
      x: Math.max(0, Math.min(BOARD_CANVAS_WIDTH - width, dropX - width / 2)),
      y: Math.max(0, Math.min(BOARD_CANVAS_HEIGHT - height, dropY - height / 2)),
    };
    setBoardActions((current) => [...current, next]);
    setSelectedBoardActionId(next.id);
    setRedoStack([]);
    setTool('select');
    setCardsDrawerOpen(false);
  };

  const handleBoardAction = (action) => {
    const next = { ...action, id: Date.now() + Math.random() };
    setBoardActions((currentActions) => [...currentActions, next]);
    setSelectedBoardActionId(['stroke', 'text'].includes(action.kind) ? null : next.id);
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
            {contentMode === 'board' && <button type="button" className={`classmode-card-drawer-toggle ${cardsDrawerOpen ? 'active' : ''}`} onClick={() => setCardsDrawerOpen((value) => !value)} title="البطاقات التعليمية"><StickyNote size={17}/><span>البطاقات</span></button>}
            <button
              type="button"
              className={`classmode-board-focus-toggle classmode-stage-focus-toggle ${stageFocus ? 'active' : ''}`}
              onClick={() => setStageFocus((value) => !value)}
              title={stageFocus ? 'العودة لوضع الحصة' : 'ملء مساحة العرض'}
            >
              <Maximize2 size={17} /><span>{stageFocus ? 'عودة للحصة' : contentMode === 'board' ? 'ملء السبورة' : 'ملء العرض'}</span>
            </button>
            {contentMode === 'board' && cardsDrawerOpen && <aside className="classmode-card-drawer" aria-label="قائمة بطاقات السبورة">
              <div className="classmode-card-drawer-head"><div><strong>{cardDrawerSection === 'countries' ? 'بطاقات الدول' : 'البطاقات التعليمية'}</strong><small>اسحب البطاقة إلى السبورة أو اضغط لإضافتها في المنتصف</small></div><button type="button" onClick={() => setCardsDrawerOpen(false)} aria-label="إغلاق"><X size={18}/></button></div>
              <div className="classmode-card-drawer-tabs" role="tablist" aria-label="نوع البطاقات">
                <button type="button" className={cardDrawerSection === 'education' ? 'active' : ''} onClick={() => setCardDrawerSection('education')}>بطاقات تعليمية</button>
                <button type="button" className={cardDrawerSection === 'countries' ? 'active' : ''} onClick={() => setCardDrawerSection('countries')}>بطاقات الدول</button>
              </div>
              {cardDrawerSection === 'education' ? (
                <div className="classmode-card-drawer-list">
                  {BOARD_CARD_TEMPLATES.map((card) => <button
                    key={card.key}
                    type="button"
                    className="classmode-card-template-item"
                    draggable
                    onDragStart={(event) => { event.dataTransfer.setData('application/x-mobdea-board-card', card.key); event.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => addBoardCard(card.key)}
                  ><img src={card.asset} alt=""/><span>{card.label}</span></button>)}
                </div>
              ) : (
                <>
                  <div className="country-card-category-tabs" role="tablist" aria-label="تصنيفات بطاقات الدول">
                    {COUNTRY_CARD_CATEGORIES.map((category) => <button key={category.key} type="button" className={countryCategory === category.key ? 'active' : ''} onClick={() => setCountryCategory(category.key)}>{category.label}</button>)}
                  </div>
                  <div className="classmode-card-drawer-list country-card-drawer-list">
                    <button type="button" className="classmode-card-template-item country-card-template-item default" draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-mobdea-country-card', DEFAULT_COUNTRY_CARD.key); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addCountryCard(DEFAULT_COUNTRY_CARD.key)}><img src={DEFAULT_COUNTRY_CARD.asset} alt=""/><span>بطاقة افتراضية</span></button>
                    {countryCardsForCategory(countryCategory).map((card) => <button key={card.key} type="button" className="classmode-card-template-item country-card-template-item" draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-mobdea-country-card', card.key); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addCountryCard(card.key)}><img src={card.asset} alt=""/><span>{card.name}</span></button>)}
                  </div>
                </>
              )}
            </aside>}
            <div className={`classmode-board-surface ${boardToolsVisible ? 'with-tools' : ''}`}>
              {boardToolsVisible && <div className={`classmode-board-sidebar-left ${contentMode !== 'board' ? 'media-annotation-tools' : ''}`}>
                {toolOptions.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" className={tool === key ? 'active' : ''} onClick={() => activateBoardTool(key)} title={label}><Icon size={19} /><span>{label}</span></button>
                ))}
                {contentMode === 'board' && <button type="button" className="classmode-handwriting-polish" onClick={convertRecentHandwriting} disabled={handwritingBusy} title="حوّل آخر كتابة بالقلم إلى نص منسق بالخط المختار"><Sparkles size={19}/><span>{handwritingBusy ? 'جارٍ التحويل…' : 'تصحيح خط اليد'}</span></button>}
                <div className="classmode-left-toolbar-divider" />
                <button type="button" onClick={() => contentMode === 'board' ? setZoom((value) => Math.min(2, value + 0.15)) : setMediaZoom((value) => Math.min(2.5, Number((value + 0.15).toFixed(2))))} title="تكبير"><ZoomIn size={19} /><span>تكبير</span></button>
                <button type="button" onClick={() => contentMode === 'board' ? setZoom((value) => Math.max(0.75, Number((value - 0.15).toFixed(2)))) : setMediaZoom((value) => Math.max(1, Number((value - 0.15).toFixed(2))))} title="تصغير"><ZoomOut size={19} /><span>تصغير</span></button>
                <button type="button" onClick={undoBoard} title="تراجع"><Undo2 size={19} /><span>تراجع</span></button>
                <button type="button" onClick={redoBoard} title="إعادة"><Redo2 size={19} /><span>إعادة</span></button>
                <button type="button" onClick={saveBoard} title="حفظ"><Save size={19} /><span>حفظ</span></button>
              </div>}

              <div className={`classmode-board-stage board-template-${boardTemplate} ${contentMode === 'board' ? 'has-lesson-ribbon' : ''}`}>
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
                  <div className="classmode-resource-preview">
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
                      zoom={mediaZoom}
                      onZoomChange={setMediaZoom}
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
                  onSelectAction={selectBoardAction}
                  selectedActionId={selectedBoardActionId}
                  template={boardTemplate}
                  zoom={contentMode === 'board' ? zoom : 1}
                  boardRef={boardRef}

                  tool={canvasTool}
                  selectedColor={annotationColor}
                  strokeWidth={strokeWidth}
                  shapeKind={shapeKind}
                  historicalSymbol={historicalSymbol}
                  geographicalSymbol={geographicalSymbol}
                  arrowMode={arrowMode}
                  textValue={boardText}
                  textStyle={textStyle}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  fontWeight={fontWeight}
                  textPreset={textPreset}
                  boardReady={boardReady}
                  setBoardReady={setBoardReady}
                  hasResourceHeader={Boolean(displayResource)}
                  onAddCard={addBoardCard}
                  onAddCountryCard={addCountryCard}
                />}
                </>
                )}              </div>
            </div>
          </div>

          {boardToolsVisible && <div className={`classmode-toolbar ${contentMode !== 'board' ? 'media-annotation-toolbar' : ''}`}>
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
              <select className="classmode-font-select" value={fontFamily} onChange={(e) => selectBoardFont(e.target.value)} title="نوع الخط العربي الحقيقي">
                {boardFontOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <span className={`classmode-font-status ${fontReady ? 'ready' : fontLoadFailed ? 'failed' : 'loading'}`} title={fontReady ? 'نوع الخط المحدد محمّل فعليًا' : fontLoadFailed ? 'تعذر تحميل نوع الخط؛ يظهر خط بديل مؤقتًا' : 'جارٍ تحميل نوع الخط المحدد'}>{fontReady ? '✓ الخط فعلي' : fontLoadFailed ? '⚠ خط بديل' : '… تحميل الخط'}</span>
            </div>
            <div className="classmode-tool-group compact classmode-text-style-row">
              {BOARD_TEXT_PRESETS.map((preset) => <button key={preset.key} className={textPreset === preset.key ? 'active' : ''} onClick={() => selectTextPreset(preset.key)} type="button" title={`حجم ${preset.label}: ${preset.size}px`}>{preset.label}</button>)}
              <button className={textStyle === 'plain' && tool === 'normal-text' ? 'active' : ''} onClick={() => activateStyledText('plain')} type="button"><Type size={15} /> كتابة نصية</button>
              <button className="classmode-handwriting-polish" onClick={convertRecentHandwriting} disabled={handwritingBusy} type="button" title="تحويل آخر خط يد إلى نص منظم بالحجم والنوع المختارين"><Sparkles size={15}/>{handwritingBusy ? 'جارٍ القراءة…' : 'تصحيح خط اليد'}</button>
              <button type="button" className={`classmode-open-card-drawer ${cardsDrawerOpen ? 'active' : ''}`} onClick={() => setCardsDrawerOpen(true)}><StickyNote size={15}/> البطاقات</button>
            </div>
            <div className="classmode-tool-group compact classmode-historical-symbol-row">
              {historicalSymbolOptions.map((item) => (
                <button
                  key={item.key}
                  className={tool === 'historical-symbol' && historicalSymbol === item.key ? 'active' : ''}
                  onClick={() => {
                    setHistoricalSymbol(item.key);
                    activateBoardTool('historical-symbol');
                  }}
                  type="button"
                  title={item.label}
                >
                  {item.label}
                </button>
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
        {lastPraise && (
          <div className="spoken-banner is-voice" role="status" aria-live="polite">
            <span>{`🔊 ${lastPraise}`}</span>
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
