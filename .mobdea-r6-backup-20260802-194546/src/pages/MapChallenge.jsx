import { useEffect, useMemo, useRef, useState } from 'react';
import worldCountries from '../data/world-countries.json';
import {
  BadgeCheck,
  BrainCircuit,
  ChevronLeft,
  Compass,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  Gamepad2,
  Gem,
  GraduationCap,
  Layers3,
  Lightbulb,
  MapPin,
  Medal,
  Mountain,
  PenLine,
  RotateCcw,
  Settings,
  SkipForward,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  UserRound,
  Users,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { identity } from '../config/identity';
import { encourageStudent } from '../services/voice';
import { calculateMapReward, shuffleMapItems } from '../utils/mapChallenge';
import ProfessionalMap, { GeographyGlyph } from '../components/maps/ProfessionalMap';
import {
  GEOGRAPHY_REGIONS,
  GEOGRAPHY_LAYERS,
  GEOGRAPHY_SYMBOLS,
  createMapProjector,
  getRegionCountries,
  getRegionLayerItems,
} from '../data/geography';

const regions = GEOGRAPHY_REGIONS;

const layers = {
  countries: { ...GEOGRAPHY_LAYERS.countries, icon: Flag },
  terrain: { ...GEOGRAPHY_LAYERS.terrain, icon: Mountain },
  water: { ...GEOGRAPHY_LAYERS.water, icon: Waves },
  minerals: { ...GEOGRAPHY_LAYERS.minerals, icon: Gem },
  capitals: { ...GEOGRAPHY_LAYERS.capitals, icon: MapPin },
};

const modeConfig = {
  challenge: { label: 'وضع التحدي', icon: Target, seconds: 35, lives: 3, multiplier: 1, description: 'أسئلة متتابعة ونقاط حسب السرعة' },
  explore: { label: 'وضع الاستكشاف', icon: Compass, seconds: 0, lives: 99, multiplier: 0, description: 'استكشف الدول والظاهرات بحرية' },
  training: { label: 'وضع التدريب', icon: GraduationCap, seconds: 60, lives: 8, multiplier: 0.65, description: 'وقت أطول وتلميحات تعليمية' },
  build: { label: 'وضع البناء', icon: Layers3, seconds: 0, lives: 99, multiplier: 0.45, description: 'ضع عناصر الجغرافيا على الخريطة' },
  contest: { label: 'البطولات', icon: Trophy, seconds: 20, lives: 2, multiplier: 1.5, description: 'أقصى سرعة ومكافآت أعلى' },
};

const buildPaletteIds = new Set(['mountains', 'plateaus', 'plains', 'river', 'desert', 'capital', 'city', 'pin', 'latitude', 'longitude', 'population-low', 'population-medium', 'population-high']);
const buildPalette = GEOGRAPHY_SYMBOLS.filter((item) => buildPaletteIds.has(item.id));

export default function MapChallenge({ data, updateData, navigate }) {
  const [geo] = useState(worldCountries);
  const [regionKey, setRegionKey] = useState('africa');
  const [layerKey, setLayerKey] = useState('countries');
  const [mode, setMode] = useState('challenge');
  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState('');
  const [labels, setLabels] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [seconds, setSeconds] = useState(modeConfig.challenge.seconds);
  const [lives, setLives] = useState(modeConfig.challenge.lives);
  const [placements, setPlacements] = useState([]);
  const [hintId, setHintId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [mapTool, setMapTool] = useState('select');
  const [mapDrawColor, setMapDrawColor] = useState('#ef4444');
  const [mapStrokes, setMapStrokes] = useState([]);
  const [selectedBuildItem, setSelectedBuildItem] = useState(null);
  const mapCanvasRef = useRef(null);
  const mapDrawing = useRef(false);
  const mapCurrentStroke = useRef(null);
  const answerLockRef = useRef(false);
  const timerHandledRef = useRef('');
  const settings = data?.settings || {};

  const region = regions[regionKey] || regions.world;
  const project = useMemo(() => createMapProjector(regionKey), [regionKey]);
  const countries = useMemo(() => getRegionCountries(geo, regionKey), [geo, regionKey]);
  const items = useMemo(() => getRegionLayerItems(geo, regionKey, layerKey), [geo, countries, layerKey, regionKey]);
  const activeConfig = modeConfig[mode];
  const target = order[index] || null;
  const progress = mode === 'build'
    ? Math.min(100, Math.round((placements.length / Math.max(buildPalette.length, 1)) * 100))
    : order.length ? Math.round((index / order.length) * 100) : 0;

  const saveResult = async (status, finalScore = score) => {
    const result = { id: Date.now(), region: regionKey, layer: layerKey, mode, score: finalScore, streak, placements, status, answered: mode === 'build' ? placements.length : Math.min(index + 1, order.length), total: mode === 'build' ? buildPalette.length : order.length, createdAt: new Date().toISOString() };
    await updateData({ ...data, mapResults: [result, ...(data.mapResults || [])].slice(0, 250) });
  };

  const finish = async (status = 'completed', finalScore = score) => {
    setStarted(false);
    setScore(finalScore);
    setMessage(status === 'completed' ? 'أحسنت! اكتملت الجولة وتم حفظ النتيجة.' : 'انتهت الجولة وتم حفظ النتيجة.');
    await saveResult(status, finalScore);
  };

  const resetTimer = () => setSeconds(activeConfig.seconds || 0);
  const advance = async (finalScore = score) => {
    answerLockRef.current = false;
    timerHandledRef.current = '';
    setHintId('');
    if (index + 1 >= order.length) await finish('completed', finalScore);
    else { setIndex((value) => value + 1); resetTimer(); }
  };

  const wrongAnswer = async (reason = 'إجابة غير صحيحة') => {
    setMessage(reason);
    setStreak(0);
    const nextLives = Math.max(0, lives - 1);
    setLives(nextLives);
    if (nextLives <= 0) await finish('out-of-lives');
  };

  useEffect(() => {
    if (!started || !activeConfig.seconds || ['build', 'explore'].includes(mode)) return undefined;
    const id = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [started, mode, index, activeConfig.seconds]);

  useEffect(() => {
    if (!started || !activeConfig.seconds || seconds !== 0 || ['build', 'explore'].includes(mode)) return;
    const timeoutKey = `${mode}:${regionKey}:${layerKey}:${index}`;
    if (timerHandledRef.current === timeoutKey) return;
    timerHandledRef.current = timeoutKey;
    answerLockRef.current = true;
    wrongAnswer('انتهى الوقت — حاول في السؤال التالي').then(() => {
      if (lives > 1) advance();
      else answerLockRef.current = false;
    });
  }, [seconds, started, mode, regionKey, layerKey, index, lives, activeConfig.seconds]);

  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 1000, 620);
    mapStrokes.forEach((stroke) => {
      context.save();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.tool === 'eraser' ? 28 : 5;
      context.beginPath();
      stroke.points.forEach((point, pointIndex) => pointIndex ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.stroke();
      context.restore();
    });
  }, [mapStrokes, regionKey, layerKey, zoom]);

  const startGame = () => {
    if (!geo) {
      setMessage('انتظر لحظات حتى يكتمل تحميل الخريطة.');
      return;
    }
    if (mode !== 'build' && items.length === 0) {
      setMessage('لا توجد عناصر متاحة في هذه الطبقة حاليًا. اختر طبقة أخرى.');
      return;
    }
    answerLockRef.current = false;
    timerHandledRef.current = '';
    setOrder(shuffleMapItems(items));
    setIndex(0);
    setScore(0);
    setStreak(0);
    setLives(activeConfig.lives);
    setSeconds(activeConfig.seconds || 0);
    setMessage(mode === 'explore' ? 'اضغط على أي دولة أو ظاهرة لمعرفة اسمها.' : mode === 'build' ? 'اختر عنصرًا ثم اضغط على موضعه، أو اسحبه إلى الخريطة.' : 'ابدأ الآن وحدد الإجابة على الخريطة.');
    setPlacements([]);
    setSelectedBuildItem(null);
    setHintId('');
    setSelectedId('');
    setStarted(true);
    if (mode === 'explore') setLabels(true);
  };

  const answer = async (id, name = '') => {
    setSelectedId(id);
    if (mode === 'explore') {
      setMessage(`📍 ${name || items.find((item) => item.id === id)?.name || 'موقع على الخريطة'}`);
      return;
    }
    if (!started || !target || mode === 'build' || answerLockRef.current) return;
    answerLockRef.current = true;
    if (id === target.id) {
      const reward = calculateMapReward({ seconds, multiplier: activeConfig.multiplier, streak });
      const nextScore = score + reward;
      setScore(nextScore);
      setStreak((value) => value + 1);
      setMessage(`إجابة صحيحة +${reward} نقطة`);
      encourageStudent('excellent', '', settings);
      setTimeout(() => advance(nextScore), 450);
    } else {
      await wrongAnswer('ليست الإجابة المطلوبة — جرّب مرة أخرى');
      answerLockRef.current = false;
    }
  };

  const useHint = () => {
    if (!target || mode === 'build') return;
    setHintId(target.id);
    setLabels(true);
    setScore((value) => Math.max(0, value - 30));
    setMessage('تم إظهار مكان الإجابة، وخصم 30 نقطة.');
    setTimeout(() => setHintId(''), 3000);
  };

  const skipQuestion = async () => {
    if (!target) return;
    setScore((value) => Math.max(0, value - 20));
    setMessage(`تم تخطي: ${target.name}`);
    await advance();
  };

  const addBuildPlacement = (item, x, y) => {
    if (!item) return;
    const placement = { ...item, id: `${item.id}-${Date.now()}`, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
    setPlacements((current) => [...current, placement]);
    setSelectedBuildItem(null);
    setScore((value) => value + 25);
    setMessage(`تم وضع ${item.label} على الخريطة`);
  };
  const handlePaletteDrag = (event, item) => {
    setSelectedBuildItem(item);
    event.dataTransfer.setData('application/json', JSON.stringify(item));
  };
  const handleDropPlacement = (event) => {
    if (mode !== 'build' || !started) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const item = JSON.parse(event.dataTransfer.getData('application/json'));
      const rect = event.currentTarget.getBoundingClientRect();
      addBuildPlacement(item, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
    } catch { setMessage('تعذر وضع العنصر هنا.'); }
  };
  const handleMapStageClick = (event) => {
    if (mode !== 'build' || !started || !selectedBuildItem || mapTool !== 'select') return;
    const rect = event.currentTarget.getBoundingClientRect();
    addBuildPlacement(selectedBuildItem, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
  };

  const mapPoint = (event) => {
    const rect = mapCanvasRef.current.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return { x: ((source.clientX - rect.left) / rect.width) * 1000, y: ((source.clientY - rect.top) / rect.height) * 620 };
  };
  const onMapPointerDown = (event) => {
    if (!['pen', 'eraser'].includes(mapTool)) return;
    event.preventDefault();
    mapDrawing.current = true;
    mapCurrentStroke.current = { id: Date.now(), tool: mapTool, color: mapDrawColor, points: [mapPoint(event)] };
  };
  const onMapPointerMove = (event) => {
    if (!mapDrawing.current || !mapCurrentStroke.current) return;
    event.preventDefault();
    mapCurrentStroke.current.points.push(mapPoint(event));
    const preview = [...mapStrokes, mapCurrentStroke.current];
    const canvas = mapCanvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 1000, 620);
    preview.forEach((stroke) => {
      context.save(); context.lineCap = 'round'; context.lineJoin = 'round'; context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'; context.strokeStyle = stroke.color; context.lineWidth = stroke.tool === 'eraser' ? 28 : 5; context.beginPath(); stroke.points.forEach((point, pointIndex) => pointIndex ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke(); context.restore();
    });
  };
  const onMapPointerUp = () => {
    if (mapDrawing.current && mapCurrentStroke.current) setMapStrokes((current) => [...current, mapCurrentStroke.current]);
    mapDrawing.current = false;
    mapCurrentStroke.current = null;
  };

  const modeNav = Object.entries(modeConfig);
  const recentBest = Math.max(0, ...(data?.mapResults || []).map((result) => Number(result.score || 0)));

  return (
    <section className="page map-challenge-pro map-game-v103">
      <header className="map-game-topbar">
        <div className="map-player-profile"><img src={identity.portrait} alt={identity.teacherName}/><div><strong>{identity.teacherName}</strong><small>مستوى الجغرافيا 12</small></div></div>
        <div className="map-game-counters"><span>🪙 <b>{score}</b></span><span>⭐ <b>{streak * 5}</b></span><span>⚡ <b>{Math.max(0, Math.round((lives / activeConfig.lives) * 100))}/100</b></span></div>
        <div className="map-game-title"><Trophy size={22}/><div><strong>{modeConfig[mode].label}</strong><small>{regions[regionKey].title}</small></div></div>
      </header>

      <div className="map-game-layout">
        <aside className="map-game-nav">
          <div className="map-game-brand"><img src={identity.logo || identity.icon} alt={identity.schoolName}/><strong>تحدي الخرائط</strong></div>
          <nav>{modeNav.map(([key, item]) => { const Icon = item.icon; return <button type="button" key={key} className={mode === key ? 'active' : ''} onClick={() => { setMode(key); setStarted(false); setSelectedBuildItem(null); setMessage(''); }}><Icon size={19}/><span>{item.label}</span></button>; })}</nav>
          <div className="map-game-secondary-nav">
            <button type="button" onClick={() => setMessage(`أفضل نتيجة مسجلة: ${recentBest} نقطة`)}><Medal size={18}/>الإنجازات</button>
            <button type="button" onClick={() => navigate?.('studentCards')}><BadgeCheck size={18}/>كروت الطلاب</button>
            <button type="button" onClick={() => navigate?.('students')}><UserRound size={18}/>الملف الشخصي</button>
            <button type="button" onClick={() => navigate?.('settings')}><Settings size={18}/>الإعدادات</button>
          </div>
        </aside>

        <main className="map-game-main">
          <div className="map-game-toolbar">
            <div className="map-region-tabs">{Object.entries(regions).map(([key, item]) => <button key={key} type="button" className={regionKey === key ? 'active' : ''} onClick={() => { setRegionKey(key); setStarted(false); setSelectedBuildItem(null); setMessage(''); }}>{item.title}</button>)}</div>
            <div className="map-view-tools">
              <button type="button" onClick={() => setLabels((value) => !value)} title="إظهار الأسماء">{labels ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.7, value + .1))}><ZoomIn size={17}/></button>
              <button type="button" onClick={() => setZoom((value) => Math.max(1, value - .1))}><ZoomOut size={17}/></button>
              <button type="button" onClick={() => { setZoom(1); setMapStrokes([]); }}><RotateCcw size={17}/></button>
            </div>
          </div>

          <div className="map-game-canvas-shell">
            {!geo && <div className="map-game-loading">جارٍ تحميل حدود الخريطة الاحترافية…</div>}
            <ProfessionalMap countries={countries} items={items} layerKey={layerKey} labels={labels} highlightedId={hintId} selectedId={selectedId} project={project} zoom={zoom} placements={placements} onCountryClick={answer} onFeatureClick={answer} onDropPlacement={handleDropPlacement} onMovePlacement={(id, x, y) => setPlacements((current) => current.map((item) => item.id === id ? { ...item, x, y } : item))} onRemovePlacement={(id) => setPlacements((current) => current.filter((item) => item.id !== id))} onStageClick={handleMapStageClick} canvasRef={mapCanvasRef} drawTool={mapTool} onPointerDown={onMapPointerDown} onPointerMove={onMapPointerMove} onPointerUp={onMapPointerUp}/>
            <div className="map-drawing-tools">
              <button type="button" className={mapTool === 'select' ? 'active' : ''} onClick={() => setMapTool('select')}><MapPin size={16}/></button>
              <button type="button" className={mapTool === 'pen' ? 'active' : ''} onClick={() => setMapTool('pen')}><PenLine size={16}/></button>
              <button type="button" className={mapTool === 'eraser' ? 'active' : ''} onClick={() => setMapTool('eraser')}><Eraser size={16}/></button>
              <input type="color" value={mapDrawColor} onChange={(event) => setMapDrawColor(event.target.value)}/>
              <button type="button" onClick={() => setMapStrokes([])}><RotateCcw size={16}/></button>
            </div>
          </div>

          <div className="map-layer-dock">{Object.entries(layers).map(([key, item]) => { const Icon = item.icon; return <button key={key} type="button" className={layerKey === key ? 'active' : ''} onClick={() => { setLayerKey(key); setStarted(false); setSelectedBuildItem(null); setMessage(''); }}><Icon size={18}/><span>{item.title}</span></button>; })}</div>
        </main>

        <aside className="map-game-question-panel">
          <div className="map-question-progress"><span>السؤال {started ? Math.min(index + 1, order.length) : 0}/{order.length || items.length}</span><b>{progress}%</b><i><em style={{ width: `${progress}%` }}/></i></div>
          <div className="map-question-copy">
            <BrainCircuit size={34}/>
            <small>{region.subtitle}</small>
            <h3>{mode === 'build' ? 'اسحب عناصر الجغرافيا إلى الخريطة' : mode === 'explore' ? 'اضغط على أي موضع لاستكشافه' : target ? `حدد: ${target.name}` : 'اختر الإعدادات وابدأ الجولة'}</h3>
          </div>
          <div className="map-question-stats"><div><span>الوقت</span><strong>{activeConfig.seconds ? `00:${String(seconds).padStart(2, '0')}` : '∞'}</strong></div><div><span>النقاط</span><strong>{score.toLocaleString('ar-EG')}</strong></div><div><span>المضاعف</span><strong>×{activeConfig.multiplier}</strong></div><div><span>الدقة</span><strong>{index ? Math.round((streak / Math.max(index, 1)) * 100) : 100}%</strong></div></div>
          <div className="map-lives">{Array.from({ length: Math.min(5, activeConfig.lives) }, (_, lifeIndex) => <span key={lifeIndex} className={lifeIndex < lives ? 'alive' : ''}>♥</span>)}</div>
          {mode === 'build' && <div className="map-build-palette">{buildPalette.map((item) => <button key={item.id} draggable className={selectedBuildItem?.id === item.id ? 'active' : ''} onClick={() => { setSelectedBuildItem(item); setMessage(`تم اختيار ${item.label} — اضغط على مكانه في الخريطة.`); }} onDragStart={(event) => handlePaletteDrag(event, item)} type="button" style={{ '--palette-color': item.color }}><b className="map-palette-glyph"><GeographyGlyph type={item.id} symbol={item.symbol} /></b><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div>}
          {message && <div className={`map-game-message ${message.includes('صحيحة') || message.includes('تم وضع') || message.includes('📍') ? 'good' : ''}`}>{message}</div>}
          <div className="map-question-actions">
            {!started ? <button type="button" className="map-start-button" onClick={startGame}><Gamepad2 size={18}/>ابدأ الجولة</button> : <>
              {!['build', 'explore'].includes(mode) && <button type="button" onClick={useHint}><Lightbulb size={18}/>تلميح</button>}
              {!['build', 'explore'].includes(mode) && <button type="button" onClick={skipQuestion}><SkipForward size={18}/>تخطي</button>}
              {mode === 'build' && <button type="button" onClick={() => { setPlacements([]); setSelectedBuildItem(null); setMessage('تم مسح عناصر البناء.'); }}><RotateCcw size={18}/>مسح البناء</button>}
              <button type="button" onClick={() => finish(mode === 'build' ? 'completed' : mode === 'explore' ? 'explored' : 'stopped')}><TimerReset size={18}/>{mode === 'build' ? 'حفظ البناء' : mode === 'explore' ? 'إنهاء الاستكشاف' : 'إنهاء الجولة'}</button>
            </>}
          </div>
          <div className="map-xp-reward"><Sparkles size={20}/><div><strong>+{Math.round(score / 10)} XP</strong><small>المكافأة الحالية</small></div><ChevronLeft size={18}/></div>
        </aside>
      </div>
    </section>
  );
}
