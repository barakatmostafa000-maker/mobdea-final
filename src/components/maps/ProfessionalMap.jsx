import { geometryPath, featureCenter, getCountryName } from '../../data/geography';

function mapItemColor(layerKey) {
  return { terrain: '#d8b18d', water: '#68b8f5', minerals: '#eaa0d2', capitals: '#ff846f' }[layerKey] || '#f0d478';
}

function MapDefs() {
  return (
    <defs>
      <linearGradient id="mapOcean" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#06213a"/><stop offset=".45" stopColor="#0b4267"/><stop offset="1" stopColor="#021525"/></linearGradient>
      <linearGradient id="mapLand" x1="0" x2=".8" y1="0" y2="1"><stop offset="0" stopColor="#d4b16a"/><stop offset=".33" stopColor="#9e8a55"/><stop offset=".65" stopColor="#4e7549"/><stop offset="1" stopColor="#25523e"/></linearGradient>
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
  layerKey = 'countries',
  labels = false,
  highlightedId = '',
  selectedId = '',
  project,
  zoom = 1,
  placements = [],
  onCountryClick,
  onFeatureClick,
  onDropPlacement,
  onStageClick,
  canvasRef,
  drawTool = 'select',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ariaLabel = 'خريطة تفاعلية احترافية',
}) {
  return (
    <div className="map-pro-stage" onClick={onStageClick} onDragOver={(event) => event.preventDefault()} onDrop={onDropPlacement}>
      <div className="map-pro-transform" style={{ transform: `scale(${zoom})` }}>
        <svg viewBox="0 0 1000 620" className="map-pro-svg" role="img" aria-label={ariaLabel}>
          <MapDefs />
          <rect width="1000" height="620" fill="url(#mapOcean)" />
          <rect width="1000" height="620" fill="url(#mapGrid)" />
          <g className="map-pro-coast-glow" filter="url(#mapTerrain)">
            {countries.map((feature) => {
              const id = feature.properties.iso_a3;
              const name = getCountryName(feature);
              const center = project(...featureCenter(feature));
              const active = highlightedId === id || selectedId === id;
              return (
                <g key={id}>
                  <path
                    d={geometryPath(feature.geometry, project)}
                    className={`map-pro-country ${layerKey === 'countries' ? 'clickable' : ''} ${active ? 'highlighted' : ''}`}
                    fill={active ? 'url(#mapLandActive)' : 'url(#mapLand)'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCountryClick?.(id, name, feature);
                    }}
                  />
                  {(labels || active) && <text x={center[0]} y={center[1]} className="map-pro-label">{name}</text>}
                </g>
              );
            })}
          </g>
          {layerKey !== 'countries' && items.map((item) => {
            const point = project(...item.coord);
            const active = highlightedId === item.id || selectedId === item.id;
            return (
              <g key={item.id} className={`map-pro-marker ${active ? 'highlighted' : ''}`} onClick={(event) => { event.stopPropagation(); onFeatureClick?.(item.id, item.name, item); }}>
                {active && <circle cx={point[0]} cy={point[1]} r="38" fill="url(#mapGlow)" />}
                <circle cx={point[0]} cy={point[1]} r="13" fill={mapItemColor(layerKey)} filter="url(#mapShadow)" />
                <circle cx={point[0]} cy={point[1]} r="4" fill="#101820" />
                {(labels || active) && <text x={point[0] + 18} y={point[1] + 5} className="map-pro-feature-label">{item.name}</text>}
              </g>
            );
          })}
          <g className="map-pro-compass" transform="translate(925 78)"><circle r="44"/><path d="M0-35 10-4 0 35-10-4Z"/><text x="0" y="-49">ش</text></g>
        </svg>
        <div className="map-pro-placement-layer">
          {placements.map((placement) => (
            <div key={placement.id} className="map-pro-placement geography-placement" style={{ left: `${placement.x}%`, top: `${placement.y}%`, '--placement-color': placement.color }}>
              <b>{placement.symbol || '●'}</b>
              <strong>{placement.label}</strong>
              {placement.hint && <small>{placement.hint}</small>}
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width="1000"
          height="620"
          className={`map-pro-draw-canvas ${['pen', 'eraser', 'highlighter'].includes(drawTool) ? 'active' : ''}`}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>
    </div>
  );
}
