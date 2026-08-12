import { useId, useRef } from 'react';
import { geometryPath, featureCenter, getCountryFeatureId, getCountryName } from '../../data/geography';

function mapItemColor(layerKey) {
  return { terrain: '#d8b18d', mountains: '#c69b73', plateaus: '#d0a06b', plains: '#8fc77e', deserts: '#d6ae38', water: '#68b8f5', rivers: '#55aef2', seas: '#65c7e8', minerals: '#eaa0d2', capitals: '#ff846f', cities: '#ff9d77', latitude: '#8ed8ef', longitude: '#a7e3f2', population: '#f0c45f' }[layerKey] || '#f0d478';
}

const COUNTRY_PALETTE = ['#708956', '#7f955d', '#68845e', '#8b9255', '#5f7f59', '#839a69'];

function countryFill(index = 0) {
  return COUNTRY_PALETTE[Math.abs(Number(index || 0)) % COUNTRY_PALETTE.length];
}


export function GeographyGlyph({ type = '', symbol = '●' }) {
  const uid = useId().replace(/:/g, '');
  const relief = `relief-${uid}`;
  const earth = `earth-${uid}`;
  const earthDark = `earth-dark-${uid}`;
  const sand = `sand-${uid}`;
  const water = `water-${uid}`;
  const green = `green-${uid}`;
  const lava = `lava-${uid}`;
  const defs = (
    <defs>
      <linearGradient id={earth} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d5ad72"/><stop offset=".45" stopColor="#9a6c3f"/><stop offset="1" stopColor="#5b3824"/></linearGradient>
      <linearGradient id={earthDark} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#845b37"/><stop offset="1" stopColor="#392319"/></linearGradient>
      <linearGradient id={sand} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe2a0"/><stop offset=".45" stopColor="#d8a94f"/><stop offset="1" stopColor="#9b641f"/></linearGradient>
      <linearGradient id={water} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9ee7ff"/><stop offset=".4" stopColor="#2d9cc6"/><stop offset="1" stopColor="#0a4e77"/></linearGradient>
      <linearGradient id={green} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8d86f"/><stop offset=".5" stopColor="#4e9c58"/><stop offset="1" stopColor="#1e5b3b"/></linearGradient>
      <linearGradient id={lava} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd15b"/><stop offset=".45" stopColor="#ff6938"/><stop offset="1" stopColor="#8f1d18"/></linearGradient>
      <filter id={relief} x="-35%" y="-35%" width="170%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#000" floodOpacity=".65"/>
      </filter>
    </defs>
  );

  if (type === 'mountains') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 46" aria-hidden="true">{defs}<ellipse cx="33" cy="40" rx="28" ry="4" fill="#000" opacity=".22"/><g filter={`url(#${relief})`}><path d="M2 40 19 12l11 18L41 5l21 35Z" fill={`url(#${earth})`}/><path d="m13 22 6-10 6 10-6-3Zm21-7 7-10 9 16-9-6Z" fill="#f5f3e9" opacity=".95"/><path d="M19 12 5 40h14l11-10Z" fill="#3b261b" opacity=".38"/><path d="M41 5 30 30l11-7 21 17Z" fill="#4c3020" opacity=".42"/></g></svg>;
  }
  if (type === 'plateaus') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<ellipse cx="33" cy="39" rx="27" ry="4" fill="#000" opacity=".2"/><g filter={`url(#${relief})`}><path d="M5 36 15 11h35l9 25Z" fill={`url(#${earth})`}/><path d="M15 11h35l-6 8H18Z" fill="#dcb77c"/><path d="M11 36 18 19h26l10 17Z" fill={`url(#${earthDark})`} opacity=".62"/></g></svg>;
  }
  if (type === 'plains') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<path d="M4 34c10-10 18-8 27-2 10 7 19 5 29-3v10H4Z" fill={`url(#${green})`} filter={`url(#${relief})`}/><path d="M6 25c14-7 25-4 36 1 8 3 13 2 18-1M8 31c12-5 22-3 32 1" stroke="#d7efaa" strokeWidth="2" fill="none" opacity=".7"/></svg>;
  }
  if (type === 'depression' || type === 'basin') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<path d="M5 9c8 28 46 28 54 0" fill={`url(#${earthDark})`} stroke="#b88a5e" strokeWidth="4" filter={`url(#${relief})`}/><path d="M15 13c6 14 28 14 34 0" fill="none" stroke="#e8c89a" strokeWidth="2" opacity=".8"/></svg>;
  }
  if (type === 'desert') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<circle cx="52" cy="9" r="6" fill="#ffd35f"/><g filter={`url(#${relief})`}><path d="M2 38c10-20 21-19 31 0 10-16 20-16 29 0Z" fill={`url(#${sand})`}/><path d="M5 34c10-8 18-8 27 0M34 34c8-7 16-6 24 0" fill="none" stroke="#ffe9b8" strokeWidth="2" opacity=".7"/></g></svg>;
  }
  if (type === 'valley') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<g filter={`url(#${relief})`}><path d="M2 5 23 40h9L20 15Z" fill={`url(#${earthDark})`}/><path d="M62 5 41 40h-9l12-25Z" fill={`url(#${earth})`}/><path d="M30 40c1-9 2-17 2-26" stroke={`url(#${water})`} strokeWidth="5" strokeLinecap="round"/></g></svg>;
  }
  if (type === 'delta') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 48" aria-hidden="true">{defs}<path d="M32 4 5 43h54Z" fill={`url(#${green})`} filter={`url(#${relief})`}/><path d="M32 5v37m0-22L16 41m16-21 16 21" stroke={`url(#${water})`} strokeWidth="4" strokeLinecap="round" fill="none"/></svg>;
  }
  if (type === 'volcano') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 48" aria-hidden="true">{defs}<g filter={`url(#${relief})`}><path d="M5 44 24 11h16l19 33Z" fill={`url(#${earthDark})`}/><path d="M24 11h16l-4 8h-8Z" fill="#24140f"/><path d="M29 16c0 9 4 14 4 23" stroke={`url(#${lava})`} strokeWidth="5" fill="none"/></g><path d="M26 8c-5-6 4-8-1-15m13 15c7-6-3-9 2-16" stroke="#d7d7d7" strokeWidth="4" fill="none" opacity=".8"/></svg>;
  }
  if (type === 'oasis') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 48" aria-hidden="true">{defs}<ellipse cx="34" cy="40" rx="22" ry="6" fill={`url(#${water})`} filter={`url(#${relief})`}/><path d="M31 38V13" stroke="#6b4324" strokeWidth="5"/><path d="M31 18C17 15 13 7 13 7c12-3 18 3 18 11Zm0 0c12-7 20-12 20-12 1 11-10 16-20 12Z" fill={`url(#${green})`} stroke="#1f5d38" strokeWidth="1.5"/></svg>;
  }
  if (['river', 'canal', 'road', 'railway'].includes(type)) {
    const dashed = type === 'railway' ? '4 3' : undefined;
    const stroke = type === 'road' || type === 'railway' ? `url(#${earth})` : `url(#${water})`;
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<path d="M4 7c17 0 11 14 28 14s12 16 28 16" fill="none" stroke={stroke} strokeWidth={type === 'canal' ? 10 : 7} strokeLinecap="round" strokeDasharray={dashed} filter={`url(#${relief})`}/>{type === 'river' && <path d="M5 6c17 0 11 14 28 14s12 16 27 16" fill="none" stroke="#c9f4ff" strokeWidth="2" opacity=".7"/>}</svg>;
  }
  if (['lake', 'sea', 'ocean', 'gulf', 'bay', 'strait', 'spring', 'groundwater'].includes(type)) {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<path d="M3 13c9-7 15 7 24 0s15 7 24 0 10 0 10 0M3 24c9-7 15 7 24 0s15 7 24 0 10 0 10 0M3 35c9-7 15 7 24 0s15 7 24 0 10 0 10 0" fill="none" stroke={`url(#${water})`} strokeWidth="5" strokeLinecap="round" filter={`url(#${relief})`}/></svg>;
  }
  if (type === 'waterfall' || type === 'dam') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 48" aria-hidden="true">{defs}<path d="M7 9h50" stroke={`url(#${earthDark})`} strokeWidth="8"/><path d="M17 12v24m15-24v30m15-30v24" stroke={`url(#${water})`} strokeWidth="6" strokeLinecap="round" filter={`url(#${relief})`}/><path d="m12 38 5 6 5-6m20 0 5 6 5-6" stroke="#d9f7ff" strokeWidth="2.5" fill="none"/></svg>;
  }
  if (['island', 'peninsula', 'coast'].includes(type)) {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 48" aria-hidden="true">{defs}<path d="M5 36c10-21 16 1 27-18s17 6 27-10v31H5Z" fill={`url(#${green})`} filter={`url(#${relief})`}/><path d="M3 41c11-6 19 6 30 0s19 6 29 0" stroke={`url(#${water})`} strokeWidth="4" fill="none"/></svg>;
  }
  if (type === 'border' || type === 'grid') {
    return <svg className="geography-glyph-svg" viewBox="0 0 64 48" aria-hidden="true">{defs}<path d="M7 5v38m17-38v38m17-38v38m16-38v38M5 11h54M5 27h54M5 43h54" stroke="#e1c46a" strokeWidth="2.5" strokeDasharray={type === 'border' ? '6 4' : undefined}/></svg>;
  }
  if (['pin', 'capital', 'city', 'country', 'port', 'airport', 'tourism', 'archaeology'].includes(type)) {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 56 56" aria-hidden="true">{defs}<path d="M28 4C16 4 9 12 9 23c0 14 19 30 19 30s19-16 19-30C47 12 40 4 28 4Z" fill={`url(#${lava})`} filter={`url(#${relief})`}/><circle cx="28" cy="23" r="8" fill="#fff3cc"/><circle cx="28" cy="23" r="4" fill="#8e4b1f"/></svg>;
  }
  if (['minerals', 'iron', 'gold', 'phosphate', 'salt', 'coal'].includes(type)) {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 56 46" aria-hidden="true">{defs}<path d="m5 25 10-16 15 5 9-9 12 17-9 19H15Z" fill={`url(#${earth})`} filter={`url(#${relief})`}/><path d="m15 9 9 18 6-13 12 27" stroke="#f8dda1" strokeWidth="2.5" opacity=".75"/></svg>;
  }
  if (['petroleum', 'gas'].includes(type)) {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 56 52" aria-hidden="true">{defs}<path d="M28 4C20 16 13 24 13 34a15 15 0 0 0 30 0C43 24 36 16 28 4Z" fill={type === 'gas' ? `url(#${lava})` : '#161616'} filter={`url(#${relief})`}/><path d="M23 41c-5-6-2-12 3-18" stroke="#fff" strokeWidth="3" fill="none" opacity=".8"/></svg>;
  }
  if (type.startsWith('population') || type === 'population') {
    const count = type.endsWith('high') ? 5 : type.endsWith('medium') ? 3 : type.endsWith('low') ? 1 : 3;
    return <span className="geography-population-glyph">{'●'.repeat(count)}</span>;
  }
  if (type === 'latitude') return <span className="geography-line-glyph latitude">↔</span>;
  if (type === 'longitude') return <span className="geography-line-glyph longitude">↕</span>;
  return <span className="geography-fallback-glyph">{symbol || '●'}</span>;
}

