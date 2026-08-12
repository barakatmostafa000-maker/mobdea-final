import { File, FileText, Presentation } from 'lucide-react';
import PptxPreview from './PptxPreview';

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
}) {
  if (!resource) return null;

  const type = resource.type;
  const assetUrl = source?.url || '';
  const sourceError = source?.error || '';
  const pdfError = pdfPage?.error || '';
  const loading = Boolean(source?.loading || (['pdf', 'textbook'].includes(type) && pdfPage?.loading));

  return (
    <div className="resource-preview-body unified-media-renderer" data-media-type={type}>
      {type === 'image' && assetUrl && (
        <img key={resource.id} className="unified-media-image" src={assetUrl} alt={resource.title}/>
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
      {['pdf', 'textbook'].includes(type) && pdfPage?.dataUrl && (
        <img
          className="classmode-pdf-page-image unified-media-pdf"
          src={pdfPage.dataUrl}
          alt={`${resource.title} — صفحة ${page || 1}`}
        />
      )}
      {['pdf', 'textbook'].includes(type)
        && !globalThis.Capacitor?.isNativePlatform?.()
        && !pdfPage?.dataUrl
        && assetUrl && (
          <iframe
            key={`${resource.id}:${page || 1}`}
            title={resource.title}
            src={`${assetUrl}#page=${page || 1}&toolbar=0&navpanes=0&view=FitH`}
          />
        )}

      {loading && <MediaState title="جارٍ فتح الملف من ذاكرة المنصة…"/>}
      {sourceError && (
        <MediaState kind="error" title={sourceError} detail="أعد رفع الملف من المكتبة إذا استمرت المشكلة."/>
      )}
      {pdfError && (
        <MediaState kind="error" title={pdfError} detail="تعذر تجهيز صفحة PDF داخل وضع الحصة."/>
      )}
      {!source?.loading && !sourceError && ['image', 'video', 'audio', 'slides'].includes(type) && !assetUrl && (
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
