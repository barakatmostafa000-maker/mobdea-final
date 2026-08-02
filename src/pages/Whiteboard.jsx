import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  Diamond,
  Download,
  Eraser,
  FileImage,
  Highlighter,
  ImagePlus,
  Maximize2,
  MousePointer2,
  Move,
  PenLine,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Shapes,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { identity } from '../config/identity';
import { useAssetUrl } from '../hooks/useAssetUrl';
import { usePdfPage } from '../hooks/usePdfPage';
import { importLegacyDataUrl } from '../services/assetStore';
import { formatDateAr, todayISO } from '../utils/time';

const BOARD_WIDTH = 1400;
const BOARD_HEIGHT = 850;
const colors = ['#111827', '#2563eb', '#dc2626', '#16a34a', '#d7ad35', '#7c3aed'];
const lineStyles = [
  { value: 'solid', label: 'خط متصل' },
  { value: 'dashed', label: 'خط متقطع' },
  { value: 'dotted', label: 'خط منقّط' },
  { value: 'calligraphy', label: 'لمسة خطاط' },
];
const boardFonts = [
  { value: 'Tahoma, Arial, sans-serif', label: 'العربية الأكاديمية' },
  { value: 'Arial, Tahoma, sans-serif', label: 'العربية الحديثة' },
  { value: 'Georgia, serif', label: 'العنوان التراثي' },
  { value: 'serif', label: 'المخطوط الكلاسيكي' },
];

function actionBounds(action) {
  if (action.kind === 'stroke') {
    const xs = action.points.map((point) => point.x);
    const ys = action.points.map((point) => point.y);
    return { x: Math.min(...xs) - 14, y: Math.min(...ys) - 14, width: Math.max(...xs) - Math.min(...xs) + 28, height: Math.max(...ys) - Math.min(...ys) + 28 };
  }
  if (action.kind === 'text') return { x: action.x, y: action.y - 34, width: Math.max(120, String(action.text || '').length * 24), height: 54 };
  return { x: Math.min(action.x, action.x2), y: Math.min(action.y, action.y2), width: Math.abs(action.x2 - action.x), height: Math.abs(action.y2 - action.y) };
}

