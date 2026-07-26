import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  Flag,
  Gem,
  Layers3,
  MapPin,
  Mountain,
  RotateCcw,
  TimerReset,
  Trophy,
  Waves,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { encourageStudent } from '../services/voice';

const arabIso = ['DZA', 'BHR', 'COM', 'DJI', 'EGY', 'IRQ', 'JOR', 'KWT', 'LBN', 'LBY', 'MRT', 'MAR', 'OMN', 'PSE', 'QAT', 'SAU', 'SOM', 'SDN', 'SYR', 'TUN', 'ARE', 'YEM'];
const arabicNames = {
  EGY: 'مصر', SAU: 'السعودية', IRQ: 'العراق', MAR: 'المغرب', DZA: 'الجزائر', SDN: 'السودان', LBY: 'ليبيا', TUN: 'تونس', MRT: 'موريتانيا',
  SOM: 'الصومال', YEM: 'اليمن', OMN: 'عُمان', ARE: 'الإمارات', QAT: 'قطر', KWT: 'الكويت', BHR: 'البحرين', JOR: 'الأردن', PSE: 'فلسطين',
  LBN: 'لبنان', SYR: 'سوريا', DJI: 'جيبوتي', COM: 'جزر القمر', NGA: 'نيجيريا', ETH: 'إثيوبيا', ZAF: 'جنوب إفريقيا', COD: 'الكونغو الديمقراطية',
  KEN: 'كينيا', TZA: 'تنزانيا', FRA: 'فرنسا', IND: 'الهند', BRA: 'البرازيل', AUS: 'أستراليا', USA: 'الولايات المتحدة', CHN: 'الصين', JPN: 'اليابان'
};

const regions = {
  egypt: { title: 'مصر', grade: 'الرابع والخامس', bounds: [24, 22, 37, 32], countryFilter: (f) => f.properties.iso_a3 === 'EGY' },
  arab: { title: 'الوطن العربي', grade: 'السادس', bounds: [-18, 8, 61, 39], countryFilter: (f) => arabIso.includes(f.properties.iso_a3) },
  africa: { title: 'إفريقيا', grade: 'الأول الإعدادي', bounds: [-19, -36, 53, 38], countryFilter: (f) => f.properties.continent === 'Africa' },
  world: { title: 'العالم', grade: 'الثاني والثالث الإعدادي', bounds: [-180, -60, 180, 85], countryFilter: () => true },
};

const layers = {
  countries: { title: 'الدول والحدود', icon: Flag, color: '#d6ae38' },
  terrain: { title: 'التضاريس', icon: Mountain, color: '#8d6e4c' },
  water: { title: 'المسطحات والمياه', icon: Waves, color: '#2f80ed' },
  minerals: { title: 'المعادن والطاقة', icon: Gem, color: '#b85c9e' },
  capitals: { title: 'العواصم والمدن', icon: MapPin, color: '#d64545' },
};

const modeConfig = {
  training: { label: 'وضع التدريب', seconds: 60, lives: 5, multiplier: 0.6, hint: 'تعلم بدون ضغط' },
  challenge: { label: 'وضع التحدي', seconds: 35, lives: 3, multiplier: 1, hint: 'نقاط متوازنة' },
  contest: { label: 'وضع المسابقة', seconds: 20, lives: 2, multiplier: 1.35, hint: 'سرعة وتركيز' },
  build: { label: 'وضع البناء', seconds: 120, lives: 99, multiplier: 0.4, hint: 'اسحب العناصر إلى الخريطة' },
};

