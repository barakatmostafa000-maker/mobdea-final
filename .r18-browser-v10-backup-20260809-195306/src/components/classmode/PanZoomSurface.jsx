import { useEffect, useMemo, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function PanZoomSurface({
  zoom = 1,
  onZoomChange,
  minZoom = 1,
  maxZoom = 4,
  className = '',
  children,
  ariaLabel = 'مساحة قابلة للتكبير والتحريك',
}) {
  const hostRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const safeZoom = clamp(Number(zoom || 1), minZoom, maxZoom);

  const panLimits = useMemo(() => {
    const host = hostRef.current;
    if (!host || safeZoom <= 1) return { x: 0, y: 0 };
    const rect = host.getBoundingClientRect();
    return {
      x: Math.max(0, (rect.width * (safeZoom - 1)) / 2),
      y: Math.max(0, (rect.height * (safeZoom - 1)) / 2),
    };
  }, [safeZoom]);

  useEffect(() => {
    if (safeZoom <= 1.001) setPan({ x: 0, y: 0 });
    else setPan((current) => ({
      x: clamp(current.x, -panLimits.x, panLimits.x),
      y: clamp(current.y, -panLimits.y, panLimits.y),
    }));
  }, [safeZoom, panLimits.x, panLimits.y]);

  const pointerDistance = () => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      gestureRef.current = { kind: 'pinch', distance: pointerDistance(), zoom: safeZoom };
      return;
    }
    if (safeZoom > 1.001) {
      gestureRef.current = { kind: 'pan', x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (pointersRef.current.size >= 2) {
      event.preventDefault();
      const distance = pointerDistance();
      if (!gesture.distance) gesture.distance = distance;
      const nextZoom = clamp(gesture.zoom * (distance / Math.max(1, gesture.distance)), minZoom, maxZoom);
      onZoomChange?.(Number(nextZoom.toFixed(2)));
      return;
    }
    if (gesture.kind === 'pan' && safeZoom > 1.001) {
      event.preventDefault();
      setPan({
        x: clamp(gesture.panX + event.clientX - gesture.x, -panLimits.x, panLimits.x),
        y: clamp(gesture.panY + event.clientY - gesture.y, -panLimits.y, panLimits.y),
      });
    }
  };

  const finishPointer = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1 && safeZoom > 1.001) {
      const point = [...pointersRef.current.values()][0];
      gestureRef.current = { kind: 'pan', x: point.x, y: point.y, panX: pan.x, panY: pan.y };
    } else if (pointersRef.current.size === 0) {
      gestureRef.current = null;
    }
  };

  const reset = () => {
    setPan({ x: 0, y: 0 });
    onZoomChange?.(minZoom);
  };

  return (
    <div
      ref={hostRef}
      className={`classmode-panzoom-viewport ${className}`}
      role="application"
      aria-label={ariaLabel}
      data-zoom={safeZoom.toFixed(2)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onDoubleClick={reset}
    >
      <div
        className="classmode-panzoom-content"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${safeZoom})` }}
      >
        {children}
      </div>
    </div>
  );
}
