import { useEffect, useMemo, useRef, useState } from 'react';
import worldCountries from '../../data/world-countries.json';
import {
  Compass,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  Layers3,
  SlidersHorizontal,
  MapPin,
  PenLine,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Type,
  Undo2,
  Volume2,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import ProfessionalMap, { GeographyGlyph } from './ProfessionalMap';
import { normalizeLessonMapState, normalizeMapRegionSnapshot } from '../../services/lessonMapState';
import {
  GEOGRAPHY_LAYERS,
  GEOGRAPHY_REGIONS,
  GEOGRAPHY_SYMBOL_GROUPS,
  createMapProjector,
  getGradeMapRecommendation,
  getRegionCountries,
  getRegionLayerItems,
} from '../../data/geography';
import {
  MAP_RIVER_LINES,
  NILE_BASIN_ISO,
  NILE_POINTS,
  countryInfo,
  featureInfo,
} from '../../data/mapEnrichment';

const CORE_REGION_KEYS = ['egypt', 'arab', 'africa', 'asia', 'europe', 'northAmerica', 'southAmerica', 'australia', 'world'];

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
  const [mapStyle, setMapStyle] = useState('relief');
  const [silentMap, setSilentMap] = useState(false);
  const [zoom, setZoom] = useState(initial.zoom);
  const [placements, setPlacements] = useState(initial.placements);
  const [strokes, setStrokes] = useState(initial.strokes);
  const [selectedId, setSelectedId] = useState(initial.selectedCountryId || initial.selectedPlaceId);
  const [selectedName, setSelectedName] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState('');
  const [symbolGroup, setSymbolGroup] = useState(GEOGRAPHY_SYMBOL_GROUPS[0].id);
  const [drawTool, setDrawTool] = useState('select');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [search, setSearch] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mapControlsOpen, setMapControlsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [nileMode, setNileMode] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const latestStateRef = useRef(null);
  const latestDirtyRef = useRef(false);
  const changeVersionRef = useRef(0);
  const saveCallbackRef = useRef(onSaveState);
  const symbolPointerRef = useRef(null);

  saveCallbackRef.current = onSaveState;
  latestDirtyRef.current = dirty;

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
    setSelectedEntity(null);
    setSelectedPlacementId('');
    setNileMode(false);
    changeVersionRef.current = 0;
    latestDirtyRef.current = false;
    setDirty(false);
  }, [lesson?.id, grade]);

  useEffect(() => drawStrokes(canvasRef.current, strokes), [strokes, regionKey, layerKey, zoom]);

  const region = GEOGRAPHY_REGIONS[regionKey] || GEOGRAPHY_REGIONS.world;
  const project = useMemo(() => createMapProjector(regionKey), [regionKey]);
  const countries = useMemo(() => getRegionCountries(geo, regionKey), [geo, regionKey]);
  const items = useMemo(() => getRegionLayerItems(geo, regionKey, layerKey), [geo, regionKey, layerKey]);
  const riverLines = useMemo(() => nileMode ? MAP_RIVER_LINES.africa : (MAP_RIVER_LINES[regionKey] || []), [regionKey, nileMode]);
  const nilePoints = nileMode ? NILE_POINTS : [];
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
    changeVersionRef.current += 1;
    latestDirtyRef.current = true;
    setDirty(true);
  };

  const selectLocation = (id, name, item = null) => {
    setSelectedId(id);
    setSelectedName(name);
    if (item?.geometry) setSelectedEntity({ type: 'country', ...countryInfo(item) });
    else if (item) setSelectedEntity({ type: 'feature', ...featureInfo(item, layerKey), raw: item });
  };

  const speakSelectedEntity = () => {
    if (!selectedEntity || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text = selectedEntity.type === 'country'
      ? `${selectedEntity.name}. العاصمة ${selectedEntity.capital}. ${selectedEntity.fact}`
      : `${selectedEntity.name}. ${selectedEntity.fact}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-EG';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  };

  const addPlacement = (item, x, y) => {
    if (!item) return;
    const placement = {
      ...item,
      type: item.id,
      id: `${item.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      size: Number(item.size || 1),
    };
    setPlacements((current) => [...current, placement]);
    setSelectedPlacementId(placement.id);
    setSelectedSymbol(null);
    if (item.id !== 'custom-label') setToolsOpen(false);
    markDirty();
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
      addPlacement({ id: 'custom-label', label: customLabel.trim(), hint: '', symbol: '✎', color: drawColor, showLabel: true }, point.x, point.y);
      setCustomLabel('');
      return;
    }
    setSelectedPlacementId('');
  };

  const handleLocationClick = (id, name, item, event) => {
    if (drawTool === 'select' && selectedSymbol && event) {
      const point = stagePointPercent(event);
      addPlacement(selectedSymbol, point.x, point.y);
      return;
    }
    selectLocation(id, name, item);
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

  const startSymbolPointer = (event, item) => {
    setDrawTool('select');
    setSelectedSymbol(item);
    if (event.pointerType === 'mouse') return;
    symbolPointerRef.current = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      scrolling: false,
    };
  };

  useEffect(() => {
    const move = (event) => {
      const pending = symbolPointerRef.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      const dx = event.clientX - pending.startX;
      const dy = event.clientY - pending.startY;
      if (!pending.dragging && !pending.scrolling) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.15) {
          pending.scrolling = true;
          return;
        }
        if (Math.hypot(dx, dy) > 18) pending.dragging = true;
      }
    };
    const finish = (event) => {
      const pending = symbolPointerRef.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      symbolPointerRef.current = null;
      if (!pending.dragging || pending.scrolling) return;
      const stage = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.map-pro-stage');
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      addPlacement(
        pending.item,
        ((event.clientX - rect.left) / rect.width) * 100,
        ((event.clientY - rect.top) / rect.height) * 100,
      );
      setToolsOpen(false);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', finish, { passive: true });
    window.addEventListener('pointercancel', finish, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

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
    selectedCountryId: ['countries', 'borders', 'population'].includes(layerKey) ? selectedId : '',
    selectedPlaceId: !['countries', 'borders', 'population'].includes(layerKey) ? selectedId : '',
    zoom,
    placements,
    strokes,
  });

  const activeSnapshot = currentRegionSnapshot();
  const persistableState = {
    regionKey,
    regions: { ...regionStates, [regionKey]: activeSnapshot },
    ...activeSnapshot,
  };
  latestStateRef.current = persistableState;

  useEffect(() => {
    if (!dirty || !lesson?.id || !saveCallbackRef.current) return undefined;
    const scheduledVersion = changeVersionRef.current;
    const timer = window.setTimeout(() => {
      const state = latestStateRef.current;
      Promise.resolve(saveCallbackRef.current?.(state))
        .then(() => {
          setRegionStates(state?.regions || {});
          if (changeVersionRef.current === scheduledVersion) {
            latestDirtyRef.current = false;
            setDirty(false);
          }
        })
        .catch(() => setNotice('تعذر الحفظ التلقائي للخريطة — استخدم زر حفظ.'));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, lesson?.id, regionKey, labels, zoom, placements, strokes, selectedId, layerKey]);

  useEffect(() => () => {
    if (!lesson?.id || !latestDirtyRef.current || !saveCallbackRef.current || !latestStateRef.current) return;
    // Switching from maps to another Class Mode surface unmounts this studio.
    // Persist the newest snapshot so opening PDF/image/video never discards map work.
    void Promise.resolve(saveCallbackRef.current(latestStateRef.current)).catch(() => {});
  }, [lesson?.id]);

  const loadRegionSnapshot = (snapshot, activeLayer = layerKey) => {
    const normalized = normalizeMapRegionSnapshot(snapshot);
    setLabels(normalized.labels);
    setZoom(normalized.zoom);
    setPlacements(normalized.placements);
    setStrokes(normalized.strokes);
    setSelectedId(['countries', 'borders', 'population'].includes(activeLayer) ? normalized.selectedCountryId : normalized.selectedPlaceId);
    setSelectedName('');
    setSelectedEntity(null);
    setSelectedSymbol(null);
    setSelectedPlacementId('');
  };

  const changeRegion = (key) => {
    if (!GEOGRAPHY_REGIONS[key] || key === regionKey) return;
    const nextStates = { ...regionStates, [regionKey]: currentRegionSnapshot() };
    setRegionStates(nextStates);
    setRegionKey(key);
    setNileMode(false);
    loadRegionSnapshot(nextStates[key] || {});
    markDirty();
  };

  const toggleNileLesson = () => {
    const next = !nileMode;
    setNileMode(next);
    if (next && regionKey !== 'africa') {
      const nextStates = { ...regionStates, [regionKey]: currentRegionSnapshot() };
      setRegionStates(nextStates);
      setRegionKey('africa');
      loadRegionSnapshot(nextStates.africa || {}, 'rivers');
    }
    if (next) {
      setLayerKey('rivers');
      setSilentMap(false);
      setMapStyle('atlas');
      setLabels(true);
      setSelectedEntity({ type:'feature', name:'حوض نهر النيل', kind:'river', fact:'وضع تعليمي خاص يعرض مجرى النيل الرئيسي والنيل الأبيض والنيل الأزرق ونهر عطبرة والبحيرات والسدود ودول الحوض.' });
    } else {
      setSelectedEntity(null);
    }
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
    const state = latestStateRef.current || persistableState;
    const nextRegions = state.regions;
    const saveVersion = changeVersionRef.current;
    await onSaveState?.(state);
    setRegionStates(nextRegions);
    if (changeVersionRef.current === saveVersion) {
      latestDirtyRef.current = false;
      setDirty(false);
      setNotice('تم الحفظ.');
      window.setTimeout(() => setNotice(''), 1600);
    }
  };

  const resetMap = () => {
    setZoom(1);
    setSelectedId('');
    setSelectedName('');
    setSelectedEntity(null);
    setPlacements([]);
    setStrokes([]);
    setSelectedSymbol(null);
    setSelectedPlacementId('');
    markDirty();
  };

  return (
    <div className={`lesson-map-studio lesson-map-studio-v5 ${toolsOpen ? 'tools-open symbols-open' : 'tools-closed'} ${mapControlsOpen ? 'map-controls-open' : ''}`}>
      {toolsOpen && (
        <aside className="lesson-map-symbol-sidebar lesson-map-drawer lesson-map-drawer-symbols">
          <div className="lesson-map-drawer-head">
            <div className="lesson-map-sidebar-title"><Layers3 size={19}/><div><strong>رموز الخريطة</strong><small>19 تصنيفًا • 181 رمزًا — اختر التصنيف ثم اسحب الرمز إلى الخريطة</small></div></div>
            <button type="button" className="icon-action" onClick={() => setToolsOpen(false)} aria-label="إغلاق الرموز">×</button>
          </div>
          <div className="lesson-map-group-tabs" aria-label="تصنيفات رموز الخرائط">
            {GEOGRAPHY_SYMBOL_GROUPS.map((group) => <button key={group.id} type="button" className={symbolGroup === group.id ? 'active' : ''} onClick={() => setSymbolGroup(group.id)}>{group.label}</button>)}
          </div>
          <div className="lesson-map-active-group-heading"><strong>{activeGroup.label}</strong><small>{activeGroup.items.length} رمز</small></div>
          <div className="lesson-map-symbol-scroll">
            <div className="lesson-map-symbol-list">
              {activeGroup.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedSymbol?.id === item.id ? 'active' : ''}
                  style={{ '--symbol-color': item.color }}
                  onPointerDown={(event) => startSymbolPointer(event, item)}
                  onPointerCancel={() => { symbolPointerRef.current = null; }}
                  onClick={() => { setDrawTool('select'); setSelectedSymbol(item); }}
                >
                  <b className="lesson-map-symbol-preview"><GeographyGlyph type={item.id} symbol={item.symbol} /></b>
                  <span><strong>{item.label}</strong><small>{item.hint}</small></span>
                </button>
              ))}
            </div>
            <div className="lesson-map-custom-label">
              <Type size={16}/><input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="اسم مكان أو ملاحظة" />
              <button type="button" onClick={() => { if (customLabel.trim()) { setDrawTool('select'); setSelectedSymbol(null); } }}>وضع</button>
            </div>
            {placements.length > 0 && (
              <div className="lesson-map-placed-list">
                <strong>العناصر الموضوعة ({placements.length})</strong>
                {placements.slice().reverse().map((item) => <button key={item.id} type="button" onClick={() => { setPlacements((current) => current.filter((entry) => entry.id !== item.id)); setSelectedPlacementId((current) => current === item.id ? '' : current); markDirty(); }}><span><GeographyGlyph type={item.type} symbol={item.symbol}/> {item.label}</span><Trash2 size={14}/></button>)}
              </div>
            )}
          </div>
        </aside>
      )}

      {mapControlsOpen && (
        <aside className="lesson-map-drawer lesson-map-drawer-controls">
          <div className="lesson-map-drawer-head">
            <div className="lesson-map-sidebar-title"><Compass size={19}/><div><strong>الخرائط والتحديد</strong><small>الخريطة، الطبقات، المعلومات والبحث</small></div></div>
            <button type="button" className="icon-action" onClick={() => setMapControlsOpen(false)} aria-label="إغلاق أدوات الخرائط">×</button>
          </div>
          <div className="lesson-map-controls-scroll">
            <section className="lesson-map-control-section">
              <label>الخريطة</label>
              <div className="lesson-map-region-grid" aria-label="الخرائط الأساسية">
                {CORE_REGION_KEYS.map((key) => {
                  const item = GEOGRAPHY_REGIONS[key];
                  return (
                    <button key={key} type="button" className={`${regionKey === key ? 'active' : ''} ${recommendation.recommended.includes(key) ? 'recommended' : ''}`} onClick={() => changeRegion(key)}>
                      <span className={`region-mini-map region-${key}`} aria-hidden="true" />
                      <strong>{item.title}</strong>
                      <small>{key === 'world' ? 'خريطة العالم كاملة' : item.subtitle}</small>
                    </button>
                  );
                })}
              </div>

            </section>
            <section className="lesson-map-control-section">
              <label>شكل الخريطة</label>
              <div className="lesson-map-presentation-tabs">
                <button type="button" className={!silentMap && mapStyle === 'relief' ? 'active' : ''} onClick={() => { setSilentMap(false); setMapStyle('relief'); }}>طبيعية مجسمة</button>
                <button type="button" className={!silentMap && mapStyle === 'atlas' ? 'active' : ''} onClick={() => { setSilentMap(false); setMapStyle('atlas'); }}>أطلس تعليمي</button>
                <button type="button" className={silentMap ? 'active' : ''} onClick={() => { setSilentMap(true); setLabels(false); }}>خريطة صماء</button>
              </div>
              <small className="lesson-map-silent-help">الخريطة الصماء تعرض شكل اليابس والمياه فقط لتشرح وتكتب عليها بنفسك.</small>
            </section>
            <section className="lesson-map-control-section lesson-map-nile-section">
              <label>درس نهر النيل</label>
              <button type="button" className={`lesson-map-nile-toggle ${nileMode ? 'active' : ''}`} onClick={toggleNileLesson}>
                <Waves size={18}/><span><strong>{nileMode ? 'إغلاق وضع نهر النيل' : 'فتح خريطة نهر النيل التفصيلية'}</strong><small>المجرى والروافد ودول الحوض والبحيرات والسدود</small></span>
              </button>
            </section>
            <section className="lesson-map-control-section">
              <label>الطبقات والتحديد</label>
              <div className="lesson-map-layer-tabs">
                {Object.entries(GEOGRAPHY_LAYERS).map(([key, item]) => <button key={key} type="button" className={layerKey === key ? 'active' : ''} onClick={() => { setLayerKey(key); setSelectedId(''); setSelectedName(''); }}>{item.title}</button>)}
              </div>
            </section>

            <section className="lesson-map-control-section">
              <label>بحث سريع</label>
              <div className="lesson-map-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="دولة، جبل، نهر، عاصمة…" />
                {searchResults.length > 0 && <div className="lesson-map-search-results">{searchResults.map((item) => <button key={`${item.layer}:${item.id}`} type="button" onClick={() => { setLayerKey(item.layer); selectLocation(item.id, item.name, item); setSearch(''); }}>{item.name}<small>{GEOGRAPHY_LAYERS[item.layer]?.title}</small></button>)}</div>}
              </div>
            </section>
            <div className="lesson-map-control-summary">
              <strong>{selectedName || `خريطة ${region.title}`}</strong>
              <small>{region.subtitle} • {items.length} عنصر</small>
              {notice && <em>{notice}</em>}
            </div>
          </div>
        </aside>
      )}

      <div className="lesson-map-main lesson-map-main-v5">
        <div className="lesson-map-floating-drawers">
          <button type="button" className={`lesson-map-drawer-toggle symbols ${toolsOpen ? 'active' : ''}`} onClick={() => { setToolsOpen((value) => !value); setMapControlsOpen(false); }} aria-expanded={toolsOpen}>
            <Layers3 size={19}/><span>الرموز</span>
          </button>
          <button type="button" className={`lesson-map-drawer-toggle controls ${mapControlsOpen ? 'active' : ''}`} onClick={() => { setMapControlsOpen((value) => !value); setToolsOpen(false); }} aria-expanded={mapControlsOpen}>
            <SlidersHorizontal size={19}/><span>الخرائط والتحديد</span>
          </button>
        </div>
        <div className="lesson-map-quick-drawbar" role="toolbar" aria-label="أدوات الشرح على الخريطة">
          <button type="button" className={drawTool === 'select' ? 'active' : ''} onClick={() => setDrawTool('select')} title="تحديد ووضع عناصر"><MapPin size={17}/></button>
          <button type="button" className={drawTool === 'pen' ? 'active' : ''} onClick={() => setDrawTool('pen')} title="قلم"><PenLine size={17}/></button>
          <button type="button" className={drawTool === 'highlighter' ? 'active' : ''} onClick={() => setDrawTool('highlighter')} title="هايلايتر"><Highlighter size={17}/></button>
          <button type="button" className={drawTool === 'eraser' ? 'active' : ''} onClick={() => setDrawTool('eraser')} title="ممحاة"><Eraser size={17}/></button>
          <input type="color" value={drawColor} onChange={(event) => setDrawColor(event.target.value)} title="لون الرسم"/>
          <input className="lesson-map-stroke-range" type="range" min="2" max="16" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} title="سمك القلم"/>
          <button type="button" onClick={() => { setStrokes((current) => current.slice(0, -1)); markDirty(); }} disabled={!strokes.length} title="تراجع"><Undo2 size={16}/></button>
          <button type="button" onClick={() => setLabels((value) => { markDirty(); return !value; })} title="إظهار الأسماء">{labels ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
          <button type="button" onClick={() => changeZoom(0.1)} title="تكبير"><ZoomIn size={16}/></button>
          <button type="button" onClick={() => changeZoom(-0.1)} title="تصغير"><ZoomOut size={16}/></button>
          <button type="button" onClick={resetMap} title="إعادة"><RotateCcw size={16}/></button>
          <button type="button" className={dirty ? 'save-needed' : ''} onClick={() => void save()} title="حفظ"><Save size={16}/></button>
        </div>
        <div className="lesson-map-canvas-shell lesson-map-canvas-shell-v5">
          {!geo && <div className="map-game-loading">جارٍ تجهيز الخريطة التعليمية…</div>}
          <ProfessionalMap
            countries={countries}
            items={items}
            region={region}
            layerKey={layerKey}
            labels={labels}
            selectedId={selectedId}
            project={project}
            zoom={zoom}
            placements={placements}
            selectedPlacementId={selectedPlacementId}
            onSelectPlacement={setSelectedPlacementId}
            onCountryClick={handleLocationClick}
            onFeatureClick={handleLocationClick}
            onDropPlacement={handleDrop}
            onMovePlacement={(id, x, y) => {
              setPlacements((current) => current.map((item) => item.id === id ? { ...item, x, y } : item));
              setSelectedPlacementId(id);
              markDirty();
            }}
            onResizePlacement={(id, delta) => {
              setPlacements((current) => current.map((item) => item.id === id
                ? { ...item, size: Math.max(0.5, Math.min(2.5, Number(((item.size || 1) + delta).toFixed(2)))) }
                : item));
              setSelectedPlacementId(id);
              markDirty();
            }}
            onRemovePlacement={(id) => {
              setPlacements((current) => current.filter((item) => item.id !== id));
              setSelectedPlacementId((current) => current === id ? '' : current);
              markDirty();
            }}
            onStageClick={handleStageClick}
            canvasRef={canvasRef}
            drawTool={drawTool}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            ariaLabel={`خريطة ${region.title} للشرح داخل الحصة`}
            mapStyle={mapStyle}
            silent={silentMap}
            lineFeatures={riverLines}
            pointFeatures={nilePoints}
            highlightCountryIsos={nileMode ? NILE_BASIN_ISO : []}
          />
        </div>
        {selectedEntity && (
          <aside className={`lesson-map-info-card type-${selectedEntity.type}`} aria-live="polite">
            <button type="button" className="lesson-map-info-close" onClick={() => { setSelectedEntity(null); setSelectedId(''); setSelectedName(''); }} aria-label="إغلاق المعلومات">×</button>
            <div className="lesson-map-info-visual">
              {selectedEntity.type === 'country'
                ? <span className="lesson-map-country-flag" aria-hidden="true">{selectedEntity.flag}</span>
                : selectedEntity.photo
                  ? <img src={selectedEntity.photo} alt={selectedEntity.name} />
                  : <GeographyGlyph type={selectedEntity.kind} symbol="●" />}
            </div>
            <div className="lesson-map-info-copy">
              <small>{selectedEntity.type === 'country' ? 'دولة' : nileMode ? 'حوض نهر النيل' : 'معلومة جغرافية'}</small>
              <strong>{selectedEntity.name}</strong>
              {selectedEntity.type === 'country' && <span>العاصمة: <b>{selectedEntity.capital}</b></span>}
              <p>{selectedEntity.fact}</p>
            </div>
            <button type="button" className="lesson-map-info-speak" onClick={speakSelectedEntity} title="استمع للمعلومة"><Volume2 size={18}/><span>استمع</span></button>
          </aside>
        )}
        {nileMode && <div className="lesson-map-nile-badge"><Waves size={16}/><span>وضع نهر النيل</span></div>}
        {selectedName && !selectedEntity && <div className="lesson-map-selected-chip"><MapPin size={15}/><span>{selectedName}</span></div>}
      </div>
    </div>
  );
}