const features = {
  egypt: {
    terrain: [['جبال البحر الأحمر', 33.2, 27.3], ['هضبة الجلف الكبير', 25.6, 23.5], ['جبل سانت كاترين', 33.95, 28.53], ['منخفض القطارة', 28.7, 30.0]],
    water: [['نهر النيل', 31.1, 27.5], ['البحر الأحمر', 35.1, 26.5], ['البحر المتوسط', 30.5, 31.6], ['بحيرة ناصر', 32.7, 23.8]],
    minerals: [['بترول خليج السويس', 33.1, 29.2], ['فوسفات أبو طرطور', 25.5, 25.4], ['حديد الواحات البحرية', 28.9, 28.3], ['ذهب السكري', 34.7, 24.95]],
    capitals: [['القاهرة', 31.2357, 30.0444], ['الإسكندرية', 29.9187, 31.2001], ['أسوان', 32.8998, 24.0889], ['الأقصر', 32.6396, 25.6872], ['بورسعيد', 32.3019, 31.2653]],
  },
  arab: {
    terrain: [['جبال أطلس', -5, 32], ['جبال الحجاز', 39.5, 23.5], ['هضبة نجد', 45, 24], ['جبال لبنان', 35.8, 33.9], ['مرتفعات اليمن', 44, 15.5]],
    water: [['نهر النيل', 31, 22], ['دجلة والفرات', 44, 33], ['البحر الأحمر', 38, 22], ['الخليج العربي', 51, 26], ['البحر المتوسط', 18, 35]],
    minerals: [['بترول الخليج العربي', 49, 25], ['حديد موريتانيا', -11, 22], ['فوسفات المغرب', -7, 32], ['ذهب السودان', 33, 18], ['غاز الجزائر', 3, 29]],
    capitals: [['القاهرة', 31.2, 30.0], ['الرياض', 46.7, 24.7], ['بغداد', 44.4, 33.3], ['الرباط', -6.8, 34.0], ['الخرطوم', 32.6, 15.5]],
  },
  africa: {
    terrain: [['جبال أطلس', -5, 32], ['هضبة الحبشة', 39, 9], ['جبال دراكنزبرج', 29, -29], ['حوض الكونغو', 23, -3], ['الصحراء الكبرى', 12, 23]],
    water: [['نهر النيل', 31, 15], ['نهر الكونغو', 22, -2], ['نهر النيجر', 4, 10], ['بحيرة فيكتوريا', 33, -1], ['المحيط الهندي', 50, -10]],
    minerals: [['ذهب جنوب إفريقيا', 27, -27], ['نحاس زامبيا', 28, -13], ['بترول نيجيريا', 6, 5], ['ماس الكونغو', 23, -5], ['فوسفات المغرب', -7, 32]],
    capitals: [['القاهرة', 31.2, 30], ['أديس أبابا', 38.7, 9], ['أبوجا', 7.5, 9.1], ['بريتوريا', 28.2, -25.7], ['نيروبي', 36.8, -1.3]],
  },
  world: {
    terrain: [['جبال الهيمالايا', 86, 28], ['جبال الأنديز', -70, -20], ['جبال الروكي', -112, 45], ['جبال الألب', 10, 46], ['هضبة التبت', 88, 32]],
    water: [['المحيط الهادئ', -150, 0], ['المحيط الأطلسي', -30, 5], ['المحيط الهندي', 80, -20], ['نهر الأمازون', -60, -4], ['البحر المتوسط', 18, 35]],
    minerals: [['بترول الخليج العربي', 49, 25], ['حديد أستراليا', 120, -25], ['نحاس تشيلي', -70, -25], ['فحم الصين', 112, 36], ['ذهب جنوب إفريقيا', 27, -27]],
    capitals: [['القاهرة', 31.2, 30], ['باريس', 2.35, 48.85], ['نيودلهي', 77.2, 28.6], ['برازيليا', -47.9, -15.8], ['كانبرا', 149.1, -35.3]],
  },
};