function coordinateTicks(min, max, count = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const span = max - min;
  const rough = span / Math.max(2, count);
  const steps = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90];
  const step = steps.find((candidate) => candidate >= rough) || Math.ceil(rough / 90) * 90;
  const first = Math.ceil(min / step) * step;
  const output = [];
  for (let value = first; value <= max + 1e-6; value += step) output.push(Number(value.toFixed(2)));
  return output;
}

function degreeLabel(value, axis) {
  if (Math.abs(value) < 0.001) return '0°';
  if (axis === 'lon') return `${Math.abs(value)}° ${value > 0 ? 'ق' : 'غ'}`;
  return `${Math.abs(value)}° ${value > 0 ? 'ش' : 'ج'}`;
}

function MapReferenceOverlay({ region, project }) {
  const bounds = Array.isArray(region?.bounds) ? region.bounds : [-180, -90, 180, 90];
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const longitudes = coordinateTicks(minLon, maxLon, 7);
  const latitudes = coordinateTicks(minLat, maxLat, 6);
  return (
    <g className="map-pro-reference-grid" aria-hidden="true">
      {longitudes.map((longitude) => {
        const [x] = project(longitude, minLat);
        return <g key={`lon:${longitude}`}><line x1={x} y1="16" x2={x} y2="604"/><text x={x + 5} y="602">{degreeLabel(longitude, 'lon')}</text></g>;
      })}
      {latitudes.map((latitude) => {
        const [, y] = project(minLon, latitude);
        return <g key={`lat:${latitude}`}><line x1="16" y1={y} x2="984" y2={y}/><text x="20" y={Math.max(30, y - 5)}>{degreeLabel(latitude, 'lat')}</text></g>;
      })}
      <rect x="12" y="12" width="976" height="596" rx="14" className="map-pro-neatline"/>
    </g>
  );
}

