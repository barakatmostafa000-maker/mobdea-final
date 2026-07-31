import { useEffect, useMemo, useRef, useState } from 'react';
import worldCountries from '../../data/world-countries.json';
import {
  CheckCircle2,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  Layers3,
  MapPin,
  PenLine,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import ProfessionalMap, { GeographyGlyph } from './ProfessionalMap';
import { normalizeLessonMapState, normalizeMapRegionSnapshot } from '../../services/lessonMapState';
import {
  GEOGRAPHY_FEATURES,
  GEOGRAPHY_LAYERS,
  GEOGRAPHY_REGIONS,
  GEOGRAPHY_SYMBOL_GROUPS,
  createMapProjector,
  getGradeMapRecommendation,
  getRegionCountries,
  getRegionLayerItems,
} from '../../data/geography';

function drawStrokes(canvas, strokes = []) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 1000, 620);
  strokes.forEach((stroke) => {
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalAlpha = stroke.tool === 'highlighter' ? 0.3 : 1;
    context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = stroke.color || '#ef4444';
    context.lineWidth = stroke.tool === 'eraser' ? 30 : stroke.tool === 'highlighter' ? 18 : stroke.width || 5;
    context.beginPath();
    (stroke.points || []).forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.stroke();
    context.restore();
  });
}