const buildPalette = [
  { id: 'mountains', label: 'جبال', hint: 'ضع جبالًا أو سلاسل جبلية', color: '#8d6e4c' },
  { id: 'plateaus', label: 'هضاب', hint: 'حدّد الهضاب المرتفعة', color: '#c38f5a' },
  { id: 'animal', label: 'ثروة حيوانية', hint: 'أماكن الرعي والتربية', color: '#5d8f57' },
  { id: 'fish', label: 'ثروة سمكية', hint: 'المناطق البحرية والبحيرات', color: '#2f80ed' },
  { id: 'minerals', label: 'ثروات معدنية', hint: 'بترول، معادن، وفحم', color: '#b85c9e' },
  { id: 'agriculture', label: 'ثروة زراعية', hint: 'دلتا، وادي، وسهول', color: '#4d9e6f' },
  { id: 'waterways', label: 'مجاري مائية', hint: 'أنهار وبحيرات', color: '#3a9ad9' },
  { id: 'desert', label: 'صحارى', hint: 'مناطق جافة شاسعة', color: '#d6ae38' },
];

function coordsToPath(coords, project) {
  return coords.map((ring) => ring.map((p, i) => `${i ? 'L' : 'M'}${project(p[0], p[1]).join(',')}`).join(' ') + ' Z').join(' ');
}

function geometryPath(geometry, project) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') return coordsToPath(geometry.coordinates, project);
  return geometry.coordinates.map((poly) => coordsToPath(poly, project)).join(' ');
}

function featureCenter(feature) {
  const pts = [];
  const walk = (a) => (Array.isArray(a[0]) ? a.forEach(walk) : pts.push(a));
  walk(feature.geometry.coordinates);
  return pts.length
    ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
    : [0, 0];
}

function mapItemColor(layerKey) {
  if (layerKey === 'terrain') return '#d8b18d';
  if (layerKey === 'water') return '#7ac3ff';
  if (layerKey === 'minerals') return '#f2a7da';
  if (layerKey === 'capitals') return '#ff9f8a';
  return '#f0d478';
}

