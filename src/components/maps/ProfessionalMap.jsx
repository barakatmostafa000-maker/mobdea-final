import { useEffect, useId, useRef, useState } from 'react';
import { geometryPath, featureCenter, getCountryFeatureId, getCountryName } from '../../data/geography';

function mapItemColor(layerKey) {
  return { terrain: '#d8b18d', mountains: '#c69b73', plateaus: '#d0a06b', plains: '#8fc77e', deserts: '#d6ae38', water: '#68b8f5', rivers: '#55aef2', seas: '#65c7e8', minerals: '#eaa0d2', capitals: '#ff846f', cities: '#ff9d77', latitude: '#8ed8ef', longitude: '#a7e3f2', population: '#f0c45f' }[layerKey] || '#f0d478';
}

const COUNTRY_PALETTE = ['#789765', '#86a66d', '#6f9365', '#a69a62', '#62885e', '#91aa72'];
const DESERT_PALETTE = ['#d5b270', '#c99e5c', '#e0c182', '#bd8f4f'];

function countryFill(feature, index = 0) {
  const [, latitude] = featureCenter(feature);
  const continent = String(feature?.properties?.continent || '');
  if ((continent === 'Africa' && latitude > 12) || (continent === 'Asia' && latitude > 12 && latitude < 35)) {
    return DESERT_PALETTE[Math.abs(Number(index || 0)) % DESERT_PALETTE.length];
  }
  if (Math.abs(latitude) < 12) return ['#4f8f58', '#5b9d61', '#477e50'][Math.abs(Number(index || 0)) % 3];
  if (latitude < -20) return ['#78915f', '#87996b', '#6c875d'][Math.abs(Number(index || 0)) % 3];
  return COUNTRY_PALETTE[Math.abs(Number(index || 0)) % COUNTRY_PALETTE.length];
}