function drawAction(ctx, action, selected = false) {
  ctx.save();
  ctx.lineCap = action.lineStyle === 'calligraphy' ? 'square' : 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = action.color || '#111827';
  ctx.fillStyle = action.color || '#111827';
  ctx.lineWidth = action.width || 5;
  if (action.lineStyle === 'dashed') ctx.setLineDash([18, 12]);
  else if (action.lineStyle === 'dotted') ctx.setLineDash([2, 12]);
  else ctx.setLineDash([]);

  if (action.kind === 'stroke') {
    ctx.globalAlpha = action.tool === 'highlighter' ? 0.28 : 1;
    ctx.globalCompositeOperation = action.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.lineWidth = action.tool === 'eraser'
      ? Math.max(26, action.width || 26)
      : action.tool === 'highlighter'
        ? Math.max(18, action.width || 18)
        : action.lineStyle === 'calligraphy'
          ? Math.max(7, (action.width || 5) * 1.35)
          : action.width || 5;
    const points = action.points || [];
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, Math.max(1.5, ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fill();
    } else if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        ctx.quadraticCurveTo(current.x, current.y, midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  } else if (action.kind === 'text') {
    ctx.setLineDash([]);
    ctx.font = `${action.fontWeight || 700} ${action.fontSize || 34}px ${action.fontFamily || 'Tahoma, Arial, sans-serif'}`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText(action.text, action.x, action.y);
  } else {
    const x = action.x;
    const y = action.y;
    const width = action.x2 - action.x;
    const height = action.y2 - action.y;
    if (action.kind === 'rect') ctx.strokeRect(x, y, width, height);
    if (action.kind === 'circle') {
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (action.kind === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(action.x2, action.y2);
      ctx.lineTo(x, action.y2);
      ctx.closePath();
      ctx.stroke();
    }
    if (action.kind === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(action.x2, y + height / 2);
      ctx.lineTo(x + width / 2, action.y2);
      ctx.lineTo(x, y + height / 2);
      ctx.closePath();
      ctx.stroke();
    }
    if (action.kind === 'line' || action.kind === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(action.x2, action.y2);
      ctx.stroke();
      if (action.kind === 'arrow') {
        const angle = Math.atan2(action.y2 - y, action.x2 - x);
        const size = 22;
        ctx.beginPath();
        ctx.moveTo(action.x2, action.y2);
        ctx.lineTo(action.x2 - size * Math.cos(angle - Math.PI / 6), action.y2 - size * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(action.x2, action.y2);
        ctx.lineTo(action.x2 - size * Math.cos(angle + Math.PI / 6), action.y2 - size * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  }

  ctx.restore();
  if (selected) {
    const bounds = actionBounds(action);
    ctx.save();
    ctx.strokeStyle = '#d7ad35';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 7]);
    ctx.strokeRect(bounds.x, bounds.y, Math.max(12, bounds.width), Math.max(12, bounds.height));
    ctx.restore();
  }
}

function moveAction(action, dx, dy) {
  if (action.kind === 'stroke') return { ...action, points: action.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  if (action.kind === 'text') return { ...action, x: action.x + dx, y: action.y + dy };
  return { ...action, x: action.x + dx, y: action.y + dy, x2: action.x2 + dx, y2: action.y2 + dy };
}

function hitTest(actions, point) {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const bounds = actionBounds(actions[index]);
    if (point.x >= bounds.x && point.x <= bounds.x + Math.max(14, bounds.width) && point.y >= bounds.y && point.y <= bounds.y + Math.max(14, bounds.height)) return actions[index].id;
  }
  return null;
}

export default function Whiteboard({ data, updateData, navigate }) {
  const currentSession = data.sessions.find((session) => session.current) || data.sessions[0] || null;
  const students = currentSession ? data.students.filter((student) => student.group === currentSession.group) : data.students;
  const resources = (data.contentLibrary || []).filter((resource) => ['image', 'pdf', 'textbook'].includes(resource.type));
  const [resourceId, setResourceId] = useState(resources[0]?.id || '');
  const resource = resources.find((item) => String(item.id) === String(resourceId)) || null;
  const resourceUrl = useAssetUrl(resource?.assetId, resource?.url);
  const [localImage, setLocalImage] = useState('');
  const [localImageKey, setLocalImageKey] = useState('');
  const [resourcePage, setResourcePage] = useState(1);
  const pdfPage = usePdfPage(['pdf', 'textbook'].includes(resource?.type) ? resourceUrl : '', resourcePage);
  const [pages, setPages] = useState([{ id: Date.now(), layers: {} }]);
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState('pen');
  const [shape, setShape] = useState('rect');
  const [color, setColor] = useState('#2563eb');
  const [width, setWidth] = useState(5);
  const [lineStyle, setLineStyle] = useState('solid');
  const [fontFamily, setFontFamily] = useState(boardFonts[0].value);
  const [fontSize, setFontSize] = useState(34);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [redo, setRedo] = useState([]);
  const [points, setPoints] = useState({});
  const [notice, setNotice] = useState('');
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const drawing = useRef(false);
  const draft = useRef(null);
  const dragStart = useRef(null);
  const fileRef = useRef(null);
  const layerKey = localImage
    ? `local:${localImageKey || 'image'}`
    : resource
      ? `resource:${resource.id}:${['pdf', 'textbook'].includes(resource.type) ? resourcePage : 1}`
      : 'blank';
  const actions = pages[pageIndex]?.layers?.[layerKey] || pages[pageIndex]?.actions || [];
  const backgroundUrl = localImage || pdfPage.dataUrl || resourceUrl;

  const ranked = useMemo(() => students.map((student) => ({ ...student, points: points[student.id] || 0 })).sort((a, b) => b.points - a.points), [students, points]);

  const commitActions = (nextActions) => {
    setPages((current) => current.map((page, index) => index === pageIndex
      ? { ...page, layers: { ...(page.layers || {}), [layerKey]: nextActions } }
      : page));
  };

  const render = (preview = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    actions.forEach((action) => drawAction(ctx, action, action.id === selectedId));
    if (preview) drawAction(ctx, preview, false);
  };

  useEffect(() => { render(); }, [actions, selectedId]);

  useEffect(() => {
    setSelectedId(null);
    setRedo([]);
  }, [layerKey, pageIndex]);

  useEffect(() => () => {
    if (localImage) URL.revokeObjectURL(localImage);
  }, [localImage]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        commitActions(actions.filter((action) => action.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, actions]);

  const pointFromEvent = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return { x: ((source.clientX - rect.left) / rect.width) * BOARD_WIDTH, y: ((source.clientY - rect.top) / rect.height) * BOARD_HEIGHT };
  };

  const onPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    if (tool === 'select' || tool === 'move') {
      const id = hitTest(actions, point);
      setSelectedId(id);
      if (id && tool === 'move') dragStart.current = { point, actions };
      return;
    }
    setSelectedId(null);
    if (tool === 'text') {
      const text = window.prompt('اكتب النص التوضيحي الذي تريد وضعه على السبورة:', '');
      if (!text?.trim()) return;
      commitActions([...actions, {
        id: Date.now(), kind: 'text', text: text.trim(), x: point.x, y: point.y,
        color, fontSize, fontFamily, fontWeight: 700,
      }]);
      setRedo([]);
      return;
    }
    drawing.current = true;
    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      draft.current = { id: Date.now(), kind: 'stroke', tool, points: [point], color, width, lineStyle };
    } else {
      draft.current = {
        id: Date.now(), kind: shape === 'arrow' ? 'arrow' : shape,
        x: point.x, y: point.y, x2: point.x, y2: point.y,
        color, width, lineStyle,
      };
    }
  };

  const onPointerMove = (event) => {
    if (dragStart.current && selectedId && tool === 'move') {
      event.preventDefault();
      const point = pointFromEvent(event);
      const dx = point.x - dragStart.current.point.x;
      const dy = point.y - dragStart.current.point.y;
      const next = dragStart.current.actions.map((action) => action.id === selectedId ? moveAction(action, dx, dy) : action);
      commitActions(next);
      return;
    }
    if (!drawing.current || !draft.current) return;
    event.preventDefault();
    const nativeEvent = event.nativeEvent || event;
    const samples = nativeEvent.getCoalescedEvents?.() || [nativeEvent];
    if (draft.current.kind === 'stroke') {
      samples.forEach((sample) => draft.current.points.push(pointFromEvent(sample)));
    } else {
      const point = pointFromEvent(samples[samples.length - 1]);
      draft.current.x2 = point.x;
      draft.current.y2 = point.y;
    }
    render(draft.current);
  };

  const onPointerUp = (event) => {
    try { event?.currentTarget?.releasePointerCapture?.(event.pointerId); } catch { /* pointer capture already released */ }
    if (dragStart.current) {
      dragStart.current = null;
      setRedo([]);
      return;
    }
    if (!drawing.current || !draft.current) return;
    commitActions([...actions, draft.current]);
    // لا نحدد الخط تلقائيًا بعد الكتابة؛ التحديد يظهر فقط عند اختيار أداة التحديد.
    setSelectedId(null);
    setRedo([]);
    draft.current = null;
    drawing.current = false;
  };

  const undo = () => {
    if (!actions.length) return;
    const last = actions[actions.length - 1];
    commitActions(actions.slice(0, -1));
    setRedo((current) => [last, ...current]);
    setSelectedId(null);
  };

  const redoAction = () => {
    if (!redo.length) return;
    const [next, ...rest] = redo;
    commitActions([...actions, next]);
    setRedo(rest);
  };

  const addPage = () => {
    setPages((current) => [...current, { id: Date.now(), layers: {} }]);
    setPageIndex(pages.length);
    setRedo([]);
    setSelectedId(null);
  };

  const drawBackground = async (ctx) => {
    ctx.fillStyle = '#f4ecd9';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    if (!backgroundUrl || (['pdf', 'textbook'].includes(resource?.type) && !pdfPage.dataUrl)) return;
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = backgroundUrl; });
      const ratio = Math.min(BOARD_WIDTH / image.width, BOARD_HEIGHT / image.height);
      const drawWidth = image.width * ratio;
      const drawHeight = image.height * ratio;
      ctx.drawImage(image, (BOARD_WIDTH - drawWidth) / 2, (BOARD_HEIGHT - drawHeight) / 2, drawWidth, drawHeight);
    } catch {
      // The drawing layer remains exportable even if a remote image blocks canvas export.
    }
  };

  const makeBoardImage = async () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = BOARD_WIDTH;
    exportCanvas.height = BOARD_HEIGHT;
    const ctx = exportCanvas.getContext('2d');
    await drawBackground(ctx);
    actions.forEach((action) => drawAction(ctx, action, false));
    return exportCanvas.toDataURL('image/png');
  };

  const downloadBoard = async () => {
    const dataUrl = await makeBoardImage();
    const link = document.createElement('a');
    link.download = `سبورة-${currentSession?.title || 'الدرس'}-${todayISO()}-${pageIndex + 1}.png`;
    link.href = dataUrl;
    link.click();
    setNotice('تم حفظ صورة السبورة على الجهاز.');
  };

  const saveToPlatform = async () => {
    const dataUrl = await makeBoardImage();
    const asset = await importLegacyDataUrl(dataUrl, { name: `whiteboard-${Date.now()}.png`, kind: 'whiteboard' });
    const record = {
      id: Date.now(),
      title: resource?.title || currentSession?.title || 'شرح على السبورة',
      sessionId: currentSession?.id || null,
      group: currentSession?.group || '',
      resourceId: resource?.id || null,
      page: pageIndex + 1,
      resourcePage,
      layerKey,
      boardAssetId: asset?.id || '',
      actions,
      points,
      createdAt: new Date().toISOString(),
    };
    await updateData({ ...data, whiteboardRecords: [record, ...(data.whiteboardRecords || [])].slice(0, 100) });
    setNotice('تم حفظ السبورة وربطها بالحصة داخل المنصة.');
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await shellRef.current?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch {
      shellRef.current?.classList.toggle('css-fullscreen');
    }
  };

  const openLocalImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLocalImage(URL.createObjectURL(file));
    setLocalImageKey(`${file.name}:${file.size}:${file.lastModified}`);
    setNotice(`تم فتح الصورة: ${file.name}`);
    event.target.value = '';
  };

  return (
    <section className="page whiteboard-page" ref={shellRef}>
      <header className="whiteboard-reference-header">
        <div className="whiteboard-brand-flag">
          <img src={identity.logo || identity.icon} alt={identity.schoolName} />
          <div><strong>المُبدع</strong><small>لتعليم ممتع</small></div>
        </div>
        <div className="whiteboard-title-plaque"><span>شرح الدرس</span><small>{resource?.title || currentSession?.title || 'السبورة التفاعلية'}</small></div>
        <div className="whiteboard-teacher-card">
          <img src={identity.portrait} alt={identity.teacherName} />
          <div><strong>{identity.teacherName}</strong><small>{identity.teacherTitle}</small></div>
        </div>
      </header>

      <div className="whiteboard-reference-layout">
        <aside className="whiteboard-tool-rail">
          <button type="button" className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}><PenLine /><span>قلم حر</span></button>
          <button type="button" className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}><MousePointer2 /><span>تحديد دقيق</span></button>
          <button type="button" className={tool === 'highlighter' ? 'active' : ''} onClick={() => setTool('highlighter')}><Highlighter /><span>قلم تمييز</span></button>
          <button type="button" className={tool === 'shape' ? 'active' : ''} onClick={() => setTool('shape')}><Shapes /><span>مكتبة الأشكال</span></button>
          <button type="button" className={tool === 'text' ? 'active' : ''} onClick={() => setTool('text')}><Type /><span>نص توضيحي</span></button>
          <button type="button" className={tool === 'move' ? 'active' : ''} onClick={() => setTool('move')}><Move /><span>تحريك العناصر</span></button>
          <button type="button" className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}><Eraser /><span>الممحاة الذكية</span></button>
          <button type="button" onClick={() => fileRef.current?.click()}><ImagePlus /><span>إدراج صورة</span></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={openLocalImage} />
          <div className="whiteboard-rail-divider" />
          <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.1))}><ZoomIn /><span>تكبير اللوحة</span></button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}><ZoomOut /><span>تصغير اللوحة</span></button>
          <button type="button" onClick={undo} disabled={!actions.length}><Undo2 /><span>تراجع خطوة</span></button>
          <button type="button" onClick={redoAction} disabled={!redo.length}><Redo2 /><span>إعادة خطوة</span></button>
          <button type="button" onClick={saveToPlatform}><Save /><span>حفظ اللوحة</span></button>
          <button type="button" onClick={() => { commitActions([]); setRedo([]); setSelectedId(null); }}><RotateCcw /><span>تنظيف اللوحة</span></button>
        </aside>

        <main className="whiteboard-paper-stage">
          <div className="whiteboard-resource-strip">
            <label><FileImage size={16} /><select value={resourceId} onChange={(event) => { setResourceId(event.target.value); setLocalImage(''); setLocalImageKey(''); setResourcePage(1); }}><option value="">سبورة فارغة</option>{resources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            {['pdf', 'textbook'].includes(resource?.type) && <div className="whiteboard-pdf-nav"><button type="button" onClick={() => setResourcePage((value) => Math.max(1, value - 1))} disabled={resourcePage <= 1}>‹</button><span>صفحة {resourcePage}{pdfPage.pageCount ? ` / ${pdfPage.pageCount}` : ''}</span><button type="button" onClick={() => setResourcePage((value) => pdfPage.pageCount ? Math.min(pdfPage.pageCount, value + 1) : value + 1)} disabled={Boolean(pdfPage.pageCount && resourcePage >= pdfPage.pageCount)}>›</button></div>}
            <div className="whiteboard-shape-picker" aria-label="مكتبة الأشكال التعليمية">
              <button type="button" className={shape === 'rect' ? 'active' : ''} onClick={() => { setShape('rect'); setTool('shape'); }} title="إطار توضيحي"><Square size={16} /></button>
              <button type="button" className={shape === 'circle' ? 'active' : ''} onClick={() => { setShape('circle'); setTool('shape'); }} title="دائرة مفاهيم"><Circle size={16} /></button>
              <button type="button" className={shape === 'triangle' ? 'active' : ''} onClick={() => { setShape('triangle'); setTool('shape'); }} title="هرم معرفي"><Triangle size={16} /></button>
              <button type="button" className={shape === 'diamond' ? 'active' : ''} onClick={() => { setShape('diamond'); setTool('shape'); }} title="معيّن تصنيفي"><Diamond size={16} /></button>
              <button type="button" className={shape === 'line' ? 'active' : ''} onClick={() => { setShape('line'); setTool('shape'); }} title="خط رابط"><PenLine size={16} /></button>
              <button type="button" className={shape === 'arrow' ? 'active' : ''} onClick={() => { setShape('arrow'); setTool('shape'); }} title="سهم توجيهي"><ArrowLeft size={16} /></button>
            </div>
            <div className="whiteboard-style-pickers">
              <label title="طراز الخط"><span>الخط</span><select value={lineStyle} onChange={(event) => setLineStyle(event.target.value)}>{lineStyles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label title="نوع الخط العربي"><span>الكتابة</span><select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>{boardFonts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label title="حجم النص"><span>الحجم</span><select value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))}><option value="28">28</option><option value="34">34</option><option value="42">42</option><option value="52">52</option></select></label>
            </div>
          </div>
          <div className="whiteboard-canvas-viewport">
            <div className="whiteboard-canvas-stack" style={{ transform: `scale(${zoom})` }}>
              {backgroundUrl && (localImage || resource?.type === 'image' || pdfPage.dataUrl) && <img src={backgroundUrl} alt={resource?.title || 'صورة الشرح'} className="whiteboard-background-media" />}
              {resourceUrl && ['pdf', 'textbook'].includes(resource?.type) && !pdfPage.dataUrl && <iframe src={`${resourceUrl}#page=${resourcePage}&toolbar=0&navpanes=0`} title={resource.title} className="whiteboard-background-media" />}
              {pdfPage.loading && <div className="whiteboard-pdf-loading">جارٍ تجهيز صفحة PDF للكتابة...</div>}
              <canvas
                ref={canvasRef}
                width={BOARD_WIDTH}
                height={BOARD_HEIGHT}
                className="whiteboard-drawing-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerLeave={(event) => { if (drawing.current) onPointerUp(event); }}
              />
            </div>
          </div>
          <div className="whiteboard-bottom-toolbar">
            <div className="whiteboard-stroke-controls">
              {colors.map((item) => <button key={item} type="button" className={color === item ? 'active' : ''} style={{ background: item }} onClick={() => setColor(item)} aria-label={`اختيار اللون ${item}`} />)}
              <select value={width} onChange={(event) => setWidth(Number(event.target.value))}><option value="3">رفيع</option><option value="5">متوسط</option><option value="8">عريض</option><option value="12">عريض جدًا</option></select>
            </div>
            <div className="whiteboard-page-controls">
              <button type="button" disabled={pageIndex === 0} onClick={() => { setPageIndex((value) => Math.max(0, value - 1)); setSelectedId(null); }}><ArrowRight size={18} /></button>
              <span>{pageIndex + 1} / {pages.length}</span>
              <button type="button" disabled={pageIndex >= pages.length - 1} onClick={() => { setPageIndex((value) => Math.min(pages.length - 1, value + 1)); setSelectedId(null); }}><ArrowLeft size={18} /></button>
              <button type="button" onClick={addPage}><Plus size={17} /> صفحة جديدة</button>
            </div>
            <div className="whiteboard-view-controls">
              <button type="button" onClick={() => setZoom(1)}>100%</button>
              <button type="button" onClick={downloadBoard}><Download size={18} /></button>
              <button type="button" onClick={toggleFullscreen}><Maximize2 size={18} /></button>
              {selectedId && <button type="button" className="danger" onClick={() => { commitActions(actions.filter((action) => action.id !== selectedId)); setSelectedId(null); }}><Trash2 size={17} /></button>}
            </div>
          </div>
          {notice && <button type="button" className="whiteboard-notice" onClick={() => setNotice('')}>{notice}</button>}
        </main>

        <aside className="whiteboard-students-panel">
          <div className="whiteboard-students-head"><strong>الطلاب والنقاط</strong><small>{students.length} طالبًا</small></div>
          <div className="whiteboard-students-list">
            {ranked.map((student, index) => (
              <div key={student.id}>
                <span>{index + 1}</span>
                <strong>{student.name}</strong>
                <b>{student.points}</b>
                <button type="button" onClick={() => setPoints((current) => ({ ...current, [student.id]: (current[student.id] || 0) + 5 }))}><Plus size={15} /></button>
              </div>
            ))}
          </div>
          <div className="whiteboard-motto"><BookOpenIcon /><strong>التعليم اليوم</strong><span>يصنع مستقبلًا أفضل</span></div>
        </aside>
      </div>

      <footer className="whiteboard-reference-footer">
        <button type="button" onClick={() => navigate('dashboard')}><ArrowRight size={17} /> خروج من السبورة</button>
        <span>{formatDateAr(todayISO())}</span>
        <button type="button" onClick={saveToPlatform}><Save size={17} /> حفظ وربط بالحصة</button>
      </footer>
    </section>
  );
}

function BookOpenIcon() {
  return <span className="whiteboard-book-mark">✦</span>;
}