function MapFurniture({ region }) {
  return (
    <g className="map-pro-furniture" aria-hidden="true">
      <g className="map-pro-compass" transform="translate(925 78)">
        <circle r="48"/>
        <circle r="38" className="inner"/>
        <path d="M0-36 10-4 0 36-10-4Z"/>
        <path d="M-36 0-4-10 36 0-4 10Z" className="minor"/>
        <text x="0" y="-53">ش</text><text x="0" y="62">ج</text><text x="54" y="5">ق</text><text x="-54" y="5">غ</text>
      </g>
      <g className="map-pro-scale" transform="translate(44 560)">
        <rect width="190" height="38" rx="10"/>
        <path d="M16 22h130M16 15v14m65-14v14m65-14v14"/>
        <text x="154" y="25">مقياس تعليمي</text>
      </g>
      <g className="map-pro-region-plaque" transform="translate(36 34)">
        <rect width="250" height="54" rx="13"/>
        <text x="16" y="23" className="eyebrow">خريطة الشرح</text>
        <text x="16" y="43" className="title">{region?.title || 'العالم'}</text>
      </g>
    </g>
  );
}

function MapDefs() {
  return (
    <defs>
      <linearGradient id="mapOcean" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#0a3550"/><stop offset=".42" stopColor="#0f6380"/><stop offset=".72" stopColor="#0a405d"/><stop offset="1" stopColor="#041c2b"/></linearGradient>
      <linearGradient id="mapLand" x1="0" x2=".8" y1="0" y2="1"><stop offset="0" stopColor="#aeb178"/><stop offset=".45" stopColor="#718c5b"/><stop offset="1" stopColor="#426f53"/></linearGradient>
      <linearGradient id="mapLandActive" x1="0" x2="1"><stop offset="0" stopColor="#f4d16e"/><stop offset="1" stopColor="#b87224"/></linearGradient>
      <radialGradient id="mapGlow"><stop offset="0" stopColor="#fff6b5" stopOpacity=".85"/><stop offset="1" stopColor="#f0b531" stopOpacity="0"/></radialGradient>
      <filter id="mapTerrain" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency=".018 .055" numOctaves="4" seed="17" result="noise"/>
        <feDiffuseLighting in="noise" surfaceScale="5" diffuseConstant=".55" lightingColor="#f1d699" result="light"><feDistantLight azimuth="225" elevation="46"/></feDiffuseLighting>
        <feBlend in="SourceGraphic" in2="light" mode="multiply"/>
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".5"/>
      </filter>
      <filter id="mapShadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity=".75"/></filter>
      <pattern id="mapGrid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#b6dbed" strokeOpacity=".07" strokeWidth="1"/></pattern>
    </defs>
  );
}