function FallbackGeographyGlyph({ type = '', symbol = '●' }) {
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
    return <svg className="geography-glyph-svg relief-glyph terrain-3d mountain-3d" viewBox="0 0 96 70" aria-hidden="true">{defs}
      <ellipse cx="49" cy="61" rx="42" ry="6" fill="#020202" opacity=".38"/>
      <g filter={`url(#${relief})`}>
        <path d="M2 59 24 27 34 39 52 6 67 31 76 20 94 59Z" fill={`url(#${earth})`}/>
        <path d="M52 6 39 43 52 32 65 59h29L67 31Z" fill="#4b2d1e" opacity=".88"/>
        <path d="M24 27 4 59h30l7-17Z" fill="#654126" opacity=".82"/>
        <path d="M76 20 64 42l12-8 18 25H81Z" fill="#57351f" opacity=".82"/>
        <path d="m18 36 6-9 7 10-7-4Zm24-12 10-18 13 22-13-9Zm27 8 7-12 8 13-8-5Z" fill="#fffaf0"/>
        <path d="M8 55c19-5 43-5 76-1" fill="none" stroke="#d7b16d" strokeWidth="2.2" opacity=".68"/>
        <path d="M12 49c16-4 38-4 62 0M16 44c11-3 25-3 39-1" fill="none" stroke="#f0d79c" strokeWidth="1.35" opacity=".56"/>
        <path d="M35 54c3-8 7-12 13-16" fill="none" stroke="#7ba464" strokeWidth="3.2" opacity=".72"/>
      </g>
    </svg>;
  }
  if (type === 'plateaus') {
    return <svg className="geography-glyph-svg relief-glyph terrain-3d plateau-3d" viewBox="0 0 96 68" aria-hidden="true">{defs}
      <ellipse cx="48" cy="60" rx="40" ry="6" fill="#000" opacity=".31"/>
      <g filter={`url(#${relief})`}>
        <path d="M8 52 18 23 72 23 89 50 71 61 25 61Z" fill={`url(#${earthDark})`}/>
        <path d="M18 23 72 23 85 34 13 34Z" fill="#ddb16d"/>
        <path d="M13 34 85 34 89 50 71 61 25 61 8 52Z" fill={`url(#${earth})`}/>
        <path d="M21 24 68 24 61 29 27 29Z" fill="#ffe4ab" opacity=".75"/>
        <path d="M17 40c19-5 43-5 64 0M14 47c20-5 49-4 70 1M20 53c17-4 36-3 52 1" fill="none" stroke="#f1cf91" strokeWidth="1.45" opacity=".56"/>
        <path d="M30 29c10-4 22-4 34-1" fill="none" stroke="#8fa668" strokeWidth="3" opacity=".5"/>
      </g>
    </svg>;
  }
  if (type === 'plains') {
    return <svg className="geography-glyph-svg relief-glyph terrain-3d plains-3d" viewBox="0 0 82 58" aria-hidden="true">{defs}
      <ellipse cx="42" cy="51" rx="35" ry="4" fill="#000" opacity=".2"/>
      <g filter={`url(#${relief})`}>
        <path d="M8 39 26 23 74 28 58 50 17 50Z" fill={`url(#${green})`}/>
        <path d="M17 50 58 50 74 28 72 38 60 54 18 54Z" fill="#194d31" opacity=".75"/>
        <path d="M16 39 64 35M22 45 58 42M31 28 24 49M45 27 39 50M59 29 52 49" stroke="#d8f2a8" strokeWidth="1.2" opacity=".45"/>
      </g>
    </svg>;
  }
  if (type === 'depression' || type === 'basin') {
    return <svg className="geography-glyph-svg relief-glyph" viewBox="0 0 64 44" aria-hidden="true">{defs}<path d="M5 9c8 28 46 28 54 0" fill={`url(#${earthDark})`} stroke="#b88a5e" strokeWidth="4" filter={`url(#${relief})`}/><path d="M15 13c6 14 28 14 34 0" fill="none" stroke="#e8c89a" strokeWidth="2" opacity=".8"/></svg>;
  }
  if (type === 'desert') {
    return <svg className="geography-glyph-svg relief-glyph terrain-3d desert-3d" viewBox="0 0 82 58" aria-hidden="true">{defs}
      <circle cx="67" cy="10" r="7" fill="#ffd45f"/><circle cx="67" cy="10" r="11" fill="#ffd45f" opacity=".16"/>
      <ellipse cx="41" cy="51" rx="36" ry="4" fill="#000" opacity=".18"/>
      <g filter={`url(#${relief})`}>
        <path d="M4 49c12-25 25-24 37 0 12-18 25-17 37 0Z" fill={`url(#${sand})`}/>
        <path d="M7 44c12-10 23-10 34 0M43 44c10-8 20-8 30 0" fill="none" stroke="#fff0bf" strokeWidth="2.2" opacity=".72"/>
        <path d="M18 50c7-7 13-7 20 0M51 50c6-5 12-5 19 0" fill="none" stroke="#9b641f" strokeWidth="2" opacity=".5"/>
      </g>
    </svg>;
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

export function GeographyGlyph({ type = '', symbol = '●' }) {
  const [assetFailed, setAssetFailed] = useState(false);
  const safeType = String(type || '').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  if (safeType && !assetFailed) {
    return (
      <img
        className={`geography-glyph-image geography-glyph-asset type-${safeType}`}
        src={`/map-symbols/${safeType}.png`}
        alt=""
        aria-hidden="true"
        draggable="false"
        onError={() => setAssetFailed(true)}
      />
    );
  }
  return <FallbackGeographyGlyph type={type} symbol={symbol} />;
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

function polylinePath(coords = [], project) {
  return coords.map((point, index) => `${index ? 'L' : 'M'}${project(point[0], point[1]).join(',')}`).join(' ');
}

function MapCoordinateFocusOverlay({ region, project, axis = '' }) {
  const bounds = Array.isArray(region?.bounds) ? region.bounds : [-180, -90, 180, 90];
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const longitudes = coordinateTicks(minLon, maxLon, 9);
  const latitudes = coordinateTicks(minLat, maxLat, 8);
  return (
    <g className={`map-pro-coordinate-focus axis-${axis}`} aria-label={axis === 'longitude' ? 'خطوط الطول' : 'دوائر العرض'}>
      {(axis === 'longitude' ? longitudes : latitudes).map((value) => {
        if (axis === 'longitude') {
          const [x] = project(value, minLat);
          return <g key={`focus-lon:${value}`}><line x1={x} y1="8" x2={x} y2="612"/><text x={x + 5} y="594">{degreeLabel(value, 'lon')}</text></g>;
        }
        const [, y] = project(minLon, value);
        return <g key={`focus-lat:${value}`}><line x1="8" y1={y} x2="992" y2={y}/><text x="18" y={Math.max(28, y - 5)}>{degreeLabel(value, 'lat')}</text></g>;
      })}
    </g>
  );
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
      <g className="map-pro-region-plaque" transform="translate(385 18)">
        <rect width="230" height="46" rx="11"/>
        <text x="115" y="18" textAnchor="middle" className="eyebrow">خريطة الشرح</text>
        <text x="115" y="37" textAnchor="middle" className="title">{region?.title || 'العالم'}</text>
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
      <filter id="mapTerrain" x="-18%" y="-18%" width="136%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency=".011 .038" numOctaves="5" seed="23" result="noise"/>
        <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
        <feDiffuseLighting in="mono" surfaceScale="7.2" diffuseConstant=".72" lightingColor="#f5e4bb" result="light"><feDistantLight azimuth="232" elevation="48"/></feDiffuseLighting>
        <feBlend in="SourceGraphic" in2="light" mode="soft-light" result="terrain"/>
        <feSpecularLighting in="mono" surfaceScale="3" specularConstant=".22" specularExponent="12" lightingColor="#fff5d1" result="shine"><feDistantLight azimuth="210" elevation="55"/></feSpecularLighting>
        <feBlend in="terrain" in2="shine" mode="screen"/>
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#001014" floodOpacity=".48"/>
      </filter>
      <filter id="mapOceanTexture" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".012 .025" numOctaves="3" seed="9" result="waves"/>
        <feColorMatrix in="waves" values="1 0 0 0 0  0 1 0 0 .05  0 0 1 0 .12  0 0 0 .18 0" result="waveTint"/>
        <feBlend in="SourceGraphic" in2="waveTint" mode="soft-light"/>
      </filter>
      <filter id="mapShadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity=".75"/></filter>
      <pattern id="mapGrid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#d8eef4" strokeOpacity=".055" strokeWidth="1"/></pattern>
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
  selectedPlacementId = '',
  onSelectPlacement,
  onCountryClick,
  onFeatureClick,
  onDropPlacement,
  onMovePlacement,
  onResizePlacement,
  onRemovePlacement,
  onStageClick,
  canvasRef,
  drawTool = 'select',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ariaLabel = 'خريطة تفاعلية احترافية',
  mapStyle = 'relief',
  silent = false,
  lineFeatures = [],
  pointFeatures = [],
  highlightCountryIsos = [],
}) {
  const stageRef = useRef(null);
  const transformRef = useRef(null);
  const draggingPlacementRef = useRef('');
  const panPointerRef = useRef(null);
  const suppressStageClickRef = useRef(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    panPointerRef.current = null;
    setPan({ x: 0, y: 0 });
  }, [region?.title]);

  useEffect(() => {
    if (Number(zoom || 1) <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const startMapPan = (event) => {
    if (Number(zoom || 1) <= 1) return;
    if (event.button != null && event.button !== 0) return;
    if (event.target?.closest?.('.map-pro-placement, .map-pro-placement-actions, .map-pro-draw-canvas.active')) return;
    panPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: Number(pan.x || 0),
      panY: Number(pan.y || 0),
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveMapPan = (event) => {
    const pending = panPointerRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    const dx = Number(event.clientX) - pending.startX;
    const dy = Number(event.clientY) - pending.startY;
    if (!pending.moved && Math.hypot(dx, dy) < 5) return;
    pending.moved = true;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return;
    const scale = Math.max(1, Number(zoom || 1));
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    setPan({
      x: Math.max(-maxX, Math.min(maxX, pending.panX + dx)),
      y: Math.max(-maxY, Math.min(maxY, pending.panY + dy)),
    });
  };

  const finishMapPan = (event) => {
    const pending = panPointerRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    panPointerRef.current = null;
    if (pending.moved) suppressStageClickRef.current = true;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

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
    <div
      ref={stageRef}
      className={`map-pro-stage map-style-${mapStyle} ${silent ? 'silent-map' : ''} ${Number(zoom || 1) > 1 ? 'can-pan' : ''}`}
      onClickCapture={(event) => {
        if (!suppressStageClickRef.current) return;
        suppressStageClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={onStageClick}
      onPointerDown={startMapPan}
      onPointerMove={moveMapPan}
      onPointerUp={finishMapPan}
      onPointerCancel={finishMapPan}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div ref={transformRef} className="map-pro-transform" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}>
        <svg viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet" className="map-pro-svg" role="img" aria-label={ariaLabel}>
          <MapDefs />
          <rect className="map-pro-ocean" width="1000" height="620" fill="url(#mapOcean)" filter={mapStyle === 'relief' ? 'url(#mapOceanTexture)' : undefined} />
          {!silent && <rect width="1000" height="620" fill="url(#mapGrid)" />}
          {!silent && !['latitude', 'longitude'].includes(layerKey) && <MapReferenceOverlay region={region} project={project} />}
          {!silent && ['latitude', 'longitude'].includes(layerKey) && <MapCoordinateFocusOverlay region={region} project={project} axis={layerKey} />}
          {countries.length === 0 && (
            <g className="map-pro-empty" aria-label="لا توجد حدود خريطة متاحة">
              <rect x="250" y="235" width="500" height="150" rx="22" fill="#071827" stroke="#e2bd63" strokeWidth="2"/>
              <text x="500" y="295" textAnchor="middle">تعذر العثور على حدود لهذه المنطقة</text>
              <text x="500" y="330" textAnchor="middle" className="map-pro-empty-hint">اختر منطقة أخرى أو أعد تحميل بيانات الخرائط</text>
            </g>
          )}
          <g className={`map-pro-coastline-halo ${silent ? 'hidden-in-silent' : ''}`} aria-hidden="true">
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
              const basin = highlightCountryIsos.includes(id);
              return (
                <g key={id}>
                  <path
                    d={geometryPath(feature.geometry, project)}
                    className={`map-pro-country ${silent ? 'silent-country' : ''} ${layerKey === 'borders' ? 'borders-only' : ''} ${['countries', 'borders', 'population'].includes(layerKey) ? 'clickable' : ''} ${active ? 'highlighted' : ''} ${basin ? 'basin-country' : ''}`}
                    fill={silent ? '#d9d6b8' : active ? '#d49a38' : countryFill(feature, featureIndex)}
                    style={{ '--country-fill': silent ? '#d9d6b8' : active ? '#d49a38' : countryFill(feature, featureIndex) }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCountryClick?.(id, name, feature, event);
                    }}
                  />
                  {!silent && (labels || (active && showActiveLabel)) && <text x={center[0]} y={center[1]} className="map-pro-label">{name}</text>}
                </g>
              );
            })}
          </g>
          {!silent && mapStyle === 'relief' && (
            <g className="map-pro-terrain-wash" aria-hidden="true">
              {countries.map((feature, featureIndex) => <path key={`terrain:${getCountryFeatureId(feature, featureIndex)}`} d={geometryPath(feature.geometry, project)} />)}
            </g>
          )}
          {!silent && lineFeatures.length > 0 && (
            <g className="map-pro-river-lines" aria-label="الأنهار والمجاري المائية">
              {lineFeatures.map((line) => (
                <g key={line.id} className={`map-pro-river-line kind-${line.kind || 'river'}`} onClick={(event) => { event.stopPropagation(); onFeatureClick?.(line.id, line.name, line, event); }}>
                  <path d={polylinePath(line.coords, project)} />
                  <path className="river-highlight" d={polylinePath(line.coords, project)} />
                </g>
              ))}
            </g>
          )}
          {!silent && pointFeatures.length > 0 && (
            <g className="map-pro-hydro-points" aria-label="عناصر نهر النيل">
              {pointFeatures.map((item) => {
                const point = project(...item.coord);
                const active = selectedId === item.id || highlightedId === item.id;
                return <g key={item.id} className={`map-pro-hydro-point kind-${item.kind || 'point'} ${active ? 'highlighted' : ''}`} onClick={(event) => { event.stopPropagation(); onFeatureClick?.(item.id, item.name, item, event); }}>
                  <circle cx={point[0]} cy={point[1]} r={item.kind === 'lake' ? 10 : 8}/>
                  <text x={point[0] + 13} y={point[1] + 5}>{item.name}</text>
                </g>;
              })}
            </g>
          )}
          {!silent && !['countries', 'latitude', 'longitude'].includes(layerKey) && items.map((item) => {
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
          {!silent && <MapFurniture region={region} />}
        </svg>
        <div className="map-pro-placement-layer">
          {placements.map((placement) => (
            <div
              key={placement.id}
              className={`map-pro-placement geography-placement ${(placement.showLabel || placement.type === 'custom-label') ? 'with-label' : 'shape-only'} ${selectedPlacementId === placement.id ? 'selected' : ''}`}
              style={{ left: `${placement.x}%`, top: `${placement.y}%`, '--placement-color': placement.color, '--placement-scale': Number(placement.size || 1) }}
              draggable={Boolean(onMovePlacement)}
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.setData('application/x-mobdea-placement', String(placement.id));
              }}
              onPointerDown={(event) => {
                if (!onMovePlacement) return;
                event.preventDefault();
                event.stopPropagation();
                onSelectPlacement?.(placement.id);
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
              {selectedPlacementId === placement.id && (
                <div className="map-pro-placement-actions" role="toolbar" aria-label={`التحكم في ${placement.label || 'الرمز'}`}>
                  <button type="button" aria-label="تصغير الرمز" title="تصغير" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onResizePlacement?.(placement.id, -0.2); }}>−</button>
                  <button type="button" aria-label="تكبير الرمز" title="تكبير" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onResizePlacement?.(placement.id, 0.2); }}>+</button>
                  <button type="button" className="danger" aria-label="حذف الرمز" title="حذف" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onRemovePlacement?.(placement.id); }}>×</button>
                </div>
              )}
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
