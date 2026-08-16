import { useEffect, useMemo, useState } from 'react';
import { File, FileText, Presentation } from 'lucide-react';
import PptxPreview from './PptxPreview';
import PdfCanvasPreview from './PdfCanvasPreview';
import PanZoomSurface from './PanZoomSurface';

const INLINE_MEDIA_TYPES = new Set(['image', 'video', 'audio', 'pdf', 'textbook', 'slides']);

function MediaState({ kind = 'loading', title, detail = '' }) {
  const Icon = kind === 'missing' ? File : kind === 'error' ? FileText : Presentation;
  return (
    <div className={`classmode-media-state ${kind === 'error' || kind === 'missing' ? 'error' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={38}/>
      <strong>{title}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function imageMime(resource = {}, blob = null) {
  const blobType = String(blob?.type || '').toLowerCase();
  if (blobType.startsWith('image/')) return blobType;
  const mime = String(resource.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return mime;
  const name = String(resource.fileName || resource.title || '').toLowerCase();
  if (/\.png$/.test(name)) return 'image/png';
  if (/\.webp$/.test(name)) return 'image/webp';
  if (/\.gif$/.test(name)) return 'image/gif';
  if (/\.svg$/.test(name)) return 'image/svg+xml';
  return 'image/jpeg';
}

function RobustImage({ resource, source, zoom = 1, onZoomChange }) {
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [fitMode, setFitMode] = useState('contain');
  const normalizedBlob = useMemo(() => {
    if (!(source?.blob instanceof Blob) || source.blob.size <= 0) return null;
    const mime = imageMime(resource, source.blob);
    return source.blob.type === mime ? source.blob : source.blob.slice(0, source.blob.size, mime);
  }, [resource?.fileName, resource?.mimeType, resource?.title, source?.blob]);

  useEffect(() => {
    if (!normalizedBlob) {
      setFallbackUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(normalizedBlob);
    setFallbackUrl(url);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [normalizedBlob]);

  const src = fallbackUrl || source?.url || resource?.url || '';
  if (!src || failed) return null;
  return (
    <div className={`classmode-image-stage fit-${fitMode}`}>
      <PanZoomSurface
        zoom={zoom}
        onZoomChange={onZoomChange}
        maxZoom={4}
        className="classmode-image-panzoom"
        ariaLabel="الصورة — قرّب بإصبعين واسحب بعد التكبير"
      >
        <img
          key={`${resource.id}:${src}`}
          className="unified-media-image"
          src={src}
          alt={resource.title || resource.fileName || 'صورة الدرس'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </PanZoomSurface>
      <div className="classmode-image-fit-controls" role="group" aria-label="طريقة عرض الصورة">
        <button type="button" className={fitMode === 'contain' ? 'active' : ''} onClick={() => setFitMode('contain')}>احتواء</button>
        <button type="button" className={fitMode === 'width' ? 'active' : ''} onClick={() => setFitMode('width')}>ملء العرض</button>
        <button type="button" className={fitMode === 'cover' ? 'active' : ''} onClick={() => setFitMode('cover')}>ملء الشاشة</button>
      </div>
    </div>
  );
}

/**
 * The single display surface for every lesson asset shown inside Class Mode.
 * Asset loading remains keyed by assetId in useAssetSource; this component never
 * fetches a temporary remote URL when an Asset Store blob is available.
 */
export default function MediaRenderer({
  resource,
  source,
  pdfPage,
  page,
  annotations = [],
  onOpenExternal,
  onPdfStateChange,
  zoom = 1,
  onZoomChange,
}) {
  if (!resource) return null;

  const type = resource.type;
  const assetUrl = source?.url || '';
  const sourceError = source?.error || '';
  const nativeRuntime = Boolean(globalThis.Capacitor?.isNativePlatform?.());
  const pdfError = pdfPage?.error || '';
  const loading = Boolean(source?.loading || (nativeRuntime && ['pdf', 'textbook'].includes(type) && pdfPage?.loading));
  const imageAvailable = Boolean((source?.blob instanceof Blob && source.blob.size > 0) || assetUrl || resource?.url);

  return (
    <div className="resource-preview-body unified-media-renderer" data-media-type={type}>
      {type === 'image' && imageAvailable && (
        <RobustImage resource={resource} source={source} zoom={zoom} onZoomChange={onZoomChange} />
      )}
      {type === 'video' && assetUrl && (
        <video
          key={resource.id}
          className="unified-media-video"
          controls
          playsInline
          preload="metadata"
          src={assetUrl}
          aria-label={resource.title || 'فيديو الدرس'}
        />
      )}
      {type === 'audio' && assetUrl && (
        <audio key={resource.id} className="unified-media-audio" controls preload="metadata" src={assetUrl}/>
      )}
      {type === 'slides' && (
        <PptxPreview
          url={assetUrl}
          blob={source?.blob}
          title={resource.title}
          onOpenExternal={onOpenExternal}
        />
      )}
      {['pdf', 'textbook'].includes(type) && nativeRuntime && pdfPage?.dataUrl && (
        <img
          className="classmode-pdf-page-image unified-media-pdf"
          src={pdfPage.dataUrl}
          alt={`${resource.title} — صفحة ${page || 1}`}
        />
      )}
      {['pdf', 'textbook'].includes(type) && !nativeRuntime && (source?.blob || assetUrl) && (
        <PdfCanvasPreview
          source={source}
          resourceId={resource.assetId || resource.id || assetUrl}
          page={page || 1}
          title={resource.title}
          onStateChange={onPdfStateChange}
          zoom={zoom}
          onZoomChange={onZoomChange}
        />
      )}

      {loading && <MediaState title="جارٍ فتح الملف من ذاكرة المنصة…"/>}
      {sourceError && (
        <MediaState kind="error" title={sourceError} detail="أعد رفع الملف من المكتبة إذا استمرت المشكلة."/>
      )}
      {nativeRuntime && pdfError && (
        <MediaState kind="error" title={pdfError} detail="تعذر تجهيز صفحة PDF داخل وضع الحصة."/>
      )}
      {!source?.loading && !sourceError && type === 'image' && !imageAvailable && (
        <MediaState kind="missing" title="الصورة غير متاحة داخل ذاكرة المنصة." detail="أعد رفعها من المكتبة ثم افتح الحصة مرة أخرى."/>
      )}
      {!source?.loading && !sourceError && ['video', 'audio', 'slides'].includes(type) && !assetUrl && !(type === 'slides' && source?.blob) && (
        <MediaState kind="missing" title="الملف غير متاح داخل ذاكرة المنصة." detail="أعد رفعه من المكتبة ثم افتح الحصة مرة أخرى."/>
      )}
      {!INLINE_MEDIA_TYPES.has(type) && (
        <div className="resource-placeholder classmode-document-placeholder">
          <Presentation size={42}/>
          <strong>{resource.fileName || resource.title}</strong>
          <small>مستند مرتبط بالدرس</small>
          <button className="primary-btn" type="button" onClick={onOpenExternal}>فتح الملف على الجهاز</button>
        </div>
      )}
      {annotations.length > 0 && (
        <div className="resource-annotation-overlay">
          {annotations.map((note) => <span key={note.id} style={{ background: note.color }}>{note.text}</span>)}
        </div>
      )}
    </div>
  );
}