export default function MapChallenge({ data, updateData }) {
  const [geo, setGeo] = useState(null);
  const [regionKey, setRegionKey] = useState('arab');
  const [layerKey, setLayerKey] = useState('countries');
  const [mode, setMode] = useState('challenge');
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [labels, setLabels] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [seconds, setSeconds] = useState(modeConfig.challenge.seconds);
  const [lives, setLives] = useState(modeConfig.challenge.lives);
  const [placements, setPlacements] = useState([]);
  const timer = useRef();
  const settings = data?.settings || {};

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/world-countries.geojson`).then((r) => r.json()).then(setGeo).catch(() => setGeo({ features: [] }));
  }, []);

  useEffect(() => {
    clearInterval(timer.current);
    if (started) {
      timer.current = setInterval(() => {
        setSeconds((value) => {
          if (value <= 1) {
            clearInterval(timer.current);
            setMessage('انتهى الوقت');
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer.current);
  }, [started, index, mode]);

  const region = regions[regionKey];
  const bounds = region.bounds;
  const project = (lon, lat) => {
    const [minX, minY, maxX, maxY] = bounds;
    return [((lon - minX) / (maxX - minX)) * 1000, ((maxY - lat) / (maxY - minY)) * 620];
  };

  const countries = useMemo(() => geo?.features?.filter(region.countryFilter) || [], [geo, regionKey]);
  const items = useMemo(
    () =>
      layerKey === 'countries'
        ? countries.map((feature) => ({
            id: feature.properties.iso_a3,
            name: arabicNames[feature.properties.iso_a3] || feature.properties.name,
            feature,
            coord: featureCenter(feature),
          }))
        : (features[regionKey]?.[layerKey] || []).map((item, i) => ({ id: `${layerKey}-${i}`, name: item[0], coord: [item[1], item[2]] })),
    [countries, layerKey, regionKey]
  );

  const order = useMemo(() => [...items].sort(() => Math.random() - 0.5), [items, started, mode, regionKey, layerKey]);
  const target = order[index % Math.max(order.length, 1)];
  const modeLabel = modeConfig[mode]?.label || 'وضع التحدي';
  const activeConfig = modeConfig[mode] || modeConfig.challenge;

  const startGame = () => {
    setStarted(true);
    setIndex(0);
    setScore(0);
    setMessage('');
    setLives(activeConfig.lives);
    setSeconds(activeConfig.seconds);
    setPlacements([]);
  };

  const finish = (finalMessage = 'تم حفظ النتيجة') => {
    clearInterval(timer.current);
    updateData({
      ...data,
      mapResults: [
        ...(data.mapResults || []),
        {
          id: Date.now(),
          region: regionKey,
          layer: layerKey,
          mode,
          score,
          placements,
          date: new Date().toISOString().slice(0, 10),
        },
      ],
    });
    setStarted(false);
    setMessage(finalMessage);
  };

  const answer = (id) => {
    if (!started || !target || mode === 'build') return;
    const ok = id === target.id;
    if (ok) {
      setMessage('إجابة صحيحة — أحسنت!');
      encourageStudent('excellent', target.name, settings);
      const timeBonus = Math.max(0, seconds - (mode === 'contest' ? 8 : 12));
      setScore((value) => value + Math.round((10 + timeBonus) * activeConfig.multiplier));
      setTimeout(() => {
        setIndex((value) => value + 1);
        setMessage('');
      }, 650);
      return;
    }

    encourageStudent('retry', target.name, settings);
    setLives((value) => {
      const next = Math.max(0, value - 1);
      if (next === 0) {
        setMessage('انتهت المحاولات');
        setTimeout(() => finish('تم إنهاء الجولة وحفظ النتيجة'), 450);
      } else {
        setMessage(`إجابة غير صحيحة — متبقي ${next} ${next === 1 ? 'محاولة' : 'محاولات'}`);
      }
      return next;
    });
  };

  const handlePaletteDrag = (event, item) => {
    event.dataTransfer.setData('text/plain', item.id);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropPlacement = (event) => {
    if (mode !== 'build') return;
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    const item = buildPalette.find((entry) => entry.id === id);
    if (!item) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const placement = { id: `${item.id}-${Date.now()}`, label: item.label, hint: item.hint, color: item.color, x, y };
    setPlacements((current) => [...current, placement]);
    setScore((value) => value + 5);
    setMessage(`تم وضع ${item.label} في الخريطة`);
  };

  const LayerIcon = layers[layerKey].icon;
  const modeEntries = Object.entries(modeConfig);

  return (
    <section className="page gis-page">
      <div className="page-heading gis-page-heading">
        <div>
          <span className="eyebrow">أطلس تفاعلي متعدد الطبقات</span>
          <h2>تحدي المُبدع الجغرافي</h2>
          <p>حدود حقيقية، طبقات تعليمية مستقلة، وأسئلة ديناميكية للموبايل والتابلت.</p>
        </div>
        <div className="gis-kpi">
          <Trophy />
          <strong>{score}</strong>
          <span>نقطة</span>
        </div>
      </div>

      <div className="gis-layout">
        <aside className="panel gis-sidebar">
          <div className="gis-section">
            <label>نطاق الخريطة</label>
            <select value={regionKey} onChange={(e) => { setRegionKey(e.target.value); setStarted(false); setIndex(0); setZoom(1); }}>
              {Object.entries(regions).map(([k, v]) => <option key={k} value={k}>{v.title} — {v.grade}</option>)}
            </select>
          </div>

          <div className="gis-section">
            <label><Layers3 size={17} /> طبقات العناصر</label>
            <div className="gis-layer-list">
              {Object.entries(layers).map(([k, v]) => {
                const Icon = v.icon;
                return (
                  <button key={k} className={layerKey === k ? 'active' : ''} style={{ '--layer-color': v.color }} onClick={() => { setLayerKey(k); setStarted(false); setIndex(0); }}>
                    <Icon size={19} />
                    <span>{v.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gis-section">
            <label>أوضاع اللعب</label>
            <div className="gis-mode-list">
              {modeEntries.map(([key, value]) => (
                <button
                  key={key}
                  className={mode === key ? 'active' : ''}
                  onClick={() => {
                    setMode(key);
                    setStarted(false);
                    setIndex(0);
                    setScore(0);
                    setLives(value.lives);
                    setSeconds(value.seconds);
                    setMessage('');
                  }}
                >
                  <BrainCircuit size={17} />
                  <span>{value.label}</span>
                  <small>{value.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="gis-section">
            <label>إعدادات العرض</label>
            <button className="gis-toggle" onClick={() => setLabels((v) => !v)}>{labels ? <EyeOff /> : <Eye />}<span>{labels ? 'إخفاء الأسماء' : 'إظهار الأسماء'}</span></button>
            <div className="gis-zoom">
              <button onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))}><ZoomIn /></button>
              <button onClick={() => setZoom((z) => Math.max(1, z - 0.2))}><ZoomOut /></button>
              <button onClick={() => setZoom(1)}><RotateCcw /></button>
            </div>
          </div>

          <button className="primary-btn gis-start" onClick={startGame}>بدء {modeLabel}</button>
        </aside>

        <main className="panel gis-map-panel">
          <div className="gis-topbar">
            <div>
              <LayerIcon />
              <strong>{layers[layerKey].title}</strong>
              <span>{region.title}</span>
            </div>
            <div className={seconds <= 5 ? 'gis-timer danger' : 'gis-timer'}>
              <TimerReset />
              <b>{seconds}</b>
              <span>ثانية</span>
            </div>
            <div>
              <span>السؤال</span>
              <b>{started ? index + 1 : 0}</b>
            </div>
            <div>
              <span>الحياة</span>
              <b>{lives}</b>
            </div>
          </div>

          {!started ? (
            <div className="gis-empty">
              <div>🗺️</div>
              <h3>اختر الطبقة ثم ابدأ التحدي</h3>
              <p>يمكنك التبديل بين الدول، التضاريس، المسطحات المائية، المعادن والطاقة، والعواصم.</p>
            </div>
          ) : mode === 'build' ? (
            <>
              <div className="gis-build-panel">
                <div className="gis-build-palette">
                  {buildPalette.map((item) => (
                    <button key={item.id} type="button" draggable onDragStart={(event) => handlePaletteDrag(event, item)} className="gis-palette-chip" style={{ '--chip-color': item.color }}>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </button>
                  ))}
                </div>
                <div className="gis-build-stats">
                  <span><strong>{placements.length}</strong> عنصرًا موضوعًا</span>
                  <span><strong>{score}</strong> نقطة</span>
                </div>
              </div>
              <div className="gis-map-wrap build-mode" onDragOver={(event) => event.preventDefault()} onDrop={handleDropPlacement}>
                <svg viewBox="0 0 1000 620" className="gis-svg" style={{ transform: `scale(${zoom})` }}>
                  <rect width="1000" height="620" className="gis-ocean" />
                  <g className="gis-grid-lines">
                    {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => <line key={`x${x}`} x1={x} y1="0" x2={x} y2="620" />)}
                    {[100, 200, 300, 400, 500].map((y) => <line key={`y${y}`} x1="0" y1={y} x2="1000" y2={y} />)}
                  </g>
                  <g>
                    {countries.map((feature) => {
                      const id = feature.properties.iso_a3;
                      const name = arabicNames[id] || feature.properties.name;
                      const c = project(...featureCenter(feature));
                      return (
                        <g key={id}>
                          <path d={geometryPath(feature.geometry, project)} className={`gis-country ${layerKey === 'countries' ? 'clickable' : ''}`} onClick={() => layerKey === 'countries' && answer(id)} />
                          {labels && <text x={c[0]} y={c[1]} className="gis-label">{name}</text>}
                        </g>
                      );
                    })}
                  </g>
                  {layerKey !== 'countries' && items.map((item) => {
                    const p = project(...item.coord);
                    const color = mapItemColor(layerKey);
                    return (
                      <g key={item.id} className={`gis-marker ${layerKey}`} onClick={() => answer(item.id)}>
                        <circle cx={p[0]} cy={p[1]} r="13" style={{ fill: color }} />
                        <circle cx={p[0]} cy={p[1]} r="4" fill="#0b0d12" />
                        <text x={p[0] + 16} y={p[1] + 5} className={labels ? 'gis-feature-label show' : 'gis-feature-label'}>{item.name}</text>
                      </g>
                    );
                  })}
                </svg>
                <div className="gis-placement-layer">
                  {placements.map((placement) => (
                    <div key={placement.id} className="gis-placement-chip" style={{ left: `${placement.x}%`, top: `${placement.y}%`, '--chip-color': placement.color }}>
                      <strong>{placement.label}</strong>
                      <small>{placement.hint}</small>
                    </div>
                  ))}
                </div>
              </div>

              {message && <div className={`map-message ${message.includes('صحيحة') || message.includes('تم وضع') ? 'good' : 'bad'}`}>{message}</div>}

              <div className="gis-footer">
                <div className="gis-legend">
                  <span><i className="legend-country" />حدود الدول</span>
                  <span><i style={{ background: layers[layerKey].color }} />طبقة {layers[layerKey].title}</span>
                </div>
                <button className="secondary-btn" onClick={() => finish('تم حفظ نتيجة الجولة')}>إنهاء وحفظ النتيجة</button>
              </div>
            </>
          ) : (
            <>
              <div className="gis-question">حدد على الخريطة: <strong>{target?.name}</strong></div>
              <div className="gis-map-wrap">
                <svg viewBox="0 0 1000 620" className="gis-svg" style={{ transform: `scale(${zoom})` }}>
                  <rect width="1000" height="620" className="gis-ocean" />
                  <g className="gis-grid-lines">
                    {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => <line key={`x${x}`} x1={x} y1="0" x2={x} y2="620" />)}
                    {[100, 200, 300, 400, 500].map((y) => <line key={`y${y}`} x1="0" y1={y} x2="1000" y2={y} />)}
                  </g>
                  <g>
                    {countries.map((feature) => {
                      const id = feature.properties.iso_a3;
                      const name = arabicNames[id] || feature.properties.name;
                      const c = project(...featureCenter(feature));
                      return (
                        <g key={id}>
                          <path d={geometryPath(feature.geometry, project)} className={`gis-country ${layerKey === 'countries' ? 'clickable' : ''}`} onClick={() => layerKey === 'countries' && answer(id)} />
                          {labels && <text x={c[0]} y={c[1]} className="gis-label">{name}</text>}
                        </g>
                      );
                    })}
                  </g>
                  {layerKey !== 'countries' && items.map((item) => {
                    const p = project(...item.coord);
                    const color = mapItemColor(layerKey);
                    return (
                      <g key={item.id} className={`gis-marker ${layerKey}`} onClick={() => answer(item.id)}>
                        <circle cx={p[0]} cy={p[1]} r="13" style={{ fill: color }} />
                        <circle cx={p[0]} cy={p[1]} r="4" fill="#0b0d12" />
                        <text x={p[0] + 16} y={p[1] + 5} className={labels ? 'gis-feature-label show' : 'gis-feature-label'}>{item.name}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {message && <div className={`map-message ${message.includes('صحيحة') ? 'good' : 'bad'}`}>{message}</div>}

              <div className="gis-footer">
                <div className="gis-legend">
                  <span><i className="legend-country" />حدود الدول</span>
                  <span><i style={{ background: layers[layerKey].color }} />طبقة {layers[layerKey].title}</span>
                </div>
                <button className="secondary-btn" onClick={() => finish('تم حفظ نتيجة الجولة')}>إنهاء وحفظ النتيجة</button>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