export default function ProfessionalMap({
  countries = [],
  items = [],
  region = null,
  layerKey = 'countries',
  labels = false,
  showActiveLabel = true,
  highlightedId = '',
  selectedId = '',
  project,
  zoom = 1,
  placements = [],
  onCountryClick,
  onFeatureClick,
  onDropPlacement,
  onMovePlacement,
  onRemovePlacement,
  onStageClick,
  canvasRef,
  drawTool = 'select',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ariaLabel = 'خريطة تفاعلية احترافية',
}) {
  const transformRef = useRef(null);
  const draggingPlacementRef = useRef('');

  const movePlacementFromPointer = (placementId, event) => {
    if (!placementId || !onMovePlacement || !transformRef.current) return;
    const rect = transformRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    onMovePlacement(
      placementId,
      Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    );
  };

  const handleDrop = (event) => {
    const placementId = event.dataTransfer.getData('application/x-mobdea-placement');
    if (placementId && onMovePlacement) {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      onMovePlacement(
        placementId,
        Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
        Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
      );
      return;
    }
    onDropPlacement?.(event);
  };

  return (
    <div className="map-pro-stage" onClick={onStageClick} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <div ref={transformRef} className="map-pro-transform" style={{ transform: `scale(${zoom})` }}>
        <svg viewBox="0 0 1000 620" className="map-pro-svg" role="img" aria-label={ariaLabel}>
          <MapDefs />
          <rect width="1000" height="620" fill="url(#mapOcean)" />
          <rect width="1000" height="620" fill="url(#mapGrid)" />
          <MapReferenceOverlay region={region} project={project} />
          {countries.length === 0 && (
            <g className="map-pro-empty" aria-label="لا توجد حدود خريطة متاحة">
              <rect x="250" y="235" width="500" height="150" rx="22" fill="#071827" stroke="#e2bd63" strokeWidth="2"/>
              <text x="500" y="295" textAnchor="middle">تعذر العثور على حدود لهذه المنطقة</text>
              <text x="500" y="330" textAnchor="middle" className="map-pro-empty-hint">اختر منطقة أخرى أو أعد تحميل بيانات الخرائط</text>
            </g>
          )}
          <g className="map-pro-coastline-halo" aria-hidden="true">
            {countries.map((feature, featureIndex) => (
              <path key={`coast:${getCountryFeatureId(feature, featureIndex)}`} d={geometryPath(feature.geometry, project)} />
            ))}
          </g>
          <g className="map-pro-country-layer">
            {countries.map((feature, featureIndex) => {
              const id = getCountryFeatureId(feature, featureIndex);
              const name = getCountryName(feature);
              const center = project(...featureCenter(feature));
              const active = highlightedId === id || selectedId === id;
              return (
                <g key={id}>
                  <path
                    d={geometryPath(feature.geometry, project)}
                    className={`map-pro-country ${layerKey === 'borders' ? 'borders-only' : ''} ${['countries', 'borders', 'population'].includes(layerKey) ? 'clickable' : ''} ${active ? 'highlighted' : ''}`}
                    fill={active ? '#d49a38' : countryFill(featureIndex)}
                    style={{ '--country-fill': active ? '#d49a38' : countryFill(featureIndex) }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCountryClick?.(id, name, feature, event);
                    }}
                  />
                  {(labels || (active && showActiveLabel)) && <text x={center[0]} y={center[1]} className="map-pro-label">{name}</text>}
                </g>
              );
            })}
          </g>
          {layerKey !== 'countries' && items.map((item) => {
            const point = project(...item.coord);
            const active = highlightedId === item.id || selectedId === item.id;
            return (
              <g key={item.id} className={`map-pro-marker ${active ? 'highlighted' : ''}`} onClick={(event) => { event.stopPropagation(); onFeatureClick?.(item.id, item.name, item, event); }}>
                {active && <circle cx={point[0]} cy={point[1]} r="38" fill="url(#mapGlow)" />}
                <circle cx={point[0]} cy={point[1]} r="13" fill={mapItemColor(layerKey)} filter="url(#mapShadow)" />
                <circle cx={point[0]} cy={point[1]} r="4" fill="#101820" />
                {(labels || (active && showActiveLabel)) && <text x={point[0] + 18} y={point[1] + 5} className="map-pro-feature-label">{item.name}</text>}
              </g>
            );
          })}
          <MapFurniture region={region} />
        </svg>
        <div className="map-pro-placement-layer">
          {placements.map((placement) => (
            <div
              key={placement.id}
              className={`map-pro-placement geography-placement ${(placement.showLabel || placement.type === 'custom-label') ? 'with-label' : 'shape-only'}`}
              style={{ left: `${placement.x}%`, top: `${placement.y}%`, '--placement-color': placement.color }}
              draggable={Boolean(onMovePlacement)}
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.setData('application/x-mobdea-placement', String(placement.id));
              }}
              onPointerDown={(event) => {
                if (!onMovePlacement) return;
                event.preventDefault();
                event.stopPropagation();
                draggingPlacementRef.current = String(placement.id);
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (draggingPlacementRef.current !== String(placement.id)) return;
                event.preventDefault();
                event.stopPropagation();
                movePlacementFromPointer(placement.id, event);
              }}
              onPointerUp={(event) => {
                if (draggingPlacementRef.current !== String(placement.id)) return;
                event.preventDefault();
                event.stopPropagation();
                movePlacementFromPointer(placement.id, event);
                draggingPlacementRef.current = '';
                event.currentTarget.releasePointerCapture?.(event.pointerId);
              }}
              onPointerCancel={() => {
                draggingPlacementRef.current = '';
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onRemovePlacement?.(placement.id);
              }}
              title={onMovePlacement ? 'اسحب لتغيير المكان — اضغط مرتين للحذف' : ''}
            >
              <b className="geography-placement-glyph"><GeographyGlyph type={placement.type} symbol={placement.symbol} /></b>
              {(placement.showLabel || placement.type === 'custom-label') && <strong>{placement.label}</strong>}
              {(placement.showLabel || placement.type === 'custom-label') && placement.hint && <small>{placement.hint}</small>}
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width="1000"
          height="620"
          className={`map-pro-draw-canvas ${['pen', 'eraser', 'highlighter'].includes(drawTool) ? 'active' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}
