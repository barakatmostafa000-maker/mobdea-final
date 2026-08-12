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
  const contentRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [metrics, setMetrics] = useState({ hostWidth: 0, hostHeight: 0, contentWidth: 0, contentHeight: 0 });

  const safeZoom = clamp(Number(zoom || 1), minZoom, maxZoom);

  const measure = () => {
    const host = hostRef.current;
    const content = contentRef.current;
    if (!host || !content) return;
    const child = content.firstElementChild;
    const hostRect = host.getBoundingClientRect();
    const childWidth = Number(child?.offsetWidth || child?.clientWidth || hostRect.width || 0);
    const childHeight = Number(child?.offsetHeight || child?.clientHeight || hostRect.height || 0);
    setMetrics((current) => {
      const next = {
        hostWidth: Math.max(1, hostRect.width || 1),
        hostHeight: Math.max(1, hostRect.height || 1),
        contentWidth: Math.max(1, childWidth || hostRect.width || 1),
        contentHeight: Math.max(1, childHeight || hostRect.height || 1),
      };
      return Object.keys(next).every((key) => Math.abs(next[key] - current[key]) < 1) ? current : next;
    });
  };

  useEffect(() => {
    measure();
    const host = hostRef.current;
    const content = contentRef.current;
    if (!host || !content || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(content);
    if (content.firstElementChild) observer.observe(content.firstElementChild);
    const mutation = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => {
      measure();
      if (content.firstElementChild) observer.observe(content.firstElementChild);
    }) : null;
    mutation?.observe(content, { childList: true, subtree: false });
    window.addEventListener('orientationchange', measure);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      mutation?.disconnect();
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  });

  const panLimits = useMemo(() => {
    const scaledWidth = metrics.contentWidth * safeZoom;
    const scaledHeight = metrics.contentHeight * safeZoom;
    const x = Math.max(0, (scaledWidth - metrics.hostWidth) / 2);
    const y = Math.max(0, (scaledHeight - metrics.hostHeight) / 2);
    // A little extra travel makes portrait textbook pages comfortable on a landscape phone.
    return {
      x: x + Math.max(0, metrics.hostWidth * (safeZoom - 1) * 0.08),
      y: y + Math.max(0, metrics.hostHeight * (safeZoom - 1) * 0.22),
    };
  }, [metrics.contentHeight, metrics.contentWidth, metrics.hostHeight, metrics.hostWidth, safeZoom]);

  const canPan = panLimits.x > 1 || panLimits.y > 1;

  useEffect(() => {
    setPan((current) => ({
      x: clamp(current.x, -panLimits.x, panLimits.x),
      y: clamp(current.y, -panLimits.y, panLimits.y),
    }));
  }, [panLimits.x, panLimits.y]);

  const pointerDistance = () => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const handlePointerDown = (event) => {
    measure();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      gestureRef.current = { kind: 'pinch', distance: pointerDistance(), zoom: safeZoom };
      return;
    }
    if (canPan) {
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
    if (gesture.kind === 'pan' && canPan) {
      event.preventDefault();
      setPan({
        x: clamp(gesture.panX + event.clientX - gesture.x, -panLimits.x, panLimits.x),
        y: clamp(gesture.panY + event.clientY - gesture.y, -panLimits.y, panLimits.y),
      });
    }
  };

  const finishPointer = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1 && canPan) {
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
      data-can-pan={canPan ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onDoubleClick={reset}
    >
      <div
        ref={contentRef}
        className="classmode-panzoom-content"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${safeZoom})` }}
      >
        {children}
      </div>
    </div>
  );
}