export default function LessonMapStudio({ grade = '', lesson = null, onSaveState }) {
  const recommendation = useMemo(() => getGradeMapRecommendation(grade), [grade]);
  const initial = useMemo(() => normalizeLessonMapState(lesson?.mapState, grade), [lesson?.id, grade]);
  const [geo] = useState(worldCountries);
  const [regionKey, setRegionKey] = useState(initial.regionKey);
  const [regionStates, setRegionStates] = useState(initial.regions);
  const [layerKey, setLayerKey] = useState('countries');
  const [labels, setLabels] = useState(initial.labels);
  const [zoom, setZoom] = useState(initial.zoom);
  const [placements, setPlacements] = useState(initial.placements);
  const [strokes, setStrokes] = useState(initial.strokes);
  const [selectedId, setSelectedId] = useState(initial.selectedCountryId || initial.selectedPlaceId);
  const [selectedName, setSelectedName] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [symbolGroup, setSymbolGroup] = useState(GEOGRAPHY_SYMBOL_GROUPS[0].id);
  const [drawTool, setDrawTool] = useState('select');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [search, setSearch] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  useEffect(() => {
    const next = normalizeLessonMapState(lesson?.mapState, grade);
    setRegionKey(next.regionKey);
    setRegionStates(next.regions);
    setLabels(next.labels);
    setZoom(next.zoom);
    setPlacements(next.placements);
    setStrokes(next.strokes);
    setSelectedId(next.selectedCountryId || next.selectedPlaceId);
    setSelectedName('');
    setDirty(false);
  }, [lesson?.id, grade]);

  useEffect(() => drawStrokes(canvasRef.current, strokes), [strokes, regionKey, layerKey, zoom]);

  const region = GEOGRAPHY_REGIONS[regionKey] || GEOGRAPHY_REGIONS.world;
  const project = useMemo(() => createMapProjector(regionKey), [regionKey]);
  const countries = useMemo(() => getRegionCountries(geo, regionKey), [geo, regionKey]);
  const items = useMemo(() => getRegionLayerItems(geo, regionKey, layerKey), [geo, regionKey, layerKey]);
  const activeGroup = GEOGRAPHY_SYMBOL_GROUPS.find((group) => group.id === symbolGroup) || GEOGRAPHY_SYMBOL_GROUPS[0];
  const searchable = useMemo(() => [
    ...getRegionLayerItems(geo, regionKey, 'countries').map((item) => ({ ...item, layer: 'countries' })),
    ...Object.keys(GEOGRAPHY_LAYERS).filter((key) => key !== 'countries').flatMap((key) => getRegionLayerItems(geo, regionKey, key).map((item) => ({ ...item, layer: key }))),
  ], [geo, regionKey]);
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return searchable.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 8);
  }, [search, searchable]);

  const markDirty = () => {
    setDirty(true);
    setNotice('توجد تغييرات غير محفوظة.');
  };

  const selectLocation = (id, name) => {
    setSelectedId(id);
    setSelectedName(name);
    setNotice(`تم تحديد: ${name}`);
  };

  const addPlacement = (item, x, y) => {
    if (!item) return;
    const placement = {
      ...item,
      type: item.id,
      id: `${item.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
    setPlacements((current) => [...current, placement]);
    setSelectedSymbol(null);
    markDirty();
    setNotice(`تم وضع ${item.label} على الخريطة.`);
  };

  const stagePointPercent = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handleStageClick = (event) => {
    if (drawTool !== 'select') return;
    const point = stagePointPercent(event);
    if (selectedSymbol) {
      addPlacement(selectedSymbol, point.x, point.y);
      return;
    }
    if (customLabel.trim()) {
      addPlacement({ id: 'custom-label', label: customLabel.trim(), hint: '', symbol: '✎', color: drawColor }, point.x, point.y);
      setCustomLabel('');
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const item = JSON.parse(event.dataTransfer.getData('application/json'));
      const point = stagePointPercent(event);
      addPlacement(item, point.x, point.y);
    } catch {
      setNotice('تعذر وضع الشكل في هذا الموضع.');
    }
  };

  const mapPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return { x: ((source.clientX - rect.left) / rect.width) * 1000, y: ((source.clientY - rect.top) / rect.height) * 620 };
  };

  const onPointerDown = (event) => {
    if (!['pen', 'highlighter', 'eraser'].includes(drawTool)) return;
    event.preventDefault();
    drawingRef.current = true;
    currentStrokeRef.current = {
      id: `stroke:${Date.now()}`,
      tool: drawTool,
      color: drawColor,
      width: strokeWidth,
      points: [mapPoint(event)],
    };
  };

  const onPointerMove = (event) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    event.preventDefault();
    currentStrokeRef.current.points.push(mapPoint(event));
    drawStrokes(canvasRef.current, [...strokes, currentStrokeRef.current]);
  };

  const onPointerUp = () => {
    if (drawingRef.current && currentStrokeRef.current) {
      setStrokes((current) => [...current, currentStrokeRef.current]);
      markDirty();
    }
    drawingRef.current = false;
    currentStrokeRef.current = null;
  };

  const currentRegionSnapshot = () => ({
    labels,
    selectedCountryId: layerKey === 'countries' ? selectedId : '',
    selectedPlaceId: layerKey !== 'countries' ? selectedId : '',
    zoom,
    placements,
    strokes,
  });

  const loadRegionSnapshot = (snapshot, activeLayer = layerKey) => {
    const normalized = normalizeMapRegionSnapshot(snapshot);
    setLabels(normalized.labels);
    setZoom(normalized.zoom);
    setPlacements(normalized.placements);
    setStrokes(normalized.strokes);
    setSelectedId(activeLayer === 'countries' ? normalized.selectedCountryId : normalized.selectedPlaceId);
    setSelectedName('');
    setSelectedSymbol(null);
  };

  const changeRegion = (key) => {
    if (!GEOGRAPHY_REGIONS[key] || key === regionKey) return;
    const nextStates = { ...regionStates, [regionKey]: currentRegionSnapshot() };
    setRegionStates(nextStates);
    setRegionKey(key);
    loadRegionSnapshot(nextStates[key] || {});
    markDirty();
    setNotice(`تم فتح خريطة ${GEOGRAPHY_REGIONS[key].title}. سيظل شرح الخريطة السابقة محفوظًا عند حفظ الدرس.`);
  };

  const changeZoom = (delta) => {
    setZoom((value) => Math.max(1, Math.min(2.1, Number((value + delta).toFixed(2)))));
    markDirty();
  };

  const save = async () => {
    if (!lesson) {
      setNotice('اختر درسًا من المكتبة أولًا حتى تُحفظ الخريطة داخله.');
      return;
    }
    const activeSnapshot = currentRegionSnapshot();
    const nextRegions = { ...regionStates, [regionKey]: activeSnapshot };
    const state = { regionKey, regions: nextRegions, ...activeSnapshot };
    await onSaveState?.(state);
    setRegionStates(nextRegions);
    setDirty(false);
    setNotice('تم حفظ الخريطة وأدوات الشرح داخل الدرس.');
  };

  const resetMap = () => {
    setZoom(1);
    setSelectedId('');
    setSelectedName('');
    setPlacements([]);
    setStrokes([]);
    setSelectedSymbol(null);
    markDirty();
  };

  return (
    <div className="lesson-map-studio">
      <aside className="lesson-map-symbol-sidebar">
        <div className="lesson-map-sidebar-title"><Layers3 size={18}/><div><strong>أدوات الشرح الجغرافي</strong><small>اسحب الشكل أو اختره ثم اضغط على الخريطة</small></div></div>
        <div className="lesson-map-group-tabs">
          {GEOGRAPHY_SYMBOL_GROUPS.map((group) => <button key={group.id} type="button" className={symbolGroup === group.id ? 'active' : ''} onClick={() => setSymbolGroup(group.id)}>{group.label}</button>)}
        </div>
        <div className="lesson-map-symbol-list">
          {activeGroup.items.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              className={selectedSymbol?.id === item.id ? 'active' : ''}
              style={{ '--symbol-color': item.color }}
              onClick={() => { setDrawTool('select'); setSelectedSymbol(item); setNotice(`اختر موضع ${item.label} على الخريطة.`); }}
              onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify(item))}
            >
              <b><GeographyGlyph type={item.id} symbol={item.symbol} /></b><span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          ))}
        </div>
        <div className="lesson-map-custom-label">
          <Type size={16}/><input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="اكتب اسم مكان أو ملاحظة" />
          <button type="button" onClick={() => { if (customLabel.trim()) { setDrawTool('select'); setSelectedSymbol(null); setNotice('اضغط على الخريطة لوضع النص.'); } }}>وضع</button>
        </div>
        <div className="lesson-map-placed-list">
          <strong>العناصر الموضوعة ({placements.length})</strong>
          {placements.slice(-8).reverse().map((item) => <button key={item.id} type="button" onClick={() => { setPlacements((current) => current.filter((entry) => entry.id !== item.id)); markDirty(); }}><span>{item.symbol} {item.label}</span><Trash2 size={14}/></button>)}
        </div>
      </aside>

      <div className="lesson-map-main">
        <div className="lesson-map-topbar">
          <div className="lesson-map-recommendation">
            <CheckCircle2 size={17}/><span><strong>الخريطة المقترحة للصف:</strong> {GEOGRAPHY_REGIONS[recommendation.defaultRegion].title}</span>
          </div>
          <div className="lesson-map-region-tabs">
            {Object.entries(GEOGRAPHY_REGIONS).map(([key, item]) => (
              <button key={key} type="button" className={`${regionKey === key ? 'active' : ''} ${recommendation.recommended.includes(key) ? 'recommended' : ''}`} onClick={() => changeRegion(key)}>{item.title}</button>
            ))}
          </div>
        </div>

        <div className="lesson-map-controlbar">
          <div className="lesson-map-layer-tabs">
            {Object.entries(GEOGRAPHY_LAYERS).map(([key, item]) => <button key={key} type="button" className={layerKey === key ? 'active' : ''} onClick={() => { setLayerKey(key); setSelectedId(''); }}>{item.title}</button>)}
          </div>
          <div className="lesson-map-draw-tools">
            <button type="button" className={drawTool === 'select' ? 'active' : ''} onClick={() => setDrawTool('select')} title="تحديد ووضع عناصر"><MapPin size={16}/></button>
            <button type="button" className={drawTool === 'pen' ? 'active' : ''} onClick={() => setDrawTool('pen')} title="قلم"><PenLine size={16}/></button>
            <button type="button" className={drawTool === 'highlighter' ? 'active' : ''} onClick={() => setDrawTool('highlighter')} title="تظليل"><Highlighter size={16}/></button>
            <button type="button" className={drawTool === 'eraser' ? 'active' : ''} onClick={() => setDrawTool('eraser')} title="ممحاة"><Eraser size={16}/></button>
            <input type="color" value={drawColor} onChange={(event) => setDrawColor(event.target.value)} title="لون الرسم"/>
            <input type="range" min="2" max="16" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} title="سمك القلم"/>
            <button type="button" onClick={() => { setStrokes((current) => current.slice(0, -1)); markDirty(); }} disabled={!strokes.length} title="تراجع"><Undo2 size={16}/></button>
            <button type="button" onClick={() => setLabels((value) => { markDirty(); return !value; })} title="إظهار أسماء الدول والمواقع">{labels ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
            <button type="button" onClick={() => changeZoom(0.1)} title="تكبير الخريطة"><ZoomIn size={16}/></button>
            <button type="button" onClick={() => changeZoom(-0.1)} title="تصغير الخريطة"><ZoomOut size={16}/></button>
            <button type="button" onClick={resetMap} title="إعادة الخريطة"><RotateCcw size={16}/></button>
            <button type="button" className={dirty ? 'save-needed' : ''} onClick={() => void save()}><Save size={16}/> حفظ</button>
          </div>
        </div>

        <div className="lesson-map-search-row">
          <div className="lesson-map-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن دولة أو جبل أو نهر أو عاصمة" />
            {searchResults.length > 0 && <div className="lesson-map-search-results">{searchResults.map((item) => <button key={`${item.layer}:${item.id}`} type="button" onClick={() => { setLayerKey(item.layer); selectLocation(item.id, item.name); setSearch(''); }}>{item.name}<small>{GEOGRAPHY_LAYERS[item.layer]?.title}</small></button>)}</div>}
          </div>
          <div className="lesson-map-selected-location"><MapPin size={16}/><span>{selectedName || `خريطة ${region.title} — اضغط على أي دولة أو ظاهرة لتحديدها`}</span></div>
        </div>

        <div className="lesson-map-canvas-shell">
          {!geo && <div className="map-game-loading">جارٍ تجهيز الخريطة التعليمية…</div>}
          <ProfessionalMap
            countries={countries}
            items={items}
            layerKey={layerKey}
            labels={labels}
            selectedId={selectedId}
            project={project}
            zoom={zoom}
            placements={placements}
            onCountryClick={selectLocation}
            onFeatureClick={selectLocation}
            onDropPlacement={handleDrop}
            onMovePlacement={(id, x, y) => {
              setPlacements((current) => current.map((item) => item.id === id ? { ...item, x, y } : item));
              markDirty();
            }}
            onRemovePlacement={(id) => {
              setPlacements((current) => current.filter((item) => item.id !== id));
              markDirty();
            }}
            onStageClick={handleStageClick}
            canvasRef={canvasRef}
            drawTool={drawTool}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            ariaLabel={`خريطة ${region.title} للشرح داخل الحصة`}
          />
        </div>
        <div className="lesson-map-footer-info">
          <span>{region.subtitle}</span>
          <span>{GEOGRAPHY_FEATURES[regionKey]?.[layerKey]?.length || countries.length} عنصر متاح</span>
          {notice && <strong>{notice}</strong>}
        </div>
      </div>
    </div>
  );
}
