import { useRef } from 'react';
import { geometryPath, featureCenter, getCountryFeatureId, getCountryName } from '../../data/geography';

function mapItemColor(layerKey) {
  return { terrain: '#d8b18d', mountains: '#c69b73', plateaus: '#d0a06b', plains: '#8fc77e', deserts: '#d6ae38', water: '#68b8f5', rivers: '#55aef2', seas: '#65c7e8', minerals: '#eaa0d2', capitals: '#ff846f', cities: '#ff9d77', latitude: '#8ed8ef', longitude: '#a7e3f2', population: '#f0c45f' }[layerKey] || '#f0d478';
}

const COUNTRY_PALETTE = ['#708956', '#7f955d', '#68845e', '#8b9255', '#5f7f59', '#839a69'];

function countryFill(index = 0) {
  return COUNTRY_PALETTE[Math.abs(Number(index || 0)) % COUNTRY_PALETTE.length];
}


export function GeographyGlyph({ type = '', symbol = '●' }) {
  if (type === 'mountains') {
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M2 29 15 7l8 13L31 3l15 26Z" fill="currentColor"/><path d="m11 14 4-7 4 7-4-2Zm16-4 4-7 5 9-5-3Z" fill="#fff" opacity=".8"/></svg>;
  }
  if (type === 'plateaus') {
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M4 28 11 8h27l6 20Z" fill="currentColor"/><path d="M11 8h27" stroke="#fff" strokeWidth="3" opacity=".75"/></svg>;
  }
  if (type === 'plains') {
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M3 11h42M3 17h42M3 23h42" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M8 7v19M22 7v19M36 7v19" stroke="#fff" strokeWidth="1" opacity=".55"/></svg>;
  }
  if (type === 'depression' || type === 'basin') {
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M4 7c6 20 34 20 40 0" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/><path d="M12 11c5 11 19 11 24 0" fill="none" stroke="#fff" strokeWidth="2" opacity=".7"/></svg>;
  }
  if (type === 'desert') {
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M1 25c8-15 15-15 23 0 8-13 15-13 23 0Z" fill="currentColor"/><circle cx="36" cy="7" r="5" fill="#fff" opacity=".85"/></svg>;
  }
  if (type === 'valley') {
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M2 4 19 29h10L46 4 33 18 24 27 15 18Z" fill="currentColor"/><path d="M24 27v-12" stroke="#fff" strokeWidth="2" opacity=".7"/></svg>;
  }
  if (type === 'delta') {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M24 2 4 34h40Z" fill="currentColor"/><path d="M24 5v28m0-17L13 31m11-15 11 15" stroke="#fff" strokeWidth="2" opacity=".8"/></svg>;
  }
  if (type === 'volcano') {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="m5 34 14-25h10l14 25Z" fill="currentColor"/><path d="M19 9h10l-2 5h-6Z" fill="#111"/><path d="M22 7c-5-5 3-7-1-11m6 11c6-5-2-7 2-11" stroke="#fff" strokeWidth="3" fill="none" opacity=".8"/></svg>;
  }
  if (type === 'oasis') {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><ellipse cx="25" cy="29" rx="18" ry="5" fill="currentColor"/><path d="M24 27V10m0 4C14 12 10 5 10 5c9-2 13 3 14 9Zm0 0c9-5 14-9 14-9 1 8-6 12-14 9Z" stroke="#fff" strokeWidth="3" fill="none"/></svg>;
  }
  if (['river', 'canal', 'road', 'railway'].includes(type)) {
    const dashed = type === 'railway' ? '3 3' : undefined;
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M3 5c12 0 8 10 20 10s9 12 22 12" fill="none" stroke="currentColor" strokeWidth={type === 'canal' ? 8 : 6} strokeLinecap="round" strokeDasharray={dashed}/>{type === 'railway' && <path d="M4 9c12 0 8 10 20 10s9 12 21 12" fill="none" stroke="#fff" strokeWidth="1.5"/>}</svg>;
  }
  if (['lake', 'sea', 'ocean', 'gulf', 'bay', 'strait', 'spring', 'groundwater'].includes(type)) {
    return <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M2 9c7-5 11 5 18 0s11 5 18 0 8 0 8 0M2 17c7-5 11 5 18 0s11 5 18 0 8 0 8 0M2 25c7-5 11 5 18 0s11 5 18 0 8 0 8 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
  }
  if (type === 'waterfall' || type === 'dam') {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M5 7h38" stroke="currentColor" strokeWidth="6"/><path d="M13 9v18m11-18v23m11-23v18" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="m9 29 4 5 4-5m13 0 4 5 4-5" stroke="#fff" strokeWidth="2" fill="none"/></svg>;
  }
  if (['island', 'peninsula', 'coast'].includes(type)) {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M4 28c8-15 12 0 20-13s13 4 20-7v22H4Z" fill="currentColor"/><path d="M2 31c8-4 14 4 22 0s14 4 22 0" stroke="#fff" strokeWidth="2.5" fill="none"/></svg>;
  }
  if (type === 'border' || type === 'grid') {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M5 4v28m13-28v28m13-28v28m12-28v28M4 8h40M4 20h40M4 32h40" stroke="currentColor" strokeWidth="2" strokeDasharray={type === 'border' ? '5 3' : undefined}/></svg>;
  }
  if (['pin', 'capital', 'city', 'country', 'port', 'airport', 'tourism', 'archaeology'].includes(type)) {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3C14 3 8 10 8 19c0 12 16 26 16 26s16-14 16-26C40 10 34 3 24 3Z" fill="currentColor"/><circle cx="24" cy="19" r="6" fill="#fff"/></svg>;
  }
  if (['minerals', 'iron', 'gold', 'phosphate', 'salt', 'coal'].includes(type)) {
    return <svg viewBox="0 0 48 38" aria-hidden="true"><path d="m4 20 9-13 13 4 8-7 10 14-8 16H13Z" fill="currentColor"/><path d="m13 7 8 14 5-10 10 23" stroke="#fff" strokeWidth="2" opacity=".65"/></svg>;
  }
  if (['petroleum', 'gas'].includes(type)) {
    return <svg viewBox="0 0 48 42" aria-hidden="true"><path d="M24 3C17 13 11 20 11 28a13 13 0 0 0 26 0C37 20 31 13 24 3Z" fill="currentColor"/><path d="M20 34c-4-5-1-10 2-14" stroke="#fff" strokeWidth="3" fill="none" opacity=".8"/></svg>;
  }
  if (type.startsWith('population') || type === 'population') {
    const count = type.endsWith('high') ? 5 : type.endsWith('medium') ? 3 : type.endsWith('low') ? 1 : 3;
    return <span className="geography-population-glyph">{'●'.repeat(count)}</span>;
  }
  if (type === 'latitude') return <span className="geography-line-glyph latitude">↔</span>;
  if (type === 'longitude') return <span className="geography-line-glyph longitude">↕</span>;
  return <span>{symbol || '●'}</span>;
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
